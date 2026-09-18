"""Locates a row of butted tiles geometrically, before any model is involved.

Tiles in a row are periodic, so the boundaries between them fall at regular intervals and fitting a regular
grid to them gives the pitch and offset directly. Brute-forcing count, pitch and offset instead and scoring
each candidate with the classifier cost 1,680 hypotheses and 21 seconds of inference on one photo.

Three things were learned the hard way here:

**A boundary is not always dark.** What separates two butted tiles is often the *lit bevel* of the next one.
Looking only for dips gets six of the eight calibration columns wrong, so both minima and maxima are collected.

**Autocorrelation is not precise enough.** It returned a pitch of 81 against a true 86.9, and six percent
compounds over thirteen tiles into most of a tile.

**A grid three times too coarse can explain more marks than the right one.** The bamboo of 条 litters the
profile — 31 spurious marks over nine tiles — and a 3-tile grid tied the true 9-tile one. Hence
MAX_MARKS_PER_LINE: a boundary should account for about one mark.

Checked against the two calibration photos, whose tile counts are known: `python -m tests.test_grid_fit`.
"""

import numpy as np

# How wide a tile is against how deep its run is: over the 44 rows marked by hand the middle 90% lands between
# 0.57 and 0.90. This is what excludes a grid at a harmonic of the truth. The floor sits just under that spread
# rather than under every row — four rows measure 0.45 to 0.58 and cannot be read at all, each shot far too
# obliquely, and letting them in means letting in harmonics everywhere else.
MIN_PITCH_RATIO = 0.55
MAX_PITCH_RATIO = 1.05

EDGE_STRIP = 0.15  # fraction of the run's width sampled along its edge, where the face is plain
EDGE_PERCENTILE = 85  # of that strip, so a character reaching into it does not drag the profile down
SMOOTH = 5
MIN_SEPARATION = 0.45  # of the smallest plausible pitch; closer extrema are the same boundary
FIT_TOLERANCE = 0.12  # of the pitch, for a mark to count as explained by a grid line
MAX_MARKS_PER_LINE = 1.4  # above this the grid is too coarse to be describing tile boundaries
# Candidate pitches are rounded to this before searching, which collapses near-duplicates and takes the fit
# from 450ms to 40ms. Not coarser: at half a pixel a calibration row answered fourteen tiles instead of nine.
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
                better = smoothed[i] < smoothed[found[-1]] if want_min else smoothed[i] > smoothed[found[-1]]
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
    light: np.ndarray, box: tuple[int, int, int, int], vertical: bool, expect: int | None = None
) -> tuple[float, float, int] | None:
    """Pitch, offset and tile count for one run, along its long axis and relative to its own box.

    `expect` narrows the candidate pitches to those producing that many tiles, for callers that know the answer
    by construction. Not a substitute for the search: the bars of 条 and the rings of 饼 litter the profile, and
    two of the eight calibration columns answer eleven and thirteen without the count.
    """
    _, _, w, h = box
    length, across = (h, w) if vertical else (w, h)
    low, high = across * MIN_PITCH_RATIO, across * MAX_PITCH_RATIO
    if expect:
        # Ten percent either way, not tighter: at three percent so few candidate pitches survive that the fit
        # returns nothing far more often, which cost three reads end to end.
        nominal = length / expect
        low, high = max(low, nominal * 0.9), min(high, nominal * 1.1)

    marks = _extrema(_edge_profile(light, box, vertical), int(low * MIN_SEPARATION))
    if len(marks) < 3:
        return None

    # Candidate pitches come from the gaps between marks, each also divided by 2, 3 and 4 because an
    # undetected boundary leaves a double gap.
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
