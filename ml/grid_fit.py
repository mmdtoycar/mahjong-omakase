"""Locates a row of butted tiles geometrically, before any model is involved.

The first version searched for the grid by brute force — every plausible tile count, times a range of
pitches, times a range of offsets — and scored each candidate by running the classifier over the crops
it produced. It works, and on one real photo it cost 1,680 grid hypotheses and 22,680 tile
classifications: 21 seconds of inference to read one hand. Fine for a script, hopeless for a phone.

Almost all of that was recovering something the pixels already say. Tiles in a row are periodic, so
the boundaries between them fall at regular intervals, and fitting a regular grid to them gives the
pitch and offset directly. The count then follows from the length. No inference at all.

Three things about this were learned the hard way, each after getting it wrong first:

**A boundary is not always dark.** On the brown-table calibration photo the tiles are pressed so close
that what separates two of them is the *lit bevel* of the next one — brighter than the face beside it.
Looking only for dips read three of its four rows wrong. Both minima and maxima are collected.

**Autocorrelation is not precise enough.** It looked like the obvious tool and returned a pitch of 81
against a true 86.9 on the real photo. Six percent compounds over thirteen tiles into most of a tile,
so the boundaries have to be located and fitted individually.

**A grid three times too coarse can explain more marks than the right one.** The bamboo of the 条 suit
is itself a row of vertical bars, which litters the profile with spurious marks — 31 of them across
nine tiles. With the tolerance scaled to the pitch, a 3-tile grid over that row had a tolerance of
36px and caught 13 marks on 4 grid lines, tying the true 9-tile grid. Hence MAX_MARKS_PER_LINE: a
boundary should account for about one mark, and a grid claiming three each is not describing tiles.

Run `python grid_fit.py` to check all of this against the two calibration photos, whose tile counts
are known. The margin on the last of those rules is thin — 1.4 passes and 1.5 does not — so the check
exists to catch the next change that quietly breaks it.
"""

import sys
from pathlib import Path

import cv2
import numpy as np

# A tile is roughly 3:2, but perspective flattens it, so this stays generous. It only has to exclude
# pitches that would make a "tile" a sliver or two tiles wide.
MIN_PITCH_RATIO = 0.45
MAX_PITCH_RATIO = 2.2

EDGE_STRIP = 0.15  # fraction of the run's width sampled along its edge, where the face is plain
EDGE_PERCENTILE = 85  # of that strip, so a character reaching into it does not drag the profile down
SMOOTH = 5
MIN_SEPARATION = 0.45  # of the smallest plausible pitch; closer extrema are the same boundary
FIT_TOLERANCE = 0.12  # of the pitch, for a mark to count as explained by a grid line
MAX_MARKS_PER_LINE = 1.4  # above this the grid is too coarse to be describing tile boundaries
# Candidate pitches are rounded to this before searching, which collapses a couple of thousand
# near-duplicates and takes the fit from 450ms to 40ms. Not coarser than this: at half a pixel the
# 萬 row of the brown photo starts answering fourteen tiles instead of nine, which is what the
# self-check below is for — the speed-up was written first and this caught it.
PITCH_QUANTUM = 0.1


def _extrema(profile: np.ndarray, separation: int) -> list[int]:
    """Local minima and maxima of the profile, thinned so each boundary is reported once."""
    smoothed = np.convolve(profile, np.ones(SMOOTH) / SMOOTH, mode="same")
    window = max(separation // 2, 3)
    marks: set[int] = set()
    for want_min in (True, False):
        found: list[int] = []
        for i in range(window, len(smoothed) - window):
            neighbourhood = smoothed[i - window : i + window + 1]
            if smoothed[i] != (neighbourhood.min() if want_min else neighbourhood.max()):
                continue
            if not found or i - found[-1] > separation:
                found.append(i)
            else:
                better = (
                    smoothed[i] < smoothed[found[-1]]
                    if want_min
                    else smoothed[i] > smoothed[found[-1]]
                )
                if better:
                    found[-1] = i
        marks.update(found)
    return sorted(marks)


def _edge_profile(light: np.ndarray, box: tuple[int, int, int, int], vertical: bool) -> np.ndarray:
    """Lightness along the run, sampled from a strip at its edge.

    The edge rather than the whole width: in the middle the engraved characters swing the profile as
    far as the boundaries do, and the periodic signal disappears into them.
    """
    x, y, w, h = box
    region = light[y : y + h, x : x + w]
    across = w if vertical else h
    depth = max(int(across * EDGE_STRIP), 4)
    strip = region[:, :depth] if vertical else region[:depth, :]
    return np.percentile(strip, EDGE_PERCENTILE, axis=1 if vertical else 0)


def fit_grid(
    light: np.ndarray, box: tuple[int, int, int, int], vertical: bool
) -> tuple[float, float, int] | None:
    """Pitch, offset and tile count for one run, along its long axis and relative to its own box."""
    x, y, w, h = box
    length, across = (h, w) if vertical else (w, h)
    low, high = across * MIN_PITCH_RATIO, across * MAX_PITCH_RATIO

    marks = _extrema(_edge_profile(light, box, vertical), int(low * MIN_SEPARATION))
    if len(marks) < 3:
        return None

    # Candidate pitches come from the gaps between marks. A gap can span more than one tile — an
    # undetected boundary leaves a double gap — so each is also divided by 2, 3 and 4. They are then
    # rounded to PITCH_QUANTUM, which collapses a couple of thousand near-duplicates; see the note on
    # that constant for why the coarseness matters.
    positions = np.array(marks, dtype=float)
    gaps = positions[None, :] - positions[:, None]
    pitches = np.concatenate([gaps[gaps > 0] / divisor for divisor in (1, 2, 3, 4)])
    pitches = pitches[(pitches >= low) & (pitches <= high)]
    if pitches.size == 0:
        return None
    candidates = np.unique(np.round(pitches / PITCH_QUANTUM) * PITCH_QUANTUM)

    best = None
    for pitch in candidates:
        tolerance = pitch * FIT_TOLERANCE
        # Every mark is a candidate anchor; score them all at once. offsets[i] is the grid phase that
        # puts a line exactly on mark i, and distance[i, j] is how far mark j then sits from its
        # nearest line.
        offsets = positions % pitch
        phase = (positions[None, :] - offsets[:, None] + pitch / 2) % pitch - pitch / 2
        hits = (np.abs(phase) <= tolerance).sum(axis=1)
        lines = ((length - offsets) / pitch).astype(int) + 1
        hits = np.where(hits <= lines * MAX_MARKS_PER_LINE, hits, -1)
        winner = int(hits.argmax())
        if hits[winner] < 0:
            continue
        # Most marks explained wins. Ties go to the larger pitch: half the true pitch explains every
        # boundary just as well, and then invents one through the middle of each tile.
        if best is None or (int(hits[winner]), float(pitch)) > best[0]:
            best = ((int(hits[winner]), float(pitch)), float(pitch), float(offsets[winner]))
    if best is None:
        return None

    _, pitch, offset = best
    # Slide back to the first grid line inside the run, then take as many whole tiles as fit. The
    # run's box is the tiles themselves, so this is normally all of it.
    while offset - pitch >= -pitch * 0.25:
        offset -= pitch
    count = int((length - offset) / pitch + 0.25)
    return (pitch, offset, count) if count >= 1 else None


# ── self-check ─────────────────────────────────────────────────────────────

CALIBRATION = Path(__file__).resolve().parents[1] / "server/src/main/resources/calibration"

# Rows of the brown-table photo and columns of the green-felt one, with the counts that are known by
# construction. The 7-tile row matters: it is the one case where the count differs from the others, so
# it catches a fit that has quietly learned to answer nine.
#
# The pitch is recorded alongside, because the count on its own is a weak assertion: a grid can return
# the right number of tiles on a pitch that is a few percent out, and every crop then creeps along the
# row until the last ones straddle two tiles. These pitches were confirmed by eye — the crops they
# produce are the 34 faces in data/faces_contact_sheet.png — so they are a reference, not a snapshot of
# whatever the code happened to print.
KNOWN = [
    ("brown row 1 (萬)", "system_mahjong_calibration.jpg", (43, 37, 1018, 149), False, 9, 110.5),
    ("brown row 2 (饼)", "system_mahjong_calibration.jpg", (41, 186, 1030, 155), False, 9, 113.5),
    ("brown row 3 (条)", "system_mahjong_calibration.jpg", (32, 341, 1044, 158), False, 9, 113.5),
    ("brown row 4 (字)", "system_mahjong_calibration.jpg", (27, 499, 829, 156), False, 7, 118.0),
    ("green column 1", "system_mahjong_calibration_2.jpg", (78, 0, 280, 1924), True, 9, 206.5),
    ("green column 2", "system_mahjong_calibration_2.jpg", (358, 0, 280, 1924), True, 9, 207.0),
    ("green column 3", "system_mahjong_calibration_2.jpg", (638, 0, 280, 1924), True, 9, 206.0),
    ("green column 4", "system_mahjong_calibration_2.jpg", (918, 0, 280, 1924), True, 9, 209.0),
]

PITCH_TOLERANCE = 0.02  # of the expected pitch
# The tiles have to account for the run. Anything less means the grid sits on part of it and the rest
# went unread; anything more and it runs off the end onto the table.
MIN_SPAN = 0.90
MAX_SPAN = 1.05


def self_check() -> int:
    failures = 0
    for name, photo, box, vertical, count, pitch in KNOWN:
        bgr = cv2.imread(str(CALIBRATION / photo))
        if bgr is None:
            sys.exit(f"cannot read {CALIBRATION / photo}")
        light = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)
        length = box[3] if vertical else box[2]
        fit = fit_grid(light, box, vertical)

        if fit is None:
            print(f"  FAIL {name:20s} no fit")
            failures += 1
            continue
        got_pitch, got_offset, got_count = fit
        span = (got_offset + got_count * got_pitch) / length
        problems = []
        if got_count != count:
            problems.append(f"count {got_count} != {count}")
        if abs(got_pitch - pitch) > pitch * PITCH_TOLERANCE:
            problems.append(f"pitch {got_pitch:.2f} != {pitch:.2f}")
        if not MIN_SPAN <= span <= MAX_SPAN:
            problems.append(f"covers {span:.2f} of the run")
        failures += bool(problems)
        print(
            f"  {'ok  ' if not problems else 'FAIL'} {name:20s}"
            f" count {got_count:2d} pitch {got_pitch:6.2f} offset {got_offset:6.1f}"
            f" span {span:.2f}  {'; '.join(problems)}"
        )
    print(f"\n{len(KNOWN) - failures}/{len(KNOWN)} correct")
    return failures


if __name__ == "__main__":
    sys.exit(1 if self_check() else 0)
