"""Checks the grid fit against the two calibration photos, whose tile counts are known by construction.

Lives here rather than in recognition/grid_fit.py because it is a test and that module is not: what the
server image ships stays free of its own fixtures. Run it with `python -m tests.test_grid_fit` from `ml`, or run
every check at once with `python -m tests.check`.
"""

import sys
from pathlib import Path

import cv2

from recognition.grid_fit import fit_grid

# Two levels up rather than one: this file sits in ml/tests, and the photos live with the server.
CALIBRATION = Path(__file__).resolve().parents[2] / "server/src/main/resources/calibration"

# The four rows of each calibration photo, with the counts known by construction: both hold the same 4x9 grid,
# so every case expects nine. The `blind` column is what saves that from being a weak assertion, since a fit
# that had learned to answer nine would still pass the constrained half.
#
# The pitch is recorded alongside because the count alone is weak too — a grid can return the right number on a
# pitch a few percent out, and every crop then creeps along the row. Each agrees with (length - offset) / count
# to within a percent, so these are checkable against the geometry rather than a snapshot of what the code
# printed. `blind` was wrong on four of these until MIN_PITCH_RATIO and MAX_PITCH_RATIO were narrowed to what a
# tile's width against its run's depth measures.
KNOWN = [
    ("brown row 1 (m)", "system_mahjong_calibration.jpg", (156, 86, 1376, 205), False, 9, 151.3, 9),
    ("brown row 2 (p)", "system_mahjong_calibration.jpg", (159, 291, 1378, 205), False, 9, 151.5, 9),
    ("brown row 3 (s)", "system_mahjong_calibration.jpg", (158, 496, 1377, 205), False, 9, 151.8, 9),
    ("brown row 4 (z)", "system_mahjong_calibration.jpg", (159, 701, 1380, 205), False, 9, 151.8, 9),
    ("green row 1 (m)", "system_mahjong_calibration_2.jpg", (139, 168, 1541, 232), False, 9, 168.7, 9),
    ("green row 2 (p)", "system_mahjong_calibration_2.jpg", (139, 400, 1545, 232), False, 9, 169.0, 9),
    ("green row 3 (s)", "system_mahjong_calibration_2.jpg", (141, 633, 1545, 232), False, 9, 169.2, 9),
    ("green row 4 (z)", "system_mahjong_calibration_2.jpg", (144, 866, 1539, 232), False, 9, 169.5, 9),
]

PITCH_TOLERANCE = 0.03  # of the expected pitch
# The parameter-free half of the assertion: the tiles have to account for the run, because the run's
# box *is* the tiles. Anything less means the grid sits on part of it and the rest went unread;
# anything more and it runs off the end onto the table. Tighter than the pitch check and needing no
# reference value, so it is the one that would survive a re-shot calibration photo.
MIN_SPAN = 0.97
MAX_SPAN = 1.03


def self_check() -> int:
    failures = 0
    for name, photo, box, vertical, count, pitch, blind in KNOWN:
        bgr = cv2.imread(str(CALIBRATION / photo))
        if bgr is None:
            sys.exit(f"cannot read {CALIBRATION / photo}")
        light = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)
        length = box[3] if vertical else box[2]
        # Both paths: the slicer tells fit_grid the count it knows, a hand photo cannot.
        fit = fit_grid(light, box, vertical, expect=count)
        unconstrained = fit_grid(light, box, vertical)
        got_blind = unconstrained[2] if unconstrained else None

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
        if got_blind != blind:
            problems.append(f"unconstrained {got_blind} != {blind}")
        failures += bool(problems)
        print(
            f"  {'ok  ' if not problems else 'FAIL'} {name:20s}"
            f" count {got_count:2d} pitch {got_pitch:6.2f} offset {got_offset:6.1f}"
            f" span {span:.2f} blind {got_blind}  {'; '.join(problems)}"
        )
    print(f"\n{len(KNOWN) - failures}/{len(KNOWN)} correct")
    return failures


if __name__ == "__main__":
    sys.exit(1 if self_check() else 0)
