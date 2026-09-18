"""Cuts the calibration photos into one labelled crop per tile.

Everything downstream needs these crops: they are the only images of *these* tile sets that come with certain
labels, so they seed the synthetic training data for the face classifier.

Six photos, for two sets of tiles on two tables: two full sets laid out as a 4x9 grid, and four of tile backs
only, because the backs needed far more examples than the grids gave. A photo is described by its rows of
labels, optionally a quarter turn, and which of the two mask rules applies.

**The layout is read off the photo, not assumed.** Both grid photos have been re-shot twice and the arrangement
changed each time, so the layout lives in a table here. The honours order runs 東西南北白發中, *not* the
canonical 東南西北 — guessing it mislabels four classes silently. Each layout was read back by having a model
trained before the re-shoot name all 36 cells and checking the answer is a legal permutation of the set.

Rows come from dividing the block evenly and the nine cells of each row from a periodic fit — see
recognition/grid_fit.py. Nine tiles give a row eight interior boundaries to fit; four give a column three, and
fitting that way answered pitches from 190 to 215 on one photo and twice claimed three tiles instead of four.

Leftover background matters more than its area suggests: a class has only a handful of source images, so any
artefact that survives is a near-perfect cue the classifier will learn instead of the tile. Hence the trim and
the edge audit. The contact sheet is still the arbiter — every problem in the cut so far was spotted by eye
first. A mask is written alongside each crop, so pasting the cut-out onto random backgrounds is possible.
"""

import shutil
import sys
from pathlib import Path
from typing import NamedTuple

import cv2
import numpy as np

from recognition.grid_fit import fit_grid
from recognition.tiles import BACK, DATA, FACES, MASKS

ROOT = Path(__file__).resolve().parents[1]
CALIBRATION = ROOT / "server/src/main/resources/calibration"


class Photo(NamedTuple):
    """One calibration photo: its rows top to bottom, each labelled left to right."""

    name: str
    source: str
    rows: list[list[str]]
    # Applied before anything else, so `rows` can always describe the photo as rows. The tile-back
    # photos are single files of four tiles stacked vertically, which is one row once turned. Rotating
    # costs nothing and loses nothing: all four quarter turns of a face are the same class anyway.
    quarter_turns: int = 0
    # Whether the photo shows tile backs rather than faces. It picks which of the two mask rules below
    # applies, and the two are not interchangeable — see back_mask.
    blank: bool = False
    # Only for a photo whose grid contains a tile back too dark for the face rule. On the green table
    # that back measures L 118 at a chroma of 52, further from grey than the felt around it, so the face
    # rule keeps none of it — and a cell with an empty mask is worse than no cell at all, because the
    # synthesiser composites through the mask and would paste pure background under that label.
    back_lightness: int | None = None


# Both calibration photos currently agree on this. Kept as one table because they do, and named per
# photo because they have not always: whichever is re-shot next has to be re-read, not assumed to match.
LAYOUT = [
    [f"{n}m" for n in range(1, 10)],  # 一萬 to 九萬
    [f"{n}p" for n in range(1, 10)],  # 1饼/筒 to 9饼/筒
    [f"{n}s" for n in range(1, 10)],  # 1条/索 to 9条/索
    ["1z", "3z", "2z", "4z", "7z", "6z", "5z", BACK, BACK],  # 東西南北白發中, then the two backs
]

# Four tiles butted in a line, all of them the same back. Two back colours per set, one file each.
BACK_RUN = [[BACK] * 4]

PHOTOS = [
    Photo("system_mahjong_calibration.jpg", "brown", LAYOUT),
    Photo("system_mahjong_calibration_2.jpg", "green", LAYOUT, back_lightness=105),
    Photo("system_mahjong_calibration_back_1.jpg", "brown_cream", BACK_RUN, 1, blank=True),
    Photo("system_mahjong_calibration_back_2.jpg", "brown_blue", BACK_RUN, 1, blank=True),
    Photo("system_mahjong_calibration_2_back_1.jpg", "green_blue", BACK_RUN, 1, blank=True),
    Photo("system_mahjong_calibration_2_back_2.jpg", "green_cream", BACK_RUN, 1, blank=True),
]

# A tile face is near-white: bright, and far less coloured than green felt or a brown table.
TILE_LIGHTNESS = 150
TILE_CHROMA = 30

# For the tile-back photos, brightness plus *smoothness* — glossy plastic against fabric that shows its weave.
#
# Colour does not survive a change of light: the same brown carpet measures a chroma of 37 in one back photo
# and 11 in another, where the *tile* is the more coloured at 42. Lightness alone is no better — the carpet
# reaches L 147 and the tile starts at 149. Local variation separates all four with room to spare, a back at
# 2 to 6 against felt and carpet at 4 to 19, and it is a property of the material rather than of the light.
#
# It does *not* generalise to the faces: engraving is exactly what local variation measures, and applied to
# the grids it kept as little as 4% of a 条 face.
BACK_VARIATION = 8
VARIATION_WINDOW = 9

# Closing joins the faces of a column into one block across the shadow seams. It also rounds the corners
# outward by its own width, which is why the extent below comes from mask coverage, not the bounding box.
CLOSE = 21
COVERED = 0.5

# Two tiles meet across a band of roughly 8-14px — one lit side, the shadow, the next lit side — and a cell
# boundary lands inside it, so every edge is inset past it.
NEIGHBOUR_EDGE = 8

# For the trim below: a row or column of a cell has to be this much tile to be kept.
MIN_COVERAGE = 0.9


def solid_run(coverage: np.ndarray) -> slice:
    """The stretch of full-coverage lines around the middle, cut short at the first thin one."""
    middle = len(coverage) // 2
    thin = coverage < MIN_COVERAGE
    before = np.flatnonzero(thin[:middle])
    after = np.flatnonzero(thin[middle:])
    start = int(before[-1]) + 1 if before.size else 0
    end = middle + int(after[0]) if after.size else len(coverage)
    return slice(start, end)


def trim(mask: np.ndarray) -> tuple[slice, slice]:
    """Shrinks a cell to the part the mask calls tile.

    Only ever shrinks, and on all but a handful of cells it does nothing at all: the tiles are butted,
    so an interior cell is surrounded by tile and the mask is solid across it. It earns its place around
    the rim of the block, where the columns are divided evenly but the block sits a degree off square,
    so the corner cells reach past the tiles onto the table. Left in, that strip is a *perfect* cue for
    whichever class kept it — and the two it kept were the tile backs, which have the fewest appearances
    of any class to dilute it.
    """
    rows = solid_run(mask.mean(axis=1))
    return rows, solid_run(mask[rows].mean(axis=0))


def local_variation(lightness: np.ndarray) -> np.ndarray:
    """Standard deviation of lightness in a small window around every pixel."""
    values = lightness.astype(np.float32)
    window = (VARIATION_WINDOW, VARIATION_WINDOW)
    mean = cv2.boxFilter(values, -1, window)
    mean_square = cv2.boxFilter(values * values, -1, window)
    return np.sqrt(np.maximum(mean_square - mean * mean, 0))


def close(solid: np.ndarray) -> np.ndarray:
    return cv2.morphologyEx(solid.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((CLOSE, CLOSE), np.uint8))


def back_mask(bgr: np.ndarray) -> np.ndarray:
    """True where the photo shows a tile back: bright and smooth. See BACK_VARIATION."""
    lightness = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0]
    bright = lightness.astype(np.int16) > TILE_LIGHTNESS
    return close(bright & (local_variation(lightness) < BACK_VARIATION))


def face_mask(bgr: np.ndarray, back_lightness: int | None) -> np.ndarray:
    """True where the photo shows a tile face rather than the table.

    Thresholding leaves the engraved characters as holes, and the bird of 1s is wider than any safe closing
    kernel. What separates a character from the table is topology, not size — a character is enclosed by the
    face, the table reaches the edge of the photo — so every dark region the border cannot reach is filled
    back in. Left open, the background of a synthetic sample shows through the strokes that are the label.
    """
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    lightness = lab[:, :, 0].astype(np.int16)
    chroma = np.hypot(lab[:, :, 1].astype(np.int16) - 128, lab[:, :, 2].astype(np.int16) - 128)
    solid = (lightness > TILE_LIGHTNESS) & (chroma < TILE_CHROMA)
    if back_lightness is not None:
        solid |= lightness > back_lightness

    _, regions = cv2.connectedComponents((~solid).astype(np.uint8))
    touching_border = np.unique(np.concatenate([regions[0], regions[-1], regions[:, 0], regions[:, -1]]))
    return close(solid | ~np.isin(regions, touching_border))


def extent(mask: np.ndarray, axis: int) -> tuple[int, int]:
    """Start and length of the stretch the mask actually covers, along one axis."""
    on = np.flatnonzero((mask > 0).mean(axis=axis) > COVERED)
    if on.size == 0:
        sys.exit("the calibration photo has no run of tiles along one of its axes")
    return int(on[0]), int(on[-1]) - int(on[0]) + 1


def block(mask: np.ndarray) -> tuple[int, int, int, int]:
    """The rectangle the grid of tiles occupies.

    Not the largest blob's own bounding box: closing rounds the mask outward, and on one photo it also
    reached past the last row down to the bottom of the frame. Both axes come from where the mask
    actually covers the run instead.
    """
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
    if count < 2:
        sys.exit("no tiles found in the calibration photo")
    largest = max(range(1, count), key=lambda i: stats[i][4])
    _, y, _, h = (int(v) for v in stats[largest][:4])
    left, width = extent(mask[y : y + h], 0)
    top, height = extent(mask[:, left : left + width], 1)
    return left, top, width, height


def slice_photo(photo: Photo) -> list[tuple[str, np.ndarray, np.ndarray]]:
    """Writes every cell of one photo, returning each crop with the name it was written under."""
    bgr = cv2.imread(str(CALIBRATION / photo.name))
    if bgr is None:
        sys.exit(f"cannot read {CALIBRATION / photo.name}")
    if photo.quarter_turns:
        bgr = np.rot90(bgr, photo.quarter_turns).copy()
    mask = back_mask(bgr) if photo.blank else face_mask(bgr, photo.back_lightness)
    left, top, width, height = block(mask)

    light = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)
    band = height / len(photo.rows)
    seen: dict[str, int] = {}
    cells = []
    for index, labels in enumerate(photo.rows):
        y0 = top + int(index * band)
        depth = int(band)
        # The row's horizontal extent is taken from the row itself, so a row shorter than the others is
        # not divided across bare table. Where the mask overshoots it, no grid of nine fits and the
        # block's extent is the fallback; letting the fit decide is safe because `expect` pins the pitch
        # to within ten percent of the box divided by nine, so a box a tile too long cannot answer nine.
        for span in (extent(mask[y0 : y0 + depth], 0), (left, width)):
            fit = fit_grid(light, (span[0], y0, span[1], depth), vertical=False, expect=len(labels))
            if fit is not None and fit[2] == len(labels):
                pitch, offset, x_start = fit[0], fit[1], span[0]
                break
        else:
            sys.exit(f"{photo.name} row {index + 1}: no grid of {len(labels)} tiles fits it")
        for column, label in enumerate(labels):
            x0 = x_start + int(offset + column * pitch)
            box = (
                slice(y0 + NEIGHBOUR_EDGE, y0 + depth - NEIGHBOUR_EDGE),
                slice(x0 + NEIGHBOUR_EDGE, x0 + int(pitch) - NEIGHBOUR_EDGE),
            )
            crop, piece = bgr[box], mask[box]
            if crop.size == 0:
                sys.exit(f"{photo.name} row {index + 1} column {column + 1}: empty crop")
            rows, columns = trim(piece > 0)
            crop, piece = crop[rows, columns], piece[rows, columns] > 0
            seen[label] = seen.get(label, 0) + 1
            # Numbered per label rather than per cell: the tile backs are the one label a photo holds
            # twice, and naming them by position would make the filenames move if the layout changed.
            source = f"{photo.source}{seen[label]}"
            write_variant(label, source, crop, piece)
            cells.append((f"{label}/{source}", crop, piece))
        print(f"{photo.name} row {index + 1}: y {y0}, pitch {pitch:.1f}px, {len(labels)} tiles")
    return cells


def write_variant(label: str, source: str, crop: np.ndarray, mask: np.ndarray) -> None:
    """One appearance of one tile. A label can have several — see the note in training/synthesize.py."""
    for directory, image in (("faces", crop), ("masks", mask.astype(np.uint8) * 255)):
        path = DATA / directory / label
        path.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(path / f"{source}.png"), image)


def main() -> None:
    faces, masks = FACES, MASKS
    # Cleared rather than written over. These directories are the classifier's entire training input,
    # and a crop left behind from a photo that has since been re-shot goes on training it silently.
    for directory in (faces, masks):
        shutil.rmtree(directory, ignore_errors=True)
        directory.mkdir(parents=True, exist_ok=True)

    cells = []
    for photo in PHOTOS:
        cells += slice_photo(photo)
    print(f"\nwrote {len(cells)} crops to {faces} and masks to {masks}")
    audit(cells)
    contact_sheet(cells)


def audit(cells: list[tuple[str, np.ndarray, np.ndarray]]) -> None:
    """Reports how much of each crop's edge is background rather than tile, and the sizes with it.

    Measured against the mask rather than by dark or bright pixels along the edge: on a butted grid every
    interior crop has a neighbouring tile on all four sides, so its edges are *supposed* to be bright or dark,
    and a third of the crops flagged on their own ink. A sliver of neighbouring tile is harmless anyway — the
    synthesiser pastes other tiles around a face on purpose. Table or felt is what matters.
    """
    print("\n              size      background% t/b/l/r")
    for label, crop, mask in cells:
        edges = (mask[:4, :], mask[-4:, :], mask[:, :4], mask[:, -4:])
        background = [(1 - edge.mean()) * 100 for edge in edges]
        flag = " <-- check" if max(background) > 10 else ""
        print(
            f"  {label:11s} {crop.shape[1]:3d}x{crop.shape[0]:<3d}  "
            + " ".join(f"{v:4.0f}" for v in background)
            + flag
        )


def contact_sheet(cells: list[tuple[str, np.ndarray, np.ndarray]], cell: int = 120) -> None:
    """One image with every crop labelled, so the cut can be checked in a single look."""
    per_row = 9
    rows = (len(cells) + per_row - 1) // per_row
    sheet = np.full((rows * (cell + 22), per_row * cell, 3), 255, np.uint8)
    for i, (label, crop, _) in enumerate(cells):
        r, c = divmod(i, per_row)
        h, w = crop.shape[:2]
        scale = min(cell / w, cell / h)
        thumb = cv2.resize(crop, (int(w * scale), int(h * scale)))
        y, x = r * (cell + 22), c * cell
        sheet[y : y + thumb.shape[0], x : x + thumb.shape[1]] = thumb
        cv2.putText(
            sheet,
            f"{label} {w}x{h}",
            (x + 2, y + cell + 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.38,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )
    path = DATA / "faces_contact_sheet.png"
    cv2.imwrite(str(path), sheet)
    print(f"contact sheet: {path}")


if __name__ == "__main__":
    main()
