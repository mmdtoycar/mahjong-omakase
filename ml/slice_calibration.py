"""Cuts the 34-face calibration photo into one labelled crop per tile.

Everything downstream needs these crops: they are the only images of *this* tile set that come with
certain labels, so they seed the synthetic training data for the face classifier.

Finding the rows takes one non-obvious observation. The tiles are butted together with no gap, so
there is no dark seam to look for — between two rows the photo is actually *brighter* than a tile
face, because the lower tile's bevelled top edge catches the light. Those bevels show up as four
sharp spikes in the vertical lightness profile, one per row, and that is what the rows are found by.

Within a row the tiles are butted too, so the row is divided by its known tile count and each
nominal box is then trimmed down to the largest rectangle containing no table. That trimming is not
cosmetic. The rows tilt by about a degree and the last row is shorter than the rest, so a single
rectangle per row leaves bare table inside the boxes at the ends of a row: 9s came out with its
bottom row of bamboo cut off, which would have taught the classifier that a 9s looks like a 6s.

Leftover table matters more than the small amount of it suggests, because there is exactly one
source image per class — so any artefact that survives is a *perfect* cue for that class, and one
the classifier will happily learn instead of the tile pattern. It would then collapse on real
photos, which have no such artefact.

A mask is written alongside each crop. Trimming needs it, and so does the synthetic data: pasting a
cut-out tile onto random backgrounds is what stops the classifier depending on this one table.

One thing the audit still reports and should: 9s keeps a dark strip along its top edge. It is not
table but the shadow where 9p meets it, which the chroma settles — the table runs to a* +13, that
strip to a* -5. Shadow between touching tiles is in every real photo of a hand, so it stays. Telling
the two apart by colour was tried and does not work in general anyway: the red 中 of 5z sits at
a* +12, b* +14, which is the table's colour almost exactly.
"""

import sys
from pathlib import Path

import cv2
import numpy as np

from grid_fit import fit_grid
from synthesize import BACK

ROOT = Path(__file__).resolve().parents[1]
CALIBRATION = ROOT / "server/src/main/resources/calibration/system_mahjong_calibration.jpg"
CALIBRATION_2 = ROOT / "server/src/main/resources/calibration/system_mahjong_calibration_2.jpg"
OUT = Path(__file__).resolve().parent / "data"

# Row layout of the photo, in the order the tiles appear.
ROWS = [
    [f"{n}m" for n in range(1, 10)],  # 一萬 to 九萬
    [f"{n}p" for n in range(1, 10)],  # 1饼 to 9饼
    [f"{n}s" for n in range(1, 10)],  # 1条 to 9条
    [f"{n}z" for n in range(1, 8)],  # 东南西北中發白
]

BEVEL_LIGHTNESS = 175  # a lit edge; tile faces sit near 150-190, the table near 100
MIN_ROW_PITCH = 100  # rows are ~150px apart, so this only ever merges one bevel's own width
FACE_LIGHTNESS = 130  # a tile face is comfortably above this, bare table well below

MASK_LIGHTNESS = 140

MIN_COVERAGE = 0.9  # a row or column of a crop must be this much tile to be kept


# The shadow line where one tile meets the next: dark across nearly the whole width, and unbroken.
# Unbroken is the part that matters. The three circles along the bottom of 9p cover 83% of the width
# — as much as a seam — but they come in separate pieces, and cutting there would have removed a
# whole row of circles and left something a classifier would read as 6p.
SEAM_LIGHTNESS = 170
SEAM_WIDTH_FRACTION = 0.8
# Absolute, not a fraction of the height. A neighbour can only reach ~12px in, and searching deeper
# finds tile markings instead: the bottom bar of 7z's frame sits 18px up and is dark right across,
# so a wider search cut the frame off, and the bottom row of circles on 9p is 23px up.
SEAM_SEARCH_PX = 12

# The lit top edge of the tile below, when a slice of it lands at the bottom of a crop. It is
# brighter than any part of a face — the whitest margin on these tiles averages 205, a bevel 230 —
# which is the only reason it is separable, since a check for dark intrusion never sees it at all.
NEIGHBOUR_BEVEL_MEAN = 215

# Two tiles do not meet at a line but across a band of roughly 8-14px: the left tile's lit side, the
# shadow between them, then the right tile's lit side. Dividing a row evenly puts the cut inside that
# band, which leaves a strip of the left-hand neighbour along every crop's left edge — visible on the
# whole 萬 row and on most of the circles. Trimming cannot find it: on the 萬 row the neighbour's lit
# side is *brighter* than the face beside it and there is no shadow between them at all.
#
# So the edge is simply inset past the band, on the left and at the bottom, and only where there is a
# neighbour to inset past: not the first tile of a row, and not the last row, which has table below
# it that the mask already removed.
#
# Not the right edge, though: a crop's right edge already lands on its own tile, and taking 8px off
# there cuts into the design — the frame of 7z, the bamboo of 5s. Nor the top, where row_tops puts
# the boundary on the row's own lit bevel and the 萬 characters leave little margin to spare.
NEIGHBOUR_EDGE = 8


def tile_mask(bgr: np.ndarray) -> np.ndarray:
    """True where the photo shows a tile face rather than the table.

    Thresholding lightness finds the white of a face but leaves the engraved characters as holes,
    and those are not all small — the bird of 1s is wider than any closing kernel that would still
    be safe to use here. What separates a character from the table is topology rather than size: a
    character is enclosed by the face around it, while the table reaches the edge of the photo. So
    every dark region the border cannot reach is filled back in.
    """
    light = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0]
    solid = light > MASK_LIGHTNESS
    _, regions = cv2.connectedComponents((~solid).astype(np.uint8))
    touching_border = np.unique(
        np.concatenate([regions[0], regions[-1], regions[:, 0], regions[:, -1]])
    )
    return solid | ~np.isin(regions, touching_border)


def row_tops(light: np.ndarray, expected: int) -> list[int]:
    """The y of each row's lit top edge, as peaks in the vertical lightness profile."""
    # Sample the left portion only: the shortest row leaves bare table on the right, which would
    # drag its average down and flatten the peak being looked for.
    profile = light[:, : int(light.shape[1] * 0.7)].mean(axis=1)
    peaks: list[int] = []
    for y in np.flatnonzero(profile > BEVEL_LIGHTNESS):
        if not peaks or y - peaks[-1] > MIN_ROW_PITCH:
            peaks.append(int(y))
        elif profile[y] > profile[peaks[-1]]:
            peaks[-1] = int(y)

    # Brightness alone cannot tell a row's top edge from the bottom edge of the last row: both are
    # lit bevels and here they differ by three units of lightness. What separates them is what
    # follows — a top edge has a tile face under it, a bottom edge has bare table.
    tops = [y for y in peaks if profile[y + 20 : y + 60].mean() > FACE_LIGHTNESS]
    if len(tops) != expected:
        sys.exit(f"expected {expected} row tops, found {len(tops)} in peaks {peaks}")
    return tops


def row_bottom(light: np.ndarray, top: int, next_top: int | None) -> int:
    """A row ends where the next begins, or for the last row where the table goes dark."""
    if next_top is not None:
        return next_top
    below = light[top + MIN_ROW_PITCH :, : int(light.shape[1] * 0.7)].mean(axis=1)
    dark = np.flatnonzero(below < BEVEL_LIGHTNESS * 0.5)
    return top + MIN_ROW_PITCH + int(dark[0]) if dark.size else light.shape[0]


def row_extent(mask: np.ndarray, top: int, bottom: int) -> tuple[int, int]:
    """Horizontal span of the tiles in one row, so a short row is not divided across bare table."""
    on = np.flatnonzero(mask[top:bottom].mean(axis=0) > 0.5)
    return int(on[0]), int(on[-1]) + 1


def solid_run(coverage: np.ndarray, offset: int) -> tuple[int, int]:
    """The stretch of full-coverage lines around the middle, cut short at the first thin one."""
    middle = len(coverage) // 2
    thin = coverage < MIN_COVERAGE
    before = np.flatnonzero(thin[:middle])
    after = np.flatnonzero(thin[middle:])
    start = int(before[-1]) + 1 if before.size else 0
    end = middle + int(after[0]) if after.size else len(coverage)
    return offset + start, offset + end


def runs(flags: np.ndarray) -> int:
    """How many separate stretches of True there are."""
    return int(flags[0]) + int((np.diff(flags.astype(int)) == 1).sum())


def seam_top(light: np.ndarray) -> int | None:
    """Where the tile below starts, if any of it got into this crop.

    A row of tiles is butted against the next, so the bottom of a crop tends to carry a slice of the
    neighbour: its lit top bevel, brighter than the face above it and therefore invisible to any
    check for dark intrusion. The giveaway is the shadow line just before it.

    Worth removing even though every tile in rows 1-3 has one, because the seven honours sit in the
    last row and have no neighbour below. "Has a bright band at the bottom" would then be a cue for
    "is not an honour" — free accuracy on synthetic data, and gone the moment a real photo arrives
    with the honours butted against other tiles.
    """
    height = len(light)
    dark = light < SEAM_LIGHTNESS
    unbroken = np.array([row.mean() > SEAM_WIDTH_FRACTION and runs(row) == 1 for row in dark])
    for y in range(height - 1, max(height - 1 - SEAM_SEARCH_PX, 0), -1):
        if not unbroken[y]:
            continue
        top = y
        while top > 0 and unbroken[top - 1]:
            top -= 1
        return top
    return None


def drop_neighbour_bevel(light: np.ndarray) -> int:
    """Height with any trailing slice of the tile below removed."""
    height = len(light)
    means = light.mean(axis=1)
    while height > 0 and means[height - 1] > NEIGHBOUR_BEVEL_MEAN:
        height -= 1
    return height


def trim(
    light: np.ndarray, mask: np.ndarray, x0: int, x1: int, y0: int, y1: int
) -> tuple[int, int, int, int]:
    """Shrinks a nominal box to hold one tile and nothing else.

    Only ever shrinks. Two butted rows have no dark seam between them, so a box allowed to grow
    would run straight into the row above.
    """
    ty0, ty1 = solid_run(mask[y0:y1, x0:x1].mean(axis=1), y0)
    tx0, tx1 = solid_run(mask[ty0:ty1, x0:x1].mean(axis=0), x0)
    ty1 = ty0 + drop_neighbour_bevel(light[ty0:ty1, tx0:tx1])
    seam = seam_top(light[ty0:ty1, tx0:tx1])
    return tx0, tx1, ty0, ty1 if seam is None else ty0 + seam


def write_variant(label: str, source: str, crop: np.ndarray, mask: np.ndarray) -> None:
    """One appearance of one tile. A label can have several — see the note in synthesize.py."""
    for directory, image in (("faces", crop), ("masks", mask.astype(np.uint8) * 255)):
        path = OUT / directory / label
        path.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(path / f"{source}.png"), image)


# The second photo is the other set of tiles, on the other table. Laid out as four columns of nine
# rather than four rows, rotated a quarter turn, and with a tile back of each colour above the honours.
# Reading each column from the bottom gives the ascending order.
COLUMNS = [
    [f"{n}m" for n in range(1, 10)],
    [f"{n}s" for n in range(1, 10)],
    [f"{n}p" for n in range(1, 10)],
    [f"{n}z" for n in range(1, 8)] + [BACK, BACK],
]

# The felt is far darker than the brown table was, so the threshold that separates tile from
# background is different — and the blue tile back is strongly coloured, so it is admitted on
# lightness alone rather than being required to be neutral.
GREEN_FELT_LIGHTNESS = 70
GREEN_FELT_CHROMA = 30
BACK_LIGHTNESS = 110


def slice_second_set() -> list[tuple[str, np.ndarray]]:
    """Cuts the green-felt photo, adding a second appearance of every face plus the tile backs."""
    bgr = cv2.imread(str(CALIBRATION_2))
    if bgr is None:
        print(f"no second calibration photo at {CALIBRATION_2}, skipping")
        return []
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    light = lab[:, :, 0].astype(np.int16)
    chroma = np.hypot(lab[:, :, 1].astype(np.int16) - 128, lab[:, :, 2].astype(np.int16) - 128)
    solid = (
        (light > GREEN_FELT_LIGHTNESS)
        & ((chroma < GREEN_FELT_CHROMA) | (light > BACK_LIGHTNESS))
    ).astype(np.uint8)
    solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))

    count, _, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=4)
    if count < 2:
        print("no tiles found in the second calibration photo, skipping")
        return []
    block = max(range(1, count), key=lambda i: stats[i][4])
    _, by, _, bh = (int(v) for v in stats[block][:4])

    # The horizontal span comes from where the mask actually covers the height, not from the blob's
    # bounding box: closing the mask rounds its corners outward and the box ends up some twenty pixels
    # wider than the tiles, which is enough drift over four columns to put the last crop on the felt.
    covered = np.flatnonzero((solid[by : by + bh] > 0).mean(axis=0) > 0.5)
    if covered.size == 0:
        print("no columns found in the second calibration photo, skipping")
        return []
    bx, bw = int(covered[0]), int(covered[-1]) - int(covered[0]) + 1

    # The columns are butted, so they are divided evenly — but the rows within a column are found by
    # grid_fit, which is what stops the top tile of each column being cropped with a swathe of felt.
    light_f = light.astype(float)
    cells = []
    for index, labels in enumerate(COLUMNS):
        x0 = bx + index * bw // len(COLUMNS)
        width = bw // len(COLUMNS)
        fit = fit_grid(light_f, (x0, by, width, bh), vertical=True, expect=len(labels))
        if fit is None or fit[2] != len(labels):
            print(f"column {index + 1}: expected {len(labels)} tiles, fit gave {fit}")
            continue
        pitch, offset, _ = fit
        # The low numbers sit at the bottom of the column, so label i belongs to the i-th cell up
        # from the bottom. Reversing the labels *and* counting the rows down was two reversals that
        # cancelled, which put 9m at the foot of the column and 1m at its head.
        for index, label in enumerate(labels):
            top = by + int(offset + (len(labels) - 1 - index) * pitch)
            # A uniform inset on every side. The grid fit puts the boundaries within a pixel or two,
            # so unlike the brown photo there is nothing here that needs edge-by-edge treatment.
            box = (
                slice(top + NEIGHBOUR_EDGE, top + int(pitch) - NEIGHBOUR_EDGE),
                slice(x0 + NEIGHBOUR_EDGE, x0 + width - NEIGHBOUR_EDGE),
            )
            crop, piece = bgr[box], solid[box]
            if crop.size == 0:
                continue
            source = f"green{index + 1}" if label == BACK else "green"
            write_variant(label, source, crop, piece > 0)
            cells.append((f"{label}/{source}", crop))
    return cells


def main() -> None:
    bgr = cv2.imread(str(CALIBRATION))
    if bgr is None:
        sys.exit(f"cannot read {CALIBRATION}")
    light = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)
    mask = tile_mask(bgr)

    faces, masks = OUT / "faces", OUT / "masks"
    for directory in (faces, masks):
        directory.mkdir(parents=True, exist_ok=True)

    tops = row_tops(light, len(ROWS))
    cells = []
    for i, (top, labels) in enumerate(zip(tops, ROWS)):
        next_top = tops[i + 1] if i + 1 < len(tops) else None
        bottom = row_bottom(light, top, next_top)
        if next_top is not None:
            bottom -= NEIGHBOUR_EDGE
        left, right = row_extent(mask, top, bottom)
        step = (right - left) / len(labels)
        for j, label in enumerate(labels):
            nominal_x0 = int(left + j * step) + (NEIGHBOUR_EDGE if j else 0)
            x0, x1, y0, y1 = trim(
                light, mask, nominal_x0, int(left + (j + 1) * step), top, bottom
            )
            crop = bgr[y0:y1, x0:x1]
            write_variant(label, "brown", crop, mask[y0:y1, x0:x1])
            cells.append((label, crop))
        print(f"row {i + 1}: y {top}-{bottom}, x {left}-{right}, {len(labels)} tiles")

    cells += slice_second_set()
    print(f"wrote {len(cells)} crops to {faces} and masks to {masks}")
    audit(cells)
    contact_sheet(cells)


def audit(cells: list[tuple[str, np.ndarray]]) -> None:
    """Reports whatever is left along the edges of each crop.

    Every problem found in this routine so far was spotted by eye first, because each check written
    only caught one kind: a test for dark intrusion is blind to a neighbour's lit edge, which is
    brighter than the face it sits against. So both directions get reported, per edge, and the sizes
    with them — a crop that comes out much shorter or narrower than its neighbours has been cut into.
    """
    print("\n         size      dark% t/b/l/r      bright% t/b/l/r")
    for label, crop in cells:
        light = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)[:, :, 0]
        edges = (light[:4, :], light[-4:, :], light[:, :4], light[:, -4:])
        dark = [(edge < 120).mean() * 100 for edge in edges]
        bright = [(edge > 240).mean() * 100 for edge in edges]
        # The top is exempt from the brightness check. The light comes from above, so a tile's own
        # top bevel is the brightest thing in the photo — 92% of 8m's top edge clears this bar, and
        # 8m is in the first row with nothing above it but table. Real photos show that rim too.
        flag = " <-- check" if max(dark) > 25 or max(bright[1:]) > 30 else ""
        print(
            f"  {label:3s} {crop.shape[1]:3d}x{crop.shape[0]:<3d}  "
            + " ".join(f"{v:4.0f}" for v in dark)
            + "     "
            + " ".join(f"{v:4.0f}" for v in bright)
            + flag
        )


def contact_sheet(cells: list[tuple[str, np.ndarray]], cell: int = 120) -> None:
    """One image with every crop labelled, so the cut can be checked in a single look."""
    per_row = 9
    rows = (len(cells) + per_row - 1) // per_row
    sheet = np.full((rows * (cell + 22), per_row * cell, 3), 255, np.uint8)
    for i, (label, crop) in enumerate(cells):
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
