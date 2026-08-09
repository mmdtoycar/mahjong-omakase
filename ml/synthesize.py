"""Turns the calibration crops into an endless supply of labelled training images.

There are only two photographs of each tile face, so the classifier's whole notion of "what a 5s looks
like" comes from this file. Everything here exists to stop it learning something narrower than that —
anything constant across the crops is a shortcut it will take, and every shortcut is a way for it to
score well here and fail on a real photo.

Two decisions carry most of the weight:

Tiles are pasted onto backgrounds, using the masks, rather than augmented in place. A crop's border
still holds traces of the calibration photo — the shadow between two tiles, a highlight the crop could
not remove without cutting into the 萬 — and pasting replaces all of it.

The backgrounds include other tiles. In a real hand a tile's neighbours are tiles, so a detector's
box will hold slivers of them; training only against tables or flat colour would leave the
classifier meeting that for the first time in production.

Geometry is deliberately wide. The prompt sent to Gemini has to tell it tiles appear at 0, 90 and
180 degrees, so the same is true here, and a detector's boxes are looser and less square than these
crops.
"""

from pathlib import Path

import cv2
import numpy as np

DATA = Path(__file__).resolve().parent / "data"
FACES, MASKS = DATA / "faces", DATA / "masks"

SIZE = 64  # what the classifier sees; a tile face is a simple shape and this is plenty

# A 35th class for everything that is not a tile face. Without it the classifier is closed-set: it
# has to answer with one of the 34, so felt, the table's plastic housing and a misaligned crop all
# come back as some tile, often above 0.8 confidence. That broke reading a real photo — the housing
# scored higher than the hand — and it would quietly write invented tiles into the score sheet.
NOT_A_TILE = "none"

# The face-down tile. Its own label rather than part of NOT_A_TILE, because it is what separates a
# 暗杠 from a 明杠: four tiles with two of them turned over is concealed, does not count as 副露, and
# does not break 门前清 — which changes the score. Folded into "not a tile" that is unrecoverable.
BACK = "back"

# A tile is not always upright in a photo, and the classifier is asked to name the face, not the
# orientation, so all four quarter turns are the same class.
QUARTER_TURNS = (0, 1, 2, 3)

# Every surface a tile has been photographed on, as BGR medians measured off those photos: the brown wall
# behind one calibration grid, the same brown carpet under warm and under dull light, and green felt four
# times over — two calibration photos, a back photo, and the hand photo. See _background for why these
# are sampled individually rather than folded into one range per colour.
TABLES = (
    (56, 82, 128),
    (51, 95, 145),
    (84, 99, 113),
    (37, 46, 22),
    (34, 82, 74),
    (50, 56, 30),
    (96, 126, 81),
)


def load_tiles() -> tuple[list[str], list[list[np.ndarray]], list[list[np.ndarray]]]:
    """Every label with each of its appearances and their cut-out masks.

    A label can have more than one appearance because there are two sets of tiles, on two tables. They
    are near-identical in design and quite different in finish and lighting, and holding both under one
    label is what pushes the classifier towards the pattern rather than towards the look of one set.
    """
    labels = sorted(d.name for d in FACES.iterdir() if d.is_dir())
    if not labels:
        raise SystemExit(f"no crops in {FACES} — run slice_calibration.py first")
    faces, masks = [], []
    for label in labels:
        variants = sorted(p.name for p in (FACES / label).glob("*.png"))
        if not variants:
            raise SystemExit(f"{FACES / label} has no crops")
        face = [cv2.imread(str(FACES / label / v)) for v in variants]
        mask = [cv2.imread(str(MASKS / label / v), cv2.IMREAD_GRAYSCALE) for v in variants]
        if any(f is None or m is None for f, m in zip(face, mask)):
            raise SystemExit(f"a crop in {FACES / label} has no matching mask")
        faces.append(face)
        masks.append(mask)
    return labels, faces, masks


class Synthesiser:
    """Draws augmented samples for a given tile index. Deterministic for a given seed."""

    def __init__(
        self,
        faces: list[list[np.ndarray]],
        masks: list[list[np.ndarray]],
        seed: int,
        hard: bool,
        size: int = SIZE,
        labels: list[str] | None = None,
    ):
        self.faces = faces
        self.masks = masks
        self.size = size
        self.rng = np.random.default_rng(seed)
        # The harder settings are for evaluation only: pushing every range past what training saw is
        # the closest thing available to an unseen photo, given every image traces to one source.
        self.hard = hard
        # Which index is the face-down tile, if the caller said. It is the one class that may be cropped
        # into — see the note on `slack` in sample().
        self.back = labels.index(BACK) if labels and BACK in labels else None

    # ── helpers ────────────────────────────────────────────────────────────

    def _uniform(self, low: float, high: float, stretch: float = 1.4) -> float:
        """A draw from the range, widened when generating the harder evaluation set.

        A widened range keeps the sign of its lower bound. Several of these are physically
        non-negative — a blur radius, a noise level — and stretching them past zero is not a harder
        sample but an invalid one.
        """
        if self.hard:
            middle = (low + high) / 2
            stretched_low = middle + (low - middle) * stretch
            low = max(stretched_low, 0.0) if low >= 0 else stretched_low
            high = middle + (high - middle) * stretch
        return float(self.rng.uniform(low, high))

    def _variant(self, index: int) -> tuple[np.ndarray, np.ndarray]:
        """One of the label's appearances, chosen per sample so both sets are seen equally often."""
        pick = int(self.rng.integers(0, len(self.faces[index])))
        return self.faces[index][pick], self.masks[index][pick]

    def _background(self, height: int, width: int, exclude: int, tiles: bool = True) -> np.ndarray:
        """Whatever surrounds a tile: another tile, the table, or something plain.

        `tiles=False` for the negative class, which must never be handed a legible tile face — that
        would teach the model a clear 5m is "not a tile".
        """
        choice = self.rng.integers(0, 10)
        if tiles and choice < 5:
            # A neighbouring tile, which is what a hand actually looks like. Blurred and dimmed a
            # little so it reads as out of frame rather than as a second subject.
            index = int(self.rng.integers(0, len(self.faces)))
            if len(self.faces) > 1:
                while index == exclude:
                    index = int(self.rng.integers(0, len(self.faces)))
            other, _ = self._variant(index)
            tiled = cv2.resize(other, (width, height))
            tiled = cv2.GaussianBlur(tiled, (0, 0), max(self._uniform(1.0, 3.0), 0.1))
            return np.clip(tiled * self._uniform(0.75, 1.0), 0, 255).astype(np.uint8)
        if choice < 8:
            # A table, drawn as one of the surfaces actually photographed plus a jitter.
            #
            # This used to be two independent per-channel ranges, one "brown" and one "green", and both
            # were guessed. The green one was simply wrong: it ran B 50-105, G 85-150, R 35-85, and the
            # green backgrounds actually measured are (37,46,22), (34,82,74), (50,56,30) and (96,126,81).
            # Only the last is inside it, so the model had barely been shown a dark green table at all —
            # the commonest thing behind a real hand.
            #
            # Widening the ranges to cover them was the first fix and it made things worse: a box that
            # holds both (37,46,22) and (96,126,81) also holds a lot of colours no table has, and on the
            # one real photo it halved the confidence on 發, whose whole problem is green ink against a
            # green surround. Sampling near a measured colour keeps the coverage and drops the invented
            # part. The spread within one surface is still represented, because the same brown carpet
            # appears twice, warm and dull, and the same felt three times.
            base = np.array(TABLES[int(self.rng.integers(0, len(TABLES)))], np.float32)
            base = base * self._uniform(0.75, 1.25) + self.rng.uniform(-12, 12, 3)
            field = np.full((height, width, 3), np.clip(base, 0, 255), np.float32)
            field += self.rng.normal(0, 12, (height, width, 1))
            return np.clip(field, 0, 255).astype(np.uint8)
        flat = np.full((height, width, 3), self._uniform(20, 230), np.float32)
        return np.clip(flat + self.rng.normal(0, 8, (height, width, 1)), 0, 255).astype(np.uint8)

    def _warp(self, face: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Rotation, a small perspective change, and the loose framing a detector would give."""
        turns = int(self.rng.choice(QUARTER_TURNS))
        if turns:
            face = np.rot90(face, turns).copy()
            mask = np.rot90(mask, turns).copy()

        height, width = mask.shape
        # Off-square by up to a few degrees, as a hand-held photo is.
        angle = self._uniform(-12, 12)
        centre = (width / 2, height / 2)
        matrix = cv2.getRotationMatrix2D(centre, angle, self._uniform(0.85, 1.05))
        face = cv2.warpAffine(face, matrix, (width, height), borderValue=(0, 0, 0))
        mask = cv2.warpAffine(mask, matrix, (width, height), borderValue=0)

        # Perspective: the camera is rarely square to the table.
        shift = min(height, width) * (0.10 if self.hard else 0.06)
        source = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
        target = source + self.rng.uniform(-shift, shift, (4, 2)).astype(np.float32)
        perspective = cv2.getPerspectiveTransform(source, target)
        face = cv2.warpPerspective(face, perspective, (width, height), borderValue=(0, 0, 0))
        mask = cv2.warpPerspective(mask, perspective, (width, height), borderValue=0)
        return face, mask

    def _photometric(self, image: np.ndarray) -> np.ndarray:
        """Exposure, white balance, focus and compression, roughly as a phone would vary them."""
        out = image.astype(np.float32)
        out *= self._uniform(0.55, 1.35)  # exposure
        out = (out - 128) * self._uniform(0.7, 1.3) + 128  # contrast
        # Wider than a phone's own variation, because felt bounces its colour onto the tile: on the
        # green table a white face measures a* -3 rather than 0.
        out *= self.rng.uniform(0.82, 1.18, 3)  # white balance
        out = np.clip(out, 0, 255)

        gamma = self._uniform(0.7, 1.4)
        out = 255.0 * np.power(out / 255.0, gamma)

        if self.rng.random() < 0.6:
            out = cv2.GaussianBlur(out, (0, 0), max(self._uniform(0.4, 1.8), 0.1))
        if self.rng.random() < 0.25:
            # Motion blur, from the hand that is holding the phone.
            length = max(int(self._uniform(3, 9)), 3)
            kernel = np.zeros((length, length), np.float32)
            kernel[length // 2, :] = 1.0 / length
            angle = self._uniform(0, 180)
            spin = cv2.getRotationMatrix2D((length / 2 - 0.5, length / 2 - 0.5), angle, 1)
            out = cv2.filter2D(out, -1, cv2.warpAffine(kernel, spin, (length, length)))

        out = np.clip(out + self.rng.normal(0, self._uniform(1, 9), out.shape), 0, 255)
        out = out.astype(np.uint8)

        quality = int(np.clip(self._uniform(35, 95), 10, 100))
        ok, encoded = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return cv2.imdecode(encoded, cv2.IMREAD_COLOR) if ok else out

    def _occlude(self, image: np.ndarray) -> np.ndarray:
        """A finger, a shadow, or the tile in front covering part of the face."""
        if self.rng.random() > (0.35 if self.hard else 0.2):
            return image
        height, width = image.shape[:2]
        vertical = self.rng.random() < 0.5
        span = height if not vertical else width
        # Kept modest for the same reason as the crop: a band across a third of the tile can hide
        # the whole numeral, and then no answer is derivable from what is left.
        band = max(int(self._uniform(0.08, 0.20) * min(height, width)), 1)
        start = int(self.rng.integers(0, max(span - band, 1)))
        shape = (height, band) if vertical else (band, width)
        patch = np.full((*shape, 3), self._uniform(20, 200), np.float32)
        patch += self.rng.normal(0, 10, (*shape, 1))
        patch = np.clip(patch, 0, 255).astype(np.uint8)
        if vertical:
            image[:, start : start + band] = patch
        else:
            image[start : start + band] = patch
        return image

    # ── the sample ─────────────────────────────────────────────────────────

    def sample_negative(self) -> np.ndarray:
        """Something a crop might contain that is not one tile face."""
        pad = int(self._uniform(60, 200))
        canvas = self._background(pad, pad, exclude=0, tiles=False)
        choice = self.rng.integers(0, 3)
        if choice == 0:
            # Two tiles meeting, which is what a misaligned grid produces.
            first, second = (int(self.rng.integers(0, len(self.faces))) for _ in range(2))
            split = int(pad * self._uniform(0.25, 0.75))
            top = cv2.resize(self._variant(first)[0], (pad, max(split, 1)))
            bottom = cv2.resize(self._variant(second)[0], (pad, max(pad - split, 1)))
            canvas = np.vstack([top, bottom])[:pad]
            if self.rng.random() < 0.5:
                canvas = np.rot90(canvas).copy()
        elif choice == 1:
            # A sliver of one tile against its surroundings, or a tile seen edge-on.
            face, _ = self._variant(int(self.rng.integers(0, len(self.faces))))
            # Floored: the widened ranges can stretch this fraction to zero, and an empty slice
            # takes cv2.resize down with it mid-training.
            keep = max(int(face.shape[1] * self._uniform(0.05, 0.3)), 3)
            canvas = cv2.resize(face[:, :keep], (pad, pad))
        return self._photometric(cv2.resize(canvas, (self.size, self.size)))

    def sample(self, index: int) -> np.ndarray:
        """One augmented square BGR image of the tile at `index`."""
        face, mask = self._warp(*self._variant(index))
        height, width = mask.shape

        # Pad so the tile can sit anywhere in the frame with background all around it.
        pad = int(max(height, width) * self._uniform(0.10, 0.35))
        canvas_h, canvas_w = height + 2 * pad, width + 2 * pad
        canvas = self._background(canvas_h, canvas_w, index)

        top = pad + int(self.rng.integers(-pad // 2, pad // 2 + 1))
        left = pad + int(self.rng.integers(-pad // 2, pad // 2 + 1))
        top, left = max(top, 0), max(left, 0)
        top, left = min(top, canvas_h - height), min(left, canvas_w - width)

        alpha = (mask.astype(np.float32) / 255.0)[:, :, None]
        window = canvas[top : top + height, left : left + width].astype(np.float32)
        canvas[top : top + height, left : left + width] = (
            face.astype(np.float32) * alpha + window * (1 - alpha)
        ).astype(np.uint8)

        # Crop back to roughly the tile, as loosely as a detector would. Slack stays almost entirely
        # positive for a face: a tight box is realistic, but cropping several percent into the face
        # removes the numeral on a 萬 tile, which sits right at the top edge, and 1m 2m 3m become the
        # same image. Inspecting the failures showed most of them were exactly that — samples whose
        # label no longer follows from the image, which is label noise rather than a hard example.
        #
        # The face-down tile is the exception, and getting this wrong made the class unusable. A back has
        # no numeral to lose: cropped into, it is still unmistakably a back. Meanwhile the reader cuts
        # *inside* each fitted cell, so a real crop of a back shows no background at all — and with slack
        # almost always positive, nearly every training sample did. The model learnt to expect that
        # border. Measured on the twenty back crops: presented tight, as the reader presents them, twelve
        # came back `none`; the same crops with a margin of felt pasted around them scored 0.94 to 0.97
        # as `back` with `none` at 0.00. The class was fine and the framing was not.
        low = -0.12 if index == self.back else -0.02
        slack = self._uniform(low, 0.18)
        cy, cx = top + height / 2, left + width / 2
        half_h, half_w = height / 2 * (1 + slack), width / 2 * (1 + slack)
        y0, y1 = int(max(cy - half_h, 0)), int(min(cy + half_h, canvas_h))
        x0, x1 = int(max(cx - half_w, 0)), int(min(cx + half_w, canvas_w))
        crop = canvas[y0:y1, x0:x1]
        if crop.size == 0:
            crop = canvas

        crop = self._occlude(crop)
        crop = self._photometric(crop)
        return cv2.resize(crop, (self.size, self.size), interpolation=cv2.INTER_AREA)


def contact_sheet(path: Path, labels: list[str], per_label: int = 8, hard: bool = False) -> None:
    """A grid of samples per class, because the only way to trust this is to look at it."""
    names, faces, masks = load_tiles()
    synth = Synthesiser(faces, masks, seed=0, hard=hard, labels=names)
    cell = SIZE + 4
    sheet = np.full((len(labels) * cell, per_label * cell + 34, 3), 255, np.uint8)
    for row, label in enumerate(labels):
        index = labels.index(label)
        cv2.putText(
            sheet,
            label,
            (2, row * cell + cell // 2 + 5),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )
        for column in range(per_label):
            tile = synth.sample(index)
            y, x = row * cell + 2, 34 + column * cell + 2
            sheet[y : y + SIZE, x : x + SIZE] = tile
    cv2.imwrite(str(path), sheet)
    print(f"wrote {path}")


if __name__ == "__main__":
    names, _, _ = load_tiles()
    contact_sheet(DATA / "synthetic_samples.png", names)
    contact_sheet(DATA / "synthetic_samples_hard.png", names, hard=True)
