"""Cuts the 34-face calibration photo into one labelled crop per tile.

Everything downstream needs these crops: they are the only images of *this* tile set that come
with certain labels, so they seed the synthetic training data for the face classifier.

Finding the rows takes one non-obvious observation. The tiles are butted together with no gap, so
there is no dark seam to look for — between two rows the photo is actually *brighter* than a tile
face, because the lower tile's bevelled top edge catches the light. Those bevels show up as four
sharp spikes in the vertical lightness profile, one per row, and that is what the rows are found by.

Within a row the tiles are butted too, so the row is simply divided by its known tile count. The
resulting boxes are a pixel or two off in places, which is harmless and arguably useful: the
classifier should not depend on a perfectly centred crop.
"""

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CALIBRATION = ROOT / "server/src/main/resources/calibration/system_mahjong_calibration.jpg"
OUT = Path(__file__).resolve().parent / "data/faces"

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
INSET = 3  # trimmed off each crop so a neighbour's edge cannot leak in


def lightness(bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)


def row_tops(light: np.ndarray, expected: int) -> list[int]:
    """The y of each row's lit top edge, as peaks in the vertical lightness profile."""
    # Sample the left portion only: the shortest row leaves bare table on the right, which would
    # drag its average down and flatten the peak being looked for.
    profile = light[:, : int(light.shape[1] * 0.7)].mean(axis=1)
    peaks = []
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


def row_extent(light: np.ndarray, top: int, bottom: int) -> tuple[int, int]:
    """Horizontal span of the tiles in one row, so a short row is not divided across bare table."""
    columns = light[top:bottom].mean(axis=0) > BEVEL_LIGHTNESS * 0.6
    on = np.flatnonzero(columns)
    return int(on[0]), int(on[-1]) + 1


def main() -> None:
    bgr = cv2.imread(str(CALIBRATION))
    if bgr is None:
        sys.exit(f"cannot read {CALIBRATION}")
    light = lightness(bgr)
    OUT.mkdir(parents=True, exist_ok=True)

    tops = row_tops(light, len(ROWS))
    cells = []
    for i, (top, labels) in enumerate(zip(tops, ROWS)):
        bottom = row_bottom(light, top, tops[i + 1] if i + 1 < len(tops) else None)
        left, right = row_extent(light, top, bottom)
        step = (right - left) / len(labels)
        for j, label in enumerate(labels):
            x0 = int(left + j * step) + INSET
            x1 = int(left + (j + 1) * step) - INSET
            crop = bgr[top + INSET : bottom - INSET, x0:x1]
            cv2.imwrite(str(OUT / f"{label}.png"), crop)
            cells.append((label, crop))
        print(f"row {i + 1}: y {top}-{bottom}, x {left}-{right}, {len(labels)} tiles")

    print(f"wrote {len(cells)} crops to {OUT}")
    contact_sheet(cells)


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
    path = OUT.parent / "faces_contact_sheet.png"
    cv2.imwrite(str(path), sheet)
    print(f"contact sheet: {path}")


if __name__ == "__main__":
    main()
