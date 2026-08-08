"""Cuts the calibration photos into one labelled crop per tile.

Everything downstream needs these crops: they are the only images of *these* tile sets that come with
certain labels, so they seed the synthetic training data for the face classifier.

There are two photos, one per set and table, and both lay the whole set out the same way — four butted
columns of nine, the tiles a quarter turn over, seven honours and two tile backs filling the last
column. So one routine reads both, and the only thing that differs is the labels and how dark the
background is.

**The layout is read off the photo, not assumed.** The two sets were arranged independently and agree
about nothing: the first runs its numbers down the column and its honours 東西南北白發中, the second
runs them up and its honours 東南西北中發白. The obvious guess — that both use the canonical 東南西北 —
is wrong for the first one. Both orders here were read back by having the classifier name all 36 cells
and checking the result was a legal permutation of the set, which is also how the arrangement of a
re-shot photo should be settled. Nothing in the tables below is derived from anything else, either:
the one bug this code has had was a derivation, "the low numbers are at the bottom", applied twice so
that the two reversals cancelled and put 9m at the foot of the column.

The columns are butted, so they are divided evenly. The rows within a column are not: the block's
extent overstates them, because the row nearest the camera shows its front bevel as well as its face,
and dividing that evenly walks every boundary down the column until the last crop straddles two tiles.
So the rows come from a periodic fit — see grid_fit.py — told how many to expect.

Leftover background matters more than the small amount of it suggests, because there are only two
source images per class — so any artefact that survives is a *near-perfect* cue for that class, and one
the classifier will happily learn instead of the tile pattern. It would then collapse on real photos,
which have no such artefact. Hence the trim and the edge audit this prints. The contact sheet is still
the arbiter, though: every problem found in the cut so far was spotted by eye before any check caught
it, and each check written afterwards caught only the one kind it was written for.

A mask is written alongside each crop, because pasting a cut-out tile onto random backgrounds is what
stops the classifier depending on these two tables.
"""

import shutil
import sys
from pathlib import Path
from typing import NamedTuple

import cv2
import numpy as np

from grid_fit import fit_grid
from synthesize import BACK

ROOT = Path(__file__).resolve().parents[1]
CALIBRATION = ROOT / "server/src/main/resources/calibration"
OUT = Path(__file__).resolve().parent / "data"


def ascending(suit: str) -> list[str]:
    """The suit as it reads top to bottom when the low numbers are at the top."""
    return [f"{n}{suit}" for n in range(1, 10)]


def descending(suit: str) -> list[str]:
    return [f"{n}{suit}" for n in range(9, 0, -1)]


class Photo(NamedTuple):
    """One calibration photo: its columns left to right, each labelled top to bottom."""

    name: str
    source: str
    columns: list[list[str]]
    # A tile back is admitted on lightness alone rather than being required to be neutral, because one
    # of them is strongly coloured: on the green table it measures a chroma of 48, further from grey
    # than the felt is. Only needed where the background is dark enough for that to be safe, which is
    # why the brown photo leaves it off — see TILE_LIGHTNESS.
    back_lightness: int | None


PHOTOS = [
    Photo(
        name="system_mahjong_calibration.jpg",
        source="brown",
        columns=[
            ["1z", "3z", "2z", "4z", "7z", "6z", "5z", BACK, BACK],  # 東西南北白發中
            ascending("s"),
            ascending("p"),
            ascending("m"),
        ],
        back_lightness=None,
    ),
    Photo(
        name="system_mahjong_calibration_2.jpg",
        source="green",
        columns=[
            descending("m"),
            descending("s"),
            descending("p"),
            [BACK, BACK, "7z", "6z", "5z", "4z", "3z", "2z", "1z"],  # 白發中北西南東
        ],
        back_lightness=110,
    ),
]

# A tile face is near-white: bright, and far less coloured than green felt or a brown table. This one
# threshold covers both photos, which are lit very differently — the faces measure L 157 on the dimmer
# one and the backgrounds 59 and below.
TILE_LIGHTNESS = 150
TILE_CHROMA = 30

# Closing joins the faces of a column into one block across the shadow seams between them. It also
# rounds the block's corners outward by about its own width, which is why the extent below is taken
# from where the mask covers the run rather than from the blob's bounding box: twenty pixels of drift
# over four columns is enough to put the last crop on the table.
CLOSE = 21
COVERED = 0.5

# Two tiles do not meet at a line but across a band of roughly 8-14px: one tile's lit side, the shadow
# between them, then the next tile's lit side. A cell boundary lands inside that band, so every edge is
# inset past it. Uniformly on all four sides — the fit puts the boundaries within a pixel or two, so
# there is nothing here that needs edge-by-edge treatment.
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


def tile_mask(bgr: np.ndarray, back_lightness: int | None) -> np.ndarray:
    """True where the photo shows a tile rather than the table.

    Thresholding finds the white of a face but leaves the engraved characters as holes, and those are
    not all small — the bird of 1s is wider than any closing kernel that would still be safe to use
    here. What separates a character from the table is topology rather than size: a character is
    enclosed by the face around it, while the table reaches the edge of the photo. So every dark region
    the border cannot reach is filled back in. Holes matter beyond tidiness, because the mask is an
    alpha channel when the crops are composited: left open, the background of a synthetic sample shows
    through the strokes of the character that is the whole label.
    """
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    lightness = lab[:, :, 0].astype(np.int16)
    chroma = np.hypot(lab[:, :, 1].astype(np.int16) - 128, lab[:, :, 2].astype(np.int16) - 128)
    solid = (lightness > TILE_LIGHTNESS) & (chroma < TILE_CHROMA)
    if back_lightness is not None:
        solid |= lightness > back_lightness

    _, regions = cv2.connectedComponents((~solid).astype(np.uint8))
    touching_border = np.unique(
        np.concatenate([regions[0], regions[-1], regions[:, 0], regions[:, -1]])
    )
    filled = solid | ~np.isin(regions, touching_border)
    kernel = np.ones((CLOSE, CLOSE), np.uint8)
    return cv2.morphologyEx(filled.astype(np.uint8), cv2.MORPH_CLOSE, kernel)


def extent(mask: np.ndarray, axis: int) -> tuple[int, int]:
    """Start and length of the stretch the mask actually covers, along one axis."""
    on = np.flatnonzero((mask > 0).mean(axis=axis) > COVERED)
    if on.size == 0:
        sys.exit("the calibration photo has no run of tiles along one of its axes")
    return int(on[0]), int(on[-1]) - int(on[0]) + 1


def slice_photo(photo: Photo) -> list[tuple[str, np.ndarray, np.ndarray]]:
    """Writes every cell of one photo, returning each crop with the name it was written under."""
    bgr = cv2.imread(str(CALIBRATION / photo.name))
    if bgr is None:
        sys.exit(f"cannot read {CALIBRATION / photo.name}")
    mask = tile_mask(bgr, photo.back_lightness)

    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
    if count < 2:
        sys.exit(f"no tiles found in {photo.name}")
    block = max(range(1, count), key=lambda i: stats[i][4])
    _, y, _, h = (int(v) for v in stats[block][:4])
    # The block's own bounding box is not the tiles: on the brown photo the mask reaches past the last
    # row down to the bottom of the frame. Both axes come from the coverage instead.
    left, width = extent(mask[y : y + h], 0)
    top, height = extent(mask[:, left : left + width], 1)

    light = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)
    column_width = width // len(photo.columns)
    seen: dict[str, int] = {}
    cells = []
    for index, labels in enumerate(photo.columns):
        x0 = left + index * column_width
        # The vertical extent is taken from the column itself, because the block tilts by about a
        # degree and the four columns do not begin and end together. Where the mask overshoots, that
        # extent is a whole tile too long and no grid of nine fits it; the block's extent is the
        # fallback. Both photos need this and for opposite columns, so neither choice alone will do.
        #
        # Trying them and letting the fit decide is safe because `expect` pins the pitch to within ten
        # percent of the box divided by nine: a box a tile too long cannot come back with nine tiles.
        # The mask fails at the tile backs, which figures — they are the two cells least like a face.
        for box in (extent(mask[:, x0 : x0 + column_width], 1), (top, height)):
            column = (x0, box[0], column_width, box[1])
            fit = fit_grid(light, column, vertical=True, expect=len(labels))
            if fit is not None and fit[2] == len(labels):
                pitch, offset, row_top = fit[0], fit[1], box[0]
                break
        else:
            sys.exit(f"{photo.name} column {index + 1}: no grid of {len(labels)} tiles fits it")
        for row, label in enumerate(labels):
            y0 = row_top + int(offset + row * pitch)
            box = (
                slice(y0 + NEIGHBOUR_EDGE, y0 + int(pitch) - NEIGHBOUR_EDGE),
                slice(x0 + NEIGHBOUR_EDGE, x0 + column_width - NEIGHBOUR_EDGE),
            )
            crop, piece = bgr[box], mask[box]
            if crop.size == 0:
                sys.exit(f"{photo.name} column {index + 1} row {row + 1}: empty crop")
            rows, columns = trim(piece > 0)
            crop, piece = crop[rows, columns], piece[rows, columns] > 0
            seen[label] = seen.get(label, 0) + 1
            # Numbered per label rather than per cell: the tile backs are the one label a photo holds
            # twice, and naming them by position would make the filenames move if the layout changed.
            source = f"{photo.source}{seen[label]}"
            write_variant(label, source, crop, piece)
            cells.append((f"{label}/{source}", crop, piece))
        print(f"{photo.name} column {index + 1}: x {x0}, pitch {pitch:.1f}px, {len(labels)} tiles")
    return cells


def write_variant(label: str, source: str, crop: np.ndarray, mask: np.ndarray) -> None:
    """One appearance of one tile. A label can have several — see the note in synthesize.py."""
    for directory, image in (("faces", crop), ("masks", mask.astype(np.uint8) * 255)):
        path = OUT / directory / label
        path.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(path / f"{source}.png"), image)


def main() -> None:
    faces, masks = OUT / "faces", OUT / "masks"
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

    Earlier versions measured this as dark or bright pixels along the edge and needed a threshold for
    each, plus an exemption for the tile's own lit bevel. On a butted grid that was the wrong question:
    every interior crop has a neighbouring tile on all four sides, so its edges are *supposed* to be
    bright or dark, and a third of the crops flagged on their own ink. A sliver of neighbouring tile is
    also the least harmful thing that can be left behind — the synthesiser deliberately pastes other
    tiles around a face, because in a real hand that is what surrounds one.

    What does matter is table or felt, which is a perfect cue for whichever class kept it, and the mask
    already separates that from tile without a second threshold. Only the cells around the rim of the
    block can show any, which is exactly where the fit is least certain.
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
    path = OUT / "faces_contact_sheet.png"
    cv2.imwrite(str(path), sheet)
    print(f"contact sheet: {path}")


if __name__ == "__main__":
    main()
