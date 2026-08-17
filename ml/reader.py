"""Reads a real hand photo end to end: finds the tiles, then names them with the classifier.

Written to answer whether the staged plan was too cautious, and it was. A hand is laid out as a line
of butted tiles, bright and nearly colourless against strongly coloured felt, so finding the line is
a thresholding problem rather than a detection problem — no trained detector, and none of the labelled
photos that would need.

Splitting the line is the part that needs care. The tiles touch, so the line comes back as one blob.
The grid is found geometrically first — see grid_fit.py — and the classifier is then used only to
choose between runs and to nudge the fit by a pixel or two. Confidence is the right signal for that
nudging: a misaligned crop is half of one tile and half of the next, which the classifier is not
confident about.

Doing it the other way round was the first version and it was far too slow to ship: brute-forcing
count, pitch and offset cost 1,680 grid hypotheses and 22,680 tile classifications on one photo, some
21 seconds of inference. The geometry was in the pixels the whole time.

On one real photo, from a table the model has never seen and felt a different colour from the
calibration photo, this reads 13 of 13 tiles correctly, ten of them above 0.85.
"""

import argparse
import io
import json
import pathlib
from pathlib import Path
from typing import NamedTuple

import cv2
import numpy as np
import onnxruntime as ort
import pillow_heif
from PIL import Image, ImageOps, UnidentifiedImageError

from grid_fit import fit_grid
from synthesize import BACK, DATA, SIZE

# iPhones produce HEIC, and it reaches this code whenever the browser could not decode it: Safari can,
# desktop Chrome cannot, and the upload path then sends the file untouched. OpenCV has no HEIC support
# at all, so without this the reader refuses every photo taken on a phone and uploaded from a desktop.
pillow_heif.register_heif_opener()

# The exported model rather than the training checkpoint, and no torch anywhere below. Two reasons: the
# sidecar that serves this has to install onnxruntime and not a 2GB deep-learning framework, and running
# the *same* inference path in development as in production removes a whole class of "it worked with the
# .pt" surprise. train_classifier writes both files from the same weights.
RUNS = pathlib.Path(__file__).resolve().parent / "runs"
MODEL = RUNS / "classifier.onnx"
METADATA = RUNS / "classifier.json"

# A tile face is near-white: bright, and far less coloured than green felt or a brown table.
MIN_LIGHTNESS = 150
MAX_CHROMA = 26

MIN_RUN_ASPECT = 2.0  # below this a blob is a single tile, not a line of them

# How far the classifier is allowed to move the geometric fit. Small on purpose: the fit is already
# within a pixel of the brute-force answer, and every step here costs a forward pass per tile.
PITCH_NUDGE = (0.99, 1.0, 1.01)
OFFSET_NUDGE = (-0.04, 0.0, 0.04)
# The count is *not* nudged, and that is a fix rather than an omission. Mean confidence cannot compare
# grids of different lengths: fewer cells means the worst tile can be left out, so the score rises every
# time one is dropped. On the one real photo, rotated to landscape the way the upload path sends it, the
# scores ran 11 tiles 0.880, 12 tiles 0.866, 13 tiles 0.840 — monotonically rewarding truncation. The
# refiner duly returned twelve tiles and quietly lost a 發; only the ±1 bound stopped it at twelve rather
# than eleven. The portrait version happened to answer thirteen, which is why this sat unnoticed.
#
# The run's length is an unbiased estimate of the count and fit_grid already uses it — 13 cells spanned
# 1.00 of the run against 0.92 for 12. So the geometry decides how many tiles there are and the
# classifier only moves the grid by a fraction of a pitch, which is all it was ever good for.

# What a run of this length is. Three or four tiles set aside is a meld; the long run is the standing
# hand. Nothing else is part of the hand — a discard pile is neither.
MELD_SIZES = (3, 4)

# A meld is made of the same physical tiles as the hand, photographed from the same distance, so the
# spacing along it has to match the hand's. This is checked before the classifier is asked anything:
# on the first photo tried, a corner of the discard pile fitted four cells at a pitch of 63 against the
# hand's 87 — 72%, which no tile of that set can be — and it was still read (as a gang of 1p, at 0.00
# confidence) before being thrown out on confidence alone.
#
# Framing the photo to exclude the discards would also have removed that candidate, and is worth doing.
# It is not relied on: a rule the photographer maintains is not a guarantee the code can hold.
MIN_PITCH_MATCH = 0.8
MAX_PITCH_MATCH = 1.25

# A crop this sure it is not a tile disqualifies the whole meld. Melds have no partial credit: one
# wrong tile is a different hand.
NOTHING_LIMIT = 0.3
CONFIDENT = 0.8  # hand back anything under this rather than guess

# Mean confidence alone is an exploitable objective. A 272x110 blob cut into fifteen 17px slivers
# scored 0.903 — higher than the real hand's 0.731 — because a featureless sliver gets confidently
# assigned to whatever class the model falls back on. So a candidate grid also has to produce crops
# shaped like a tile: these are about 3:2, and this bound admits either orientation with room to
# spare while rejecting anything sliver-like.
MIN_TILE_RATIO = 0.5
MAX_TILE_RATIO = 2.0


def tile_mask(bgr: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    lightness = lab[:, :, 0].astype(np.int16)
    chroma = np.hypot(lab[:, :, 1].astype(np.int16) - 128, lab[:, :, 2].astype(np.int16) - 128)
    mask = ((lightness > MIN_LIGHTNESS) & (chroma < MAX_CHROMA)).astype(np.uint8)
    # Close over the engraved characters so a face reads as solid, then erode: without it the hand
    # merges with whatever bright thing happens to sit beside it, and comes back as one 256x1282 blob
    # with the tiles buried inside.
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    return cv2.erode(mask, np.ones((9, 9), np.uint8))


def candidate_runs(bgr: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Every blob shaped like a line of butted tiles.

    Shape is not enough to pick the hand out of these. In the first photo tried, the housing of the
    mahjong table came back 172x1428 — aspect 8.3, against the hand's 8.4 — and being the longer of
    the two it won. So all of them are returned and the classifier decides, the same way it decides
    the alignment: a run of real tiles yields confident predictions and a strip of plastic does not.
    """
    count, _, stats, _ = cv2.connectedComponentsWithStats(tile_mask(bgr), connectivity=4)
    runs = []
    for i in range(1, count):
        x, y, w, h, area = stats[i]
        long_side, short_side = max(w, h), max(min(w, h), 1)
        if long_side / short_side >= MIN_RUN_ASPECT and area > 0.005 * bgr.size / 3:
            runs.append((int(x), int(y), int(w), int(h)))
    if not runs:
        raise SystemExit("no line of tiles found")
    return runs


def read_line(
    model: ort.InferenceSession,
    bgr: np.ndarray,
    light: np.ndarray,
    box: tuple[int, int, int, int],
    size: int,
    refine: bool,
    counts,
    expect: int | None = None,
) -> tuple[float, int, float, float, np.ndarray, np.ndarray, np.ndarray] | None:
    """Reads one run, starting from its geometric fit.

    With `refine` false this costs a single forward pass, which is all that is needed to tell a row of
    tiles from a strip of the table's plastic housing. The winner is then read again with `refine` on.

    `expect` is forwarded to the fit for callers that nearly know the count. A meld is three tiles or
    four and nothing else, and the unconstrained fit is at its weakest on a run that short — there are
    only two or three interior boundaries to work with, and on a composed three-tile 碰 it answered four
    cells at 70% of the true pitch, which the pitch check downstream then rejected as "not the same
    tiles". Asking for each candidate count outright costs one more fit and removes that whole failure.
    """
    _, _, w, h = box
    vertical = h >= w
    fit = fit_grid(light, box, vertical, expect=expect)
    if fit is None:
        return None
    pitch, offset, count = fit
    # A geometric fit knows nothing about mahjong, so it will happily describe the table's plastic
    # housing as eighteen tiles. Anything outside the range of a hand is not a hand.
    if count not in counts:
        return None

    combinations = (
        [(pitch * p, offset + pitch * o, count) for p in PITCH_NUDGE for o in OFFSET_NUDGE]
        if refine
        else [(pitch, offset, count)]
    )

    best = None
    for candidate_pitch, candidate_offset, candidate_count in combinations:
        if candidate_count not in counts:
            continue
        crops = slice_line(bgr, box, vertical, candidate_offset, candidate_pitch, candidate_count, size)
        if crops is None:
            continue
        confidence, predicted, nothing = classify(model, crops)
        score = float(confidence.mean())
        if best is None or score > best[0]:
            best = (
                score,
                candidate_count,
                candidate_pitch,
                candidate_offset,
                confidence,
                predicted,
                nothing,
            )
    return best


def slice_line(
    bgr: np.ndarray,
    box: tuple[int, int, int, int],
    vertical: bool,
    start: float,
    pitch: float,
    count: int,
    size: int,
    inset: int = 4,
) -> np.ndarray | None:
    x, y, w, h = box
    origin = (y if vertical else x) + start
    crops = []
    for i in range(count):
        a, b = int(origin + i * pitch) + inset, int(origin + (i + 1) * pitch) - inset
        if b <= a:
            return None
        crop = bgr[a:b, x + inset : x + w - inset] if vertical else bgr[y + inset : y + h - inset, a:b]
        if crop.size == 0 or crop.shape[0] < 8 or crop.shape[1] < 8:
            return None
        crops.append(cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA))
    return np.stack(crops)


def load_model() -> tuple[ort.InferenceSession, list[str], int]:
    """The exported classifier with its labels and input size."""
    if not MODEL.exists():
        raise SystemExit(f"no model at {MODEL} — run train_classifier.py first")
    session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    labels = json.loads(METADATA.read_text())["labels"]
    return session, labels, SIZE


def classify(model: ort.InferenceSession, crops: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Best tile class per crop with its probability, and separately the probability of `none`.

    Kept apart because the two are wanted for different things. Ranking candidate runs by plain top-1
    confidence picked the table's plastic housing over the hand: read as fifteen crops of nothing it
    scored 0.844 of confident "none" against the hand's 0.731, so selection has to score confidence
    that something is *a tile*. But whether a crop is nothing at all is still worth knowing, and if
    `none` is simply excluded it becomes unreachable — the check for it downstream was dead code.
    """
    rgb = (crops[:, :, :, ::-1].astype(np.float32) / 255.0) - 0.5
    batch = np.ascontiguousarray(rgb.transpose(0, 3, 1, 2))
    logits = model.run(None, {model.get_inputs()[0].name: batch})[0]
    logits = logits - logits.max(axis=1, keepdims=True)
    exponentiated = np.exp(logits)
    probabilities = exponentiated / exponentiated.sum(axis=1, keepdims=True)
    faces = probabilities[:, :-1]
    return faces.max(axis=1), faces.argmax(axis=1), probabilities[:, -1]


def decode(raw: bytes) -> np.ndarray | None:
    """The photo as BGR, whatever container it arrived in.

    OpenCV first because it is the fast path for the JPEG the browser normally sends. Pillow is the
    fallback, which is what handles HEIC — and it has to apply the EXIF orientation itself. Nothing
    else will have: a HEIC only reaches the server because the browser could not draw it to a canvas,
    and drawing to a canvas is exactly what would have applied the orientation.
    """
    bgr = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if bgr is not None:
        return bgr
    try:
        with Image.open(io.BytesIO(raw)) as opened:
            upright = ImageOps.exif_transpose(opened)
            return cv2.cvtColor(np.array(upright.convert("RGB")), cv2.COLOR_RGB2BGR)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        # DecompressionBombError inherits straight from Exception, so it is not covered by the others.
        # Pillow raises it past twice MAX_IMAGE_PIXELS (89M by default), which is the guard that matters
        # here: the browser caps an upload at 2048px, but a HEIC that the browser could not decode
        # arrives at whatever size the camera produced.
        return None


LONG_SIDE = 900


def shrink(bgr: np.ndarray, long_side: int = LONG_SIDE) -> np.ndarray:
    """Down to the size the reader expects. Only ever down — enlarging invents no detail."""
    scale = min(1.0, long_side / max(bgr.shape[:2]))
    return bgr if scale == 1.0 else cv2.resize(bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)


def positive(raw: str) -> int:
    """A pixel count has to be at least one; zero would make the resize scale invalid."""
    value = int(raw)
    if value <= 0:
        raise argparse.ArgumentTypeError(f"must be greater than zero, got {value}")
    return value


class Reading(NamedTuple):
    """Everything one photo yielded. `tiles` is in hand order when `direction.known`."""

    tiles: list[str]
    confidence: list[float]
    # Quoted because Meld and Direction are defined further down; NamedTuple evaluates its annotations
    # when the class is created.
    melds: list["Meld"]
    winning: str | None
    direction: "Direction"
    box: tuple[int, int, int, int]
    pitch: float
    crops: np.ndarray
    notes: list[str]


DESKEW_MIN_ANGLE = 1.0  # degrees; below this, rotating only costs sharpness
DESKEW_SEARCH = tuple(np.arange(-1.5, 1.6, 0.5))  # nudge either side of the estimated tilt


def _line_angle(mask: np.ndarray) -> float:
    """Tilt, in degrees off the nearest axis, of the most line-shaped blob in `mask`. 0 if none."""
    count, labelled, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
    best_ratio, best_angle = 0.0, 0.0
    for i in range(1, count):
        x, y, w, h, area = stats[i]
        if area <= 0.005 * mask.size:
            continue
        ys, xs = np.where(labelled[y : y + h, x : x + w] == i)
        if len(xs) < 50:
            continue
        points = np.column_stack([xs, ys]).astype(np.float64)
        centered = points - points.mean(axis=0)
        eigenvalues, eigenvectors = np.linalg.eigh(np.cov(centered.T))
        ratio = np.sqrt(max(eigenvalues) / max(min(eigenvalues), 1e-6))
        if ratio <= best_ratio:
            continue
        major = eigenvectors[:, int(np.argmax(eigenvalues))]
        angle = np.degrees(np.arctan2(major[1], major[0]))
        best_ratio, best_angle = ratio, ((angle + 45) % 90) - 45  # wrap to nearest axis
    return best_angle if best_ratio >= MIN_RUN_ASPECT else 0.0


def _rotate(bgr: np.ndarray, angle: float) -> np.ndarray:
    """`bgr` turned by `angle` degrees, on a canvas big enough not to clip corners."""
    h, w = bgr.shape[:2]
    matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    cos, sin = abs(matrix[0, 0]), abs(matrix[0, 1])
    new_w, new_h = int(h * sin + w * cos), int(h * cos + w * sin)
    matrix[0, 2] += (new_w - w) / 2
    matrix[1, 2] += (new_h - h) / 2
    # Black, not white: tile_mask is a near-white test, and white padding welds every blob together.
    return cv2.warpAffine(bgr, matrix, (new_w, new_h), flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0))


def read_hand(
    model: ort.InferenceSession,
    labels: list[str],
    size: int,
    bgr: np.ndarray,
    counts: range = range(12, 16),
) -> Reading | str:
    """Reads one photo, or returns the reason it could not be read.

    Tried upright first, at no extra cost for the common case. Only on failure is the photo's tilt
    estimated and a few corrections around it tried — a photo taken at an angle fails at the very
    first step otherwise: `candidate_runs` filters by axis-aligned bounding box, and a tilted row's
    box is far squarer than a straight one's.
    """
    upright = _read_hand_upright(model, labels, size, bgr, counts)
    if isinstance(upright, Reading):
        return upright
    angle = _line_angle(tile_mask(bgr))
    if abs(angle) < DESKEW_MIN_ANGLE:
        return upright
    candidates = [
        candidate
        for candidate in (
            _read_hand_upright(model, labels, size, _rotate(bgr, angle + nudge), counts)
            for nudge in DESKEW_SEARCH
        )
        if isinstance(candidate, Reading)
    ]
    if not candidates:
        return upright
    return max(candidates, key=lambda reading: sum(reading.confidence) / len(reading.confidence))


def _read_hand_upright(
    model: ort.InferenceSession,
    labels: list[str],
    size: int,
    bgr: np.ndarray,
    counts: range,
) -> Reading | str:
    """`read_hand`, assuming the hand is already axis-aligned in `bgr`."""
    light = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)
    try:
        runs = candidate_runs(bgr)
    except SystemExit as reason:
        return str(reason)

    # The standing hand and the melds are separate runs — the melds are set aside on the right with a
    # gap, so the mask gives them their own blobs. Read every run that could be either.
    hand_candidates, meld_boxes = [], []
    for box in runs:
        for sizes, bucket in ((counts, hand_candidates), (MELD_SIZES, meld_boxes)):
            fit = read_line(model, bgr, light, box, size, refine=False, counts=sizes)
            if fit is None:
                continue
            bucket.append((fit[0], box))
            break
    if not hand_candidates:
        return "no run long enough to be a hand"
    box = max(hand_candidates)[1]

    refined = read_line(model, bgr, light, box, size, refine=True, counts=counts)
    if refined is None:
        return "the run that looked like a hand could not be read"
    _, count, pitch, start, confidence, predicted, _ = refined

    _, _, w, h = box
    vertical = h >= w
    crops = slice_line(bgr, box, vertical, start, pitch, count, size)
    direction = reading_order(box, [b for _, b in meld_boxes])
    if direction.reverse:
        crops = crops[::-1]
        confidence, predicted = confidence[::-1], predicted[::-1]

    tiles = [labels[int(g)] for g in predicted]
    sure = [float(c) for c in confidence]
    melds, notes = read_melds(model, bgr, light, meld_boxes, box, pitch, size, labels)

    # The winning tile only when which end it sits at was actually established. The calculator moves it
    # to the end of the array itself, so an honest null costs one tap and a guess costs a wrong score.
    winning = tiles[-1] if direction.known and tiles else None
    if not direction.known:
        notes.append(f"which end holds the winning tile is unknown ({direction.why})")
    unsure = [t for t, c in zip(tiles, sure) if c < CONFIDENT]
    if unsure:
        notes.append(f"least certain about {', '.join(unsure)} — worth a look")
    return Reading(tiles, sure, melds, winning, direction, box, pitch, crops, notes)


def as_json(reading: Reading) -> dict:
    """The reading in the shape the UI already parses, which is the shape Gemini answers in.

    `isSelfDraw` is always false because a photograph cannot say — the win condition is chosen by hand in
    the calculator either way. `notes` is where the local reader can say something Gemini cannot: which
    tiles it is least sure of.
    """
    return {
        "concealed": reading.tiles,
        "melds": [{"type": m.kind, "tiles": m.tiles, "isOpen": m.is_open} for m in reading.melds],
        "winningTile": reading.winning,
        "isSelfDraw": False,
        "notes": "; ".join(reading.notes),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("photo", type=Path)
    # A target size rather than a scale factor, because what matters is how many pixels a tile ends up
    # being, and that follows from the absolute size. This was a fixed 0.25, which suited the 5712px
    # photo it was written against and silently miscounted a 1280px one — 12 tiles instead of 13, at
    # 0.55 mean confidence, because each tile came out 31px wide.
    #
    # 900 puts a tile at roughly 55px, close to the classifier's own 64px input, which is the sense in
    # which it is not arbitrary: shrinking further throws away detail the model would use, and going much
    # larger only sharpens the crop's edges into features the synthetic data does not have. Every setting
    # from 640 to 1707 read the one real photo correctly, so the exact number is not delicate.
    parser.add_argument("--long-side", type=positive, default=LONG_SIDE)
    parser.add_argument("--min-tiles", type=int, default=12)
    parser.add_argument("--max-tiles", type=int, default=15)
    parser.add_argument("--json", action="store_true", help="print what the service would return")
    # Under data/ rather than /tmp: that directory is this script's own and gitignored, so two runs on
    # photos with the same stem cannot collide with each other or with anything else on the machine.
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    bgr = decode(args.photo.read_bytes()) if args.photo.exists() else None
    if bgr is None:
        raise SystemExit(f"cannot read {args.photo}")
    bgr = shrink(bgr, args.long_side)

    model, labels, size = load_model()
    reading = read_hand(model, labels, size, bgr, range(args.min_tiles, args.max_tiles + 1))
    if isinstance(reading, str):
        raise SystemExit(reading)

    if args.json:
        print(json.dumps(as_json(reading), ensure_ascii=False, indent=2))
        return

    count = len(reading.tiles)
    print(f"{args.photo.name} at {bgr.shape[1]}x{bgr.shape[0]}")
    print(f"chose {reading.box}: {count} tiles, pitch {reading.pitch:.1f}px")
    if reading.direction.known:
        turned = "reversed, so that " if reading.direction.reverse else ""
        print(f"{turned}the winning tile is the last one below — {reading.direction.why}\n")
    else:
        print(f"which end holds the winning tile is unknown — {reading.direction.why}")
        print("the order below is as sliced, and may be the reverse of the hand's\n")

    for i, (guess, certainty) in enumerate(zip(reading.tiles, reading.confidence), 1):
        mark = "" if certainty >= CONFIDENT else "   <- hand this one back"
        last = "   <- winning tile" if reading.winning is not None and i == count else ""
        print(f"  {i:2d}. {guess:4s} {certainty:.2f}{mark}{last}")
    kept = sum(1 for c in reading.confidence if c >= CONFIDENT)
    print(f"\n{kept}/{count} at confidence >= {CONFIDENT}\n")

    for meld in reading.melds:
        print(f"  meld: {meld.kind} {meld.tiles} isOpen={meld.is_open}")
    for note in reading.notes:
        print(f"  note: {note}")

    out = args.output or DATA / f"{args.photo.stem}_read.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet(reading.crops, reading.confidence, reading.tiles, out)


NUMBERED_SUITS = ("m", "p", "s")


def meld_kind(tiles: list[str]) -> str | None:
    """From the tiles alone, or None when they do not form a meld at all.

    "Anything that is not three alike is a 吃" was the first version and it is wrong in a way that
    matters: three tiles that merely passed the confidence floor — a corner of the discard pile, say —
    would be reported as a 吃 and scored as one. A 吃 is three consecutive numbers in one suit, and
    nothing else. A run that cannot be named is not a meld, and saying so is the only safe answer.
    """
    if len(set(tiles)) == 1:
        return "gang" if len(tiles) == 4 else "ke" if len(tiles) == 3 else None
    if len(tiles) != 3:
        return None
    suits = {tile[-1] for tile in tiles}
    if len(suits) != 1 or suits.pop() not in NUMBERED_SUITS:
        return None
    ranks = sorted(int(tile[0]) for tile in tiles)
    return "shun" if ranks[2] - ranks[0] == 2 and len(set(ranks)) == 3 else None


class Meld(NamedTuple):
    kind: str
    tiles: list[str]
    is_open: bool


def judge_meld(tiles: list[str], confidence: list[float], nothing: list[float]) -> Meld | str:
    """What a run of three or four crops is, or the reason it is not a meld.

    Kept free of images so it can be checked against numbers rather than against a composed photograph —
    see self_check. The first attempt at that check built melds out of the calibration crops, and every
    failure it produced came from the composition rather than from this logic, which is worse than no
    check at all: the temptation is then to loosen the code until the fixture passes.

    The two roles are judged separately, and lumping them together is what silently dropped 暗杠.

    A face-up tile carries the meld's identity, so it has to be named outright — hence the floor. A
    face-down tile names nothing; the pair that is face up already decides all four. All it has to
    establish is that it is a tile back rather than a patch of table, and that question needs no
    threshold: `back` simply has to beat `none`.

    Held to the face-up floor instead, the backs fail. Of the twenty tile-back crops there are, seven sit
    under 0.8 and two of those also read 32% not-a-tile — every one of them a pale back, whose faint
    pattern is nearly gone by 64px. A 暗杠 photographed with those tiles was thrown away here, with
    nothing in the output to show that it had been.
    """
    faces = [i for i, t in enumerate(tiles) if t != BACK]
    backs = [i for i, t in enumerate(tiles) if t == BACK]

    # The none class is checked on its own probability, not by looking for it among `tiles`: classify
    # ranks the tile classes only, so it can never be the argmax there.
    emptiest = max((nothing[i] for i in faces), default=0.0)
    if emptiest >= NOTHING_LIMIT:
        return f"a face-up crop is {emptiest:.0%} not-a-tile"
    if any(confidence[i] <= nothing[i] for i in backs):
        return "a face-down crop is likelier nothing than a back"
    # A meld has to be read outright. Three or four tiles is a short run and the geometry alone is weak
    # evidence — on the first photo tried, a corner of the discard pile fitted four cells and came back
    # as a gang of 1p at 0.00 confidence. There is no partial credit: get one tile wrong and the hand is
    # a different hand.
    lowest = min((confidence[i] for i in faces), default=0.0)
    if lowest < CONFIDENT:
        return f"lowest face-up confidence {lowest:.2f}"
    if backs:
        # A 暗杠 is four tiles with exactly two of them turned over: the way this project photographs one,
        # what the Gemini prompt describes, and what the on-screen instructions ask for.
        #
        # Requiring that shape is a stronger guard than the confidence floor it replaces for these crops,
        # not a weaker one. Without it a run reading [back, back, back, 5p] would be scored as a gang of
        # 5p on the evidence of a single face-up tile — and the point of getting 暗杠 right is that it
        # leaves the hand 门前清, which changes the score.
        if len(backs) != 2 or len(faces) != 2 or len({tiles[i] for i in faces}) != 1:
            return "face-down tiles but not a readable 暗杠"
        tiles = [tiles[faces[0]]] * 4
    kind = meld_kind(tiles)
    if kind is None:
        return "not a 吃, 碰 or 杠"
    return Meld(kind, tiles, not backs)


class Candidate(NamedTuple):
    """One reading of a run: what the grid fit and the classifier made of it at some tile count."""

    score: float  # mean classifier confidence, which is how two readings of the same run are ranked
    pitch: float
    tiles: list[str]
    confidence: list[float]
    nothing: list[float]


def choose_meld(candidates: list[Candidate], hand_pitch: float) -> Meld | str:
    """The best-scoring reading that is actually a meld, or why none of them was.

    Every candidate is checked before any is chosen, which is not how this started. Picking the
    highest-scoring reading first and validating it afterwards loses a valid meld whenever an invalid
    reading happens to score higher — and one systematically does: a three-tile 碰 also fits four cells,
    at three quarters of the true pitch, and a misaligned crop can still be confidently *something*. The
    four-cell reading then wins on score, fails the pitch check, and the run is dropped although the
    three-cell reading of it was correct. Same silent loss the rest of this change is about.
    """
    reasons = []
    best = None
    for candidate in candidates:
        ratio = candidate.pitch / hand_pitch
        if not MIN_PITCH_MATCH <= ratio <= MAX_PITCH_MATCH:
            reasons.append(
                f"{len(candidate.tiles)} tiles at pitch {candidate.pitch:.1f}px is {ratio:.0%}"
                f" of the hand's {hand_pitch:.1f}px, not the same tiles"
            )
            continue
        verdict = judge_meld(candidate.tiles, candidate.confidence, candidate.nothing)
        if isinstance(verdict, str):
            reasons.append(f"{candidate.tiles} — {verdict}")
            continue
        if best is None or candidate.score > best[0]:
            best = (candidate.score, verdict)
    if best is not None:
        return best[1]
    return "; ".join(reasons) if reasons else "no grid of three or four tiles fits it"


class Direction(NamedTuple):
    """Which way along the run the hand reads, and whether that was actually established."""

    reverse: bool
    known: bool
    why: str


def reading_order(
    hand_box: tuple[int, int, int, int], meld_boxes: list[tuple[int, int, int, int]]
) -> Direction:
    """Whether the sliced tiles have to be reversed so the winning tile lands last.

    The calculator takes the last element of the concealed array as the winning tile, and the
    photographer's convention puts that tile at the right-hand end of the standing hand with the melds
    beyond it. So the run has to be handed over finishing at whichever end is physically the right one.

    Two independent ways to tell, because either alone has a hole:

    The melds settle it whatever way the phone was held — they sit past the right end of the hand, so the
    end they are nearer is the right end. Only the ones roughly in line with the hand count: in the one
    real photo the discard pile is also a run of four, and it sits off to the side, so it would point the
    wrong way if any blob were allowed to vote.

    Failing that, the frame itself: a hand lying across the frame reads left to right, which is what
    slicing along +x already gives. That needs the photo to be the right way up, and it is the weaker of
    the two — a hand lying *up* the frame says nothing about which end is which, and rather than guess
    there, this reports that it does not know. A wrong winning tile is a wrong score; an admitted unknown
    is one tap in the review screen.
    """
    x, y, w, h = hand_box
    vertical = h >= w
    start, end = (y, y + h) if vertical else (x, x + w)
    across_middle = (x + w / 2) if vertical else (y + h / 2)
    across_span = w if vertical else h

    in_line = []
    for box_x, box_y, box_w, box_h in meld_boxes:
        theirs_across = (box_x + box_w / 2) if vertical else (box_y + box_h / 2)
        if abs(theirs_across - across_middle) <= across_span:
            in_line.append((box_y + box_h / 2) if vertical else (box_x + box_w / 2))

    if in_line:
        melds_at = sum(in_line) / len(in_line)
        at_start = abs(melds_at - start) < abs(melds_at - end)
        upright = "" if vertical else f", and the frame {'disagrees' if at_start else 'agrees'}"
        return Direction(at_start, True, f"{len(in_line)} meld(s) in line{upright}")
    if not vertical:
        return Direction(False, True, "no melds in line; the hand lies across the frame")
    return Direction(False, False, "no melds in line and the hand lies up the frame")


def read_melds(
    model: ort.InferenceSession,
    bgr: np.ndarray,
    light: np.ndarray,
    meld_boxes: list[tuple[float, tuple[int, int, int, int]]],
    hand_box: tuple[int, int, int, int],
    hand_pitch: float,
    size: int,
    labels: list[str],
) -> tuple[list[Meld], list[str]]:
    """Reads the runs of three or four set aside beside the hand, as (kind, tiles, isOpen).

    Two distinctions here decide the score rather than just the display:

    A 暗杠 is four tiles with two of them turned face down. It is *not* 副露 — it leaves the hand
    concealed and 门前清 intact — so it carries isOpen false, while 吃, 碰 and 明杠 all carry true.
    That is the whole reason the face-down tile is its own class instead of part of "not a tile".

    The two turned-over tiles of a 暗杠 cannot be read, and do not need to be: a gang is four of one
    tile, so the pair that is face up names all four.
    """
    found, notes = [], []
    for _, box in meld_boxes:
        if box == hand_box:
            continue
        # Each meld length asked for by name. See the note on `expect` in read_line for why the blind
        # fit is not good enough on a run this short.
        candidates = []
        for length in MELD_SIZES:
            fit = read_line(model, bgr, light, box, size, refine=True, counts=(length,), expect=length)
            if fit is None:
                continue
            score, _, pitch, _, confidence, predicted, nothing = fit
            candidates.append(
                Candidate(
                    score,
                    pitch,
                    [labels[int(g)] for g in predicted],
                    [float(c) for c in confidence],
                    [float(n) for n in nothing],
                )
            )
        verdict = choose_meld(candidates, hand_pitch)
        if isinstance(verdict, str):
            if candidates:
                notes.append(f"a run at {box} was not read as a meld: {verdict}")
            continue
        found.append(verdict)
    return found, notes


def sheet(crops: np.ndarray, confidence: list[float], tiles: list[str], path: Path) -> None:
    cell = 110
    out = np.full((len(crops) * (cell + 18), cell + 230, 3), 255, np.uint8)
    for i, crop in enumerate(crops):
        y = i * (cell + 18)
        out[y : y + cell, :cell] = cv2.resize(crop, (cell, cell))
        sure = confidence[i]
        colour = (0, 140, 0) if sure >= CONFIDENT else (0, 0, 190)
        cv2.putText(
            out,
            f"{i + 1}. {tiles[i]} {sure:.2f}",
            (cell + 8, y + cell // 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            colour,
            2,
            cv2.LINE_AA,
        )
    cv2.imwrite(str(path), out)
    print(f"annotated: {path}")


# ── self-check ─────────────────────────────────────────────────────────────
#
# The meld path has never been run against a photograph of a real 副露 or 暗杠, because none has been
# taken. Until one is, this is the only thing between a change here and a silently wrong score.
#
# It checks judge_meld against numbers rather than images, so it cannot tell whether a real 暗杠 would be
# *found* in a photo — only that every decision made once one is found is the right one. The confidences
# below are not invented: the 暗杠 case carries the worst pair of tile backs actually measured, 0.63 and
# 0.67 with 32% and 27% not-a-tile, which is the combination that used to be discarded.


def self_check() -> int:
    good, bad = 0.93, 0.55
    cases = [
        # The regression this was written for. Both the old gates rejected this: 0.63 < 0.8, and 0.32
        # over the not-a-tile limit of 0.3.
        (
            "暗杠, worst real backs",
            ["5p", "5p", BACK, BACK],
            [good, 0.94, 0.63, 0.67],
            [0.01, 0.01, 0.32, 0.27],
            Meld("gang", ["5p"] * 4, False),
        ),
        ("明杠", ["7s"] * 4, [good] * 4, [0.01] * 4, Meld("gang", ["7s"] * 4, True)),
        ("碰", ["2z"] * 3, [good] * 3, [0.01] * 3, Meld("ke", ["2z"] * 3, True)),
        (
            "吃",
            ["3m", "4m", "5m"],
            [good] * 3,
            [0.01] * 3,
            Meld("shun", ["3m", "4m", "5m"], True),
        ),
        # Three turned over leaves one face-up tile deciding a whole gang. Refused on shape, which is
        # what keeps the looser rule for backs from being a way in.
        ("three backs", ["5p", BACK, BACK, BACK], [good, 0.9, 0.9, 0.9], [0.01] * 4, None),
        ("backs, faces disagree", ["5p", "6p", BACK, BACK], [good, good, 0.9, 0.9], [0.01] * 4, None),
        ("face-up too uncertain", ["5p", "5p", BACK, BACK], [good, bad, 0.9, 0.9], [0.01] * 4, None),
        # A back has to beat `none`, and this one does not — a patch of felt rather than a tile.
        (
            "back is likelier nothing",
            ["5p", "5p", BACK, BACK],
            [good, good, 0.2, 0.9],
            [0.01, 0.01, 0.7, 0.01],
            None,
        ),
        ("face-up is nothing", ["1p"] * 3, [good] * 3, [0.5, 0.01, 0.01], None),
        ("three tiles, no meld", ["1m", "9p", "1z"], [good] * 3, [0.01] * 3, None),
        # 吃 needs one suit and three consecutive ranks; neither of these is a meld.
        ("same suit, not consecutive", ["1m", "3m", "5m"], [good] * 3, [0.01] * 3, None),
        ("consecutive, mixed suits", ["3m", "4p", "5s"], [good] * 3, [0.01] * 3, None),
    ]
    failures = 0
    for name, tiles, confidence, nothing, expected in cases:
        got = judge_meld(tiles, confidence, nothing)
        ok = got == expected if expected else isinstance(got, str)
        failures += not ok
        shown = got if not isinstance(got, str) else f"rejected: {got}"
        print(f"  {'ok  ' if ok else 'FAIL'} {name:26s} -> {shown}")

    # And the choice between two readings of the same run. The pitch is what separates them: a three-tile
    # 碰 also fits four cells, at three quarters of the true pitch, so only one of the two can match the
    # hand. The four-cell reading is given the higher score on purpose — that is the case where choosing
    # first and validating afterwards throws the correct reading away.
    hand_pitch = 100.0
    valid = Candidate(0.90, 100.0, ["2z"] * 3, [good] * 3, [0.01] * 3)
    wrong_pitch = Candidate(0.97, 75.0, ["2z", "2z", "2z", "1m"], [good] * 4, [0.01] * 4)
    not_a_meld = Candidate(0.99, 100.0, ["1m", "9p", "1z"], [good] * 3, [0.01] * 3)
    choices = [
        ("higher score, wrong pitch", [wrong_pitch, valid], Meld("ke", ["2z"] * 3, True)),
        ("higher score, not a meld", [not_a_meld, valid], Meld("ke", ["2z"] * 3, True)),
        ("both invalid", [wrong_pitch, not_a_meld], None),
        ("nothing fitted at all", [], None),
    ]
    for name, candidates, expected in choices:
        got = choose_meld(candidates, hand_pitch)
        ok = got == expected if expected else isinstance(got, str)
        failures += not ok
        shown = got if not isinstance(got, str) else f"rejected: {got[:60]}"
        print(f"  {'ok  ' if ok else 'FAIL'} {name:26s} -> {shown}")

    # And which way round the run reads. Boxes are (x, y, w, h). The hand is 700 long and 100 across.
    across = (300, 100, 100, 700)  # lies up the frame
    along = (100, 300, 700, 100)  # lies across the frame
    orders = [
        # A meld past the far end means the run already finishes at the right end.
        ("melds past the end", across, [(300, 850, 100, 220)], (False, True)),
        ("melds past the start", across, [(300, 30, 100, 220)], (True, True)),
        # The discard pile in the real photo is also a run of four, sitting off to the side. Letting any
        # blob vote would point the wrong way, so out-of-line boxes are ignored.
        ("off to the side, ignored", across, [(900, 30, 100, 220)], (False, False)),
        ("side blob plus a real meld", across, [(900, 30, 100, 220), (300, 850, 100, 220)], (False, True)),
        # No melds: the frame decides, and only when the hand lies across it.
        ("no melds, hand across frame", along, [], (False, True)),
        ("no melds, hand up frame", across, [], (False, False)),
    ]
    for name, hand, meld_boxes, expected in orders:
        got = reading_order(hand, meld_boxes)
        ok = (got.reverse, got.known) == expected
        failures += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} {name:26s} -> reverse={got.reverse} known={got.known}")

    total = len(cases) + len(choices) + len(orders)
    print(f"\n{total - failures}/{total} correct")
    return failures


if __name__ == "__main__":
    import sys

    if "--self-check" in sys.argv:
        sys.exit(1 if self_check() else 0)
    main()
