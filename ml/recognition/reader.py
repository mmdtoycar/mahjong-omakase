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
from collections import Counter
from pathlib import Path
from typing import NamedTuple

import cv2
import numpy as np
import onnxruntime as ort
import pillow_heif
from PIL import Image, ImageOps, UnidentifiedImageError

from recognition.grid_fit import MAX_PITCH_RATIO, MIN_PITCH_RATIO, fit_grid
from recognition.tiles import BACK, DATA, RUNS, SIZE

# iPhones produce HEIC, and it reaches this code whenever the browser could not decode it: Safari can,
# desktop Chrome cannot, and the upload path then sends the file untouched. OpenCV has no HEIC support
# at all, so without this the reader refuses every photo taken on a phone and uploaded from a desktop.
pillow_heif.register_heif_opener()

# The exported model rather than the training checkpoint, and no torch anywhere below. Two reasons: the
# sidecar that serves this has to install onnxruntime and not a 2GB deep-learning framework, and running
# the *same* inference path in development as in production removes a whole class of "it worked with the
# .pt" surprise. train_classifier writes both files from the same weights.
MODEL = RUNS / "classifier.onnx"
METADATA = RUNS / "classifier.json"

# Why a photo was refused, as a code rather than a sentence. The sentence goes in the log; the caller
# words the code for whoever is looking at it, and for this app that is a player reading Chinese. Passing
# the English prose straight through is what used to happen, and it put "no run long enough to be a hand"
# in front of someone whose row was fine and simply had a meld in it.
NO_TILES = "no-tiles"  # nothing in the frame resembles a row of tiles
NO_ROW = "no-row"  # something does, but no region frames as one even row
SHORT_RUNS_ONLY = "short-runs-only"  # only runs of three or four, which are melds or a row in pieces
UNREADABLE_ROW = "unreadable-row"  # a row was framed and then could not be sliced


class Refusal(NamedTuple):
    """A photo that could not be read: what to call it, and what to say in the log."""

    code: str
    why: str


# A tile face is near-white: bright, and far less coloured than green felt or a brown table.
MIN_LIGHTNESS = 150
MAX_CHROMA = 26

MIN_RUN_ASPECT = 2.0  # below this a blob is a single tile, not a line of them
# Of a blob's densest line across the run, how much a line has to hold to still count as tile.
MIN_BAND_SHARE = 0.5
# Fitting a run's long boundaries: how far out of line a column may sit and still count as on the boundary,
# how many places along it to try a candidate line from, and how deep a line has to be to count as still
# inside the row rather than a stray tail off the end.
EDGE_TOLERANCE = 2.5
EDGE_SAMPLES = 20
MIN_END_DEPTH = 0.5

# How far the classifier is allowed to move the geometric fit. Small on purpose: the fit is already
# within a pixel of the brute-force answer, and every step here costs a forward pass per tile.
PITCH_NUDGE = (0.99, 1.0, 1.01)
OFFSET_NUDGE = (-0.04, 0.0, 0.04)
# How much mean confidence a longer reading of the same run may give up and still be preferred. See the
# choice at the end of read_line: dropping a cell raises the mean, so without a margin the shorter reading
# always wins and a row of fourteen is read as thirteen.
COUNT_MARGIN = 0.05
# How well the standing row has to read for its length to be believed without a meld beside it to corroborate
# the count. This is what stops the shape search escalating: fail it at fourteen and the next thing tried is
# one meld and a row of eleven, which cuts eleven cells across fourteen tiles and reads every one of them at
# 0.94 or better while losing three. So it wants to be high. Swept over the 44 sample photographs at 0.05
# steps, tiles read: 474 at 0.45, 499 at 0.6, 516 at 0.65, 518 at 0.75, 506 at 0.8, 459 at 0.9. The top is a
# plateau rather than a spike, which is why the exact value is not load-bearing.
SETTLED_ROW = 0.75
# What a meld's face-up cells have to average. Its own number, below the bar a lone tile is held to, because a
# meld is judged as a whole: three or four crops that agree on one tile corroborate each other, and the shape
# check is what keeps that honest. Swept: 0.8 reports no meld at all on the sample archive, 0.6 reports three,
# 0.5 reports four and every one of them right, and below 0.5 nothing more comes in either way.
MELD_FACE_FLOOR = 0.5
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
# What two to four melds butted together come to. They are set aside in a line and the gap goes between the
# hand and the line, not between each of them — see read_melds_in.
MELD_BLOCKS = tuple(range(6, 17))

# How many tiles may be standing in the hand. Thirteen or fourteen, and nothing in between those and the
# short rows a hand with melds leaves: fourteen tiles and one more for each 杠 that drew a replacement, or
# thirteen if the winning tile was never laid down, and a meld takes at least three of them out of the row.
# So twelve and fifteen standing tiles are arrangements no hand can take, and admitting them — which this
# did — cost real reads, because a grid one cell too fine over a row of fourteen answers fifteen and was
# being accepted.
#
# The floor is the most valuable thing left to fix, and it is also the hardest. It turns away every hand
# with a meld, which is the error a player with melds hits every time; widening it to range(5, 16) does
# read those hands, 308-8's eight tiles all correct. What stops it is that nothing else can then tell the
# standing row from a meld:
#
#   - By score, the shortest candidate tends to win, since mean confidence rises every time a cell is
#     dropped — the bias the note on PITCH_NUDGE records. The repository's own test photo went from
#     thirteen tiles to seven on nothing more than a JPEG re-encode.
#   - By length, no: with four melds and a hand waiting on one tile the standing row is a single tile,
#     two if the winning tile is there, so it is not reliably longer than a meld's three or four. Tried
#     anyway and it read two of the photos that should have been refused.
#   - By position, the row is the group at the start of the reading direction with the melds past a gap.
#     That needs the direction before the melds are known, which rail_side now supplies — so this is the
#     one still open rather than ruled out.
#   - By the tiles themselves: a called meld has one tile laid on its side and the standing row has none,
#     which separates them whatever their lengths. That is a convention to photograph by rather than
#     something in the pixels today, and given the length argument above it is the only complete answer.
#
# The floor is now settled by `standing_sizes`, and by none of those: the melds are counted first and the
# standing row's length follows from how many there are. Nothing has to tell the two apart by looking.
HAND_SIZES = range(13, 15)


def standing_sizes(counts: range, melds: int) -> tuple[int, ...]:
    """How many tiles can be standing, given how many melds were set aside.

    A meld takes exactly three tiles out of the standing row whatever its own length: a kan is four tiles,
    but it also draws a replacement, so the hand's total rises by one and the row still loses three. So the
    row is pinned to as many lengths as `counts` has and no more — two, one for the winning tile laid down
    with the hand and one for it not being there — instead of any length between one and fourteen.

    How many melds there are is the hard part, not this. Counting the photo's separate tile regions and taking
    one of them for the row was tried — it is the obvious reading of "the row is one block and the melds are
    the others" — and it is right on 6 of the 40 sample photos and over by one to three on the rest, because
    the candidates include the table's housing, the discards and whatever else is in frame.
    """
    return tuple(size for size in (count - 3 * melds for count in counts) if size >= 1)


# How wide a tile is against the depth of the row it stands in. Measured over the 44 rows marked by hand:
# median 0.77, middle 90% between 0.57 and 0.90. It is what tells three cells from four on the same run,
# since their pitches differ by exactly 4/3 and only one of the two widths is a tile's.
#
# This replaced comparing a meld's pitch to the hand's, which sounded right — same tiles, same camera — and
# is measurably wrong: over the 22 marked melds the ratio runs 0.62 to 2.18, because a meld with its called
# tile laid on its side is much wider per tile, and it may be laid nearer or further than the row. See
# choose_meld.
TILE_ASPECT = 0.77

# How many of the standing row may read as face down before the region is not the standing row at all. A
# 暗杠's two face-down tiles sit in a meld rather than in the hand, so strictly this is zero; two is the
# allowance for the odd cell the classifier gets wrong, and it is the same number serve.py refuses on.
#
# Checked while the region is being chosen and not only afterwards, which is what makes it worth having.
# Mean confidence on its own picks a dark strip of shadow or a bare forearm over the real row, because the
# classifier calls those `back` and is sure of it: on one photo the row itself fitted thirteen tiles at
# 0.30 and lost to two strips at 0.62 and 0.65, both read as thirteen backs.
MAX_BACKS_STANDING = 2


# How much more coloured the felt side has to be than the housing side before one of them counts as the
# table's edge. A ratio rather than a level, so it does not depend on how saturated a particular felt is —
# the two tables here are green and brown. It is what separates a row actually pushed up to the edge from
# one out on open felt: over the sample archive every row the edge settled correctly came back at 2.0 to
# 10, and every row it got wrong at 1.1 to 1.95, those being rows with felt on both sides. The gap
# between 1.95 and the first correct 1.99 is thin, and worth re-checking as photos accumulate; once the
# hand is against the edge by habit the housing side reads 2-4 against felt's 19-43 and the ratio is 5+.
MIN_RAIL_CONTRAST = 2.0

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

# Above this overlap two candidate runs are the same row found by both masks, and only one is kept.
SAME_RUN = 0.7


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


def solid_band(present: np.ndarray) -> slice:
    """The stretch of lines across a run that the blob actually fills, against its own densest line.

    A blob's bounding box is not the tiles. On one well-composed photo the mask also caught a band of
    felt whose pixels sit right on both thresholds — lightness just over 150, chroma just under 26,
    against the tiles' 200-220 and 5-12 — and the closing in tile_mask joined it to the row, returning a
    box 208px deep for tiles only 73px deep and 100px longer than them. Everything downstream is measured
    against that box: the crops carry a band of felt, and the profile fit_grid takes its boundaries from
    is sampled EDGE_STRIP into the felt rather than the tiles.

    Relative to the blob's own best line rather than an absolute share, which is what separates this from
    slice_calibration's solid_run: a photographed row peaks around 87-97% because the mask drops the red
    of a 筒 and the lit bevel between tiles, so the 0.9 that holds on a butted calibration grid would
    reject the row itself.
    """
    coverage = present.mean(axis=1)
    inside = np.flatnonzero(coverage >= coverage.max() * MIN_BAND_SHARE)
    if inside.size == 0:
        return slice(0, present.shape[0])
    runs = np.split(inside, np.flatnonzero(np.diff(inside) > 1) + 1)
    longest = max(runs, key=len)
    return slice(int(longest[0]), int(longest[-1]) + 1)


def not_felt(bgr: np.ndarray) -> np.ndarray:
    """Whatever is sitting on the table, as the felt's own outline minus the felt.

    The opposite way round from tile_mask, and it finds what that one misses. A tile here is found by
    *not* being felt rather than by being bright, so glare cannot swallow it: on one photo the mask of
    bright colourless pixels caught a band of felt sheen and returned the row 2.6x too deep, and on two
    others it lost the row altogether while this found it at 0.93 and 0.76 against the marked corners.

    Felt is the one thing in the frame that is both large, dark and strongly coloured, and both levels
    come from the photo itself rather than from constants, so neither of the two tables here is preferred.
    What sits on it is a bite out of its outline: enclosed when the row is out in the open, a notch in the
    edge when it is pushed up against the housing, and the convex hull covers both. Filling only enclosed
    holes found 8 of the 44 marked rows against the hull's 33.

    Worth its keep by one read, and no more: the mask of bright colourless pixels finds 38 of the 44 rows
    on its own and the two together 39, which end to end is 15 photos read against 16.
    """
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    light = lab[:, :, 0]
    chroma = np.clip(np.hypot(lab[:, :, 1].astype(float) - 128, lab[:, :, 2].astype(float) - 128), 0, 255)
    level, _ = cv2.threshold(chroma.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Coloured *and* dark, both levels read off this photo rather than fixed. Colour alone calls a tile
    # felt: the green of 条 and the red of 筒 are far more chromatic than the cloth is, and the closing
    # below then joins those strokes into one patch over the whole face — on one photo the felt mask
    # swallowed the entire row and left only the white gaps between the ink. The face the ink sits on is
    # bright, 200 to 220 against the cloth's 100 to 130, so lightness is what separates them.
    dim, _ = cv2.threshold(light, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    felt = ((chroma > level) & (light < dim)).astype(np.uint8)
    felt = cv2.morphologyEx(felt, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    count, labelled, stats, _ = cv2.connectedComponentsWithStats(felt, connectivity=4)
    if count < 2:
        return np.zeros(bgr.shape[:2], np.uint8)
    table = 1 + int(np.argmax(stats[1:, 4]))
    surface = (labelled == table).astype(np.uint8)
    hull = np.zeros_like(surface)
    cv2.fillConvexPoly(hull, cv2.convexHull(cv2.findNonZero(surface)), 1)
    return (hull & (surface == 0)).astype(np.uint8)


def fit_edge(along: np.ndarray, across: np.ndarray) -> tuple[float, float]:
    """A line through one boundary of a blob, chosen by how much of the boundary it actually lies on.

    Trimming outliers from a least-squares fit is not enough when a third of the boundary is a step rather
    than a bump: the median residual rises with the step and nothing gets trimmed. A tile laid on its side is
    shorter across the row than one standing, so the boundary steps down where it sits — measured, to 54% to
    76% of the row's depth over four marked melds — and the fitted line then splits the step and tilts, which
    skews every cell and not only the turned one.

    So the line is chosen by inlier count from candidate pairs spread along the boundary, then refitted on its
    own inliers. Two thirds of a boundary lying on the true line is plenty for that, where it defeats trimming.
    Worth 13 of the 617 sample tiles and three whole photographs.

    Three other ways round the same step were tried and lost: fitting only the columns as deep as the deepest
    (401 to 434 tiles against 478, because depth also tapers along a row from perspective, by up to 2.2x, so
    filtering on it cuts off the far end instead of the turned tile); deriving one boundary from the other at
    the row's median depth, which the table's edge could pick out (472 and 466, and 18 whole photographs down
    to 11, because parallel boundaries cannot hold the taper at all); and telling a step from a taper by the
    residual of a straight fit, which separates the two only weakly — 0.111 against 0.064.
    """
    if len(along) < 8:
        slope, intercept = np.polyfit(along, across, 1)
        return float(slope), float(intercept)
    tolerance = max(1.5, EDGE_TOLERANCE)
    best = None
    reach = len(along)
    step = max(reach // EDGE_SAMPLES, 1)
    for first in range(0, reach - 1, step):
        # A quarter of the boundary apart at least, so the pair sets the slope rather than the noise.
        for second in range(first + max(reach // 4, 1), reach, step):
            run = along[second] - along[first]
            if abs(run) < 1:
                continue
            slope = (across[second] - across[first]) / run
            intercept = across[first] - slope * along[first]
            inliers = np.abs(slope * along + intercept - across) <= tolerance
            count = int(inliers.sum())
            if best is None or count > best[0]:
                best = (count, inliers)
    if best is None or best[1].sum() < 4:
        slope, intercept = np.polyfit(along, across, 1)
        return float(slope), float(intercept)
    slope, intercept = np.polyfit(along[best[1]], across[best[1]], 1)
    return float(slope), float(intercept)


def row_quad(blob: np.ndarray, at: tuple[int, int]) -> np.ndarray | None:
    """The four corners of a run: its two long boundaries fitted apart, cut where it stops being deep.

    The boundaries are fitted independently and deliberately. Constrain them parallel and the quad is a
    rectangle, and a rectangle has one depth for the whole row — which is the one thing a photographed row
    is not. Over the 66 marked rows its two long edges come out within 1.3% of the same length, but one
    end looks up to 2.2x deeper than the other, and that is the distortion a rectangle cannot hold.

    Wound clockwise on screen with the row along the first edge, so warping it to an upright rectangle is
    a rotation and never a mirror.

    The ends are the weak part of this and pulling them in afterwards does not fix it. Against the marked
    corners the ends are over a tile out on 10 of the 43 rows found, and trimming the flattened strip by
    column lightness takes that to 8 and the mean error from 0.40 tile widths to 0.36 — and end to end that
    is 23 photographs read whole against 24, with 33 tiles wrong against 27. The same shape of answer as
    perfect regions being worse than these: a shorter strip is a strip the count search has fewer ways to
    fit, and it fits the wrong one more confidently. Column chroma and tile-mask coverage were tried on the
    same rows and did not even improve the geometry.
    """
    across_row = blob.shape[1] >= blob.shape[0]
    lines = np.arange(blob.shape[0] if across_row else blob.shape[1])[:, None]
    here = blob if across_row else blob.T
    filled = here.any(axis=0)
    if filled.sum() < 8:
        return None
    near = np.where(here, lines, here.shape[0]).min(axis=0).astype(float)
    far = np.where(here, lines, -1).max(axis=0).astype(float)
    # The ends are where the blob stops being as deep as the row, not where its last stray pixel is.
    solid = filled & ((far - near) >= MIN_END_DEPTH * np.median((far - near)[filled]))
    if solid.sum() < 8:
        return None
    columns = np.where(solid)[0].astype(float)
    start, stop = columns[0], columns[-1]
    near_slope, near_at = fit_edge(columns, near[solid])
    far_slope, far_at = fit_edge(columns, far[solid])
    ends = [
        (start, near_slope * start + near_at),
        (stop, near_slope * stop + near_at),
        (stop, far_slope * stop + far_at),
        (start, far_slope * start + far_at),
    ]
    if across_row:
        quad = [(along, depth) for along, depth in ends]
    else:
        # The row runs down the frame, so along-row is y and depth is x. Taken in this order the corners
        # stay clockwise on screen, which the transpose on its own would have reversed.
        quad = [(depth, along) for along, depth in (ends[3], ends[2], ends[1], ends[0])]
    return np.float32(quad) + np.float32(at)


def flatten(bgr: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """The quadrilateral warped to an upright rectangle, the row running across it.

    This is the whole reason a quad is carried around instead of a box. Cut from the same corners, the
    four-point warp reads 541 of the 596 marked tiles; the tightest rotated rectangle around those corners
    reads 391 and the upright bounding box 379. Undoing the rotation is worth 2 points of that and undoing
    the perspective 25, so a row has to be flattened, not merely turned.
    """
    width = round(max(np.linalg.norm(quad[1] - quad[0]), np.linalg.norm(quad[2] - quad[3])))
    depth = round(max(np.linalg.norm(quad[3] - quad[0]), np.linalg.norm(quad[2] - quad[1])))
    if width < 8 or depth < 8:
        return np.zeros((0, 0, 3), bgr.dtype)
    target = np.float32([[0, 0], [width - 1, 0], [width - 1, depth - 1], [0, depth - 1]])
    matrix = cv2.getPerspectiveTransform(quad.astype(np.float32), target)
    return cv2.warpPerspective(bgr, matrix, (width, depth), flags=cv2.INTER_CUBIC)


class Run(NamedTuple):
    """One candidate row: where it sits in the frame, and that region flattened to a rectangle."""

    box: tuple[int, int, int, int]
    quad: np.ndarray
    flat: np.ndarray
    light: np.ndarray


def whole(flat: np.ndarray) -> tuple[int, int, int, int]:
    """A flattened run's own extent, for the fitting and slicing that still work in boxes."""
    return (0, 0, flat.shape[1], flat.shape[0])


def candidate_runs(bgr: np.ndarray) -> list[Run]:
    """Every blob shaped like a line of butted tiles, from either mask, trimmed to the tiles.

    Shape is not enough to pick the hand out of these. In the first photo tried, the housing of the
    mahjong table came back 172x1428 — aspect 8.3, against the hand's 8.4 — and being the longer of
    the two it won. So all of them are returned and the classifier decides, the same way it decides
    the alignment: a run of real tiles yields confident predictions and a strip of plastic does not.

    Both masks, because each finds rows the other loses: bright-and-colourless locates 38 of the 44 marked
    rows, not-felt 33, and together 39.
    """
    runs = []
    for mask in (tile_mask(bgr), not_felt(bgr)):
        count, labelled, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
        for i in range(1, count):
            x, y, w, h, area = stats[i]
            long_side, short_side = max(w, h), max(min(w, h), 1)
            if long_side / short_side < MIN_RUN_ASPECT or area <= 0.005 * bgr.size / 3:
                continue
            here = labelled[y : y + h, x : x + w] == i
            quad = row_quad(here, (int(x), int(y)))
            band = solid_band(here if w >= h else here.T)
            if w >= h:
                y, h = y + band.start, band.stop - band.start
            else:
                x, w = x + band.start, band.stop - band.start
            box = (int(x), int(y), int(w), int(h))
            # The same row often comes back from both masks. Reading it twice costs a forward pass per
            # tile and gives the selection two nearly identical candidates to choose between.
            if quad is None or any(overlap(box, seen.box) > SAME_RUN for seen in runs):
                continue
            flat = flatten(bgr, quad)
            if flat.size == 0:
                continue
            light = cv2.cvtColor(flat, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)
            runs.append(Run(box, quad, flat, light))
    if not runs:
        raise SystemExit(NO_TILES)
    return runs


def overlap(one: tuple[int, int, int, int], other: tuple[int, int, int, int]) -> float:
    """Intersection over union of two boxes."""
    ax, ay, aw, ah = one
    bx, by, bw, bh = other
    x0, y0 = max(ax, bx), max(ay, by)
    x1, y1 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    both = (x1 - x0) * (y1 - y0)
    return both / (aw * ah + bw * bh - both)


def read_line(
    model: ort.InferenceSession,
    bgr: np.ndarray,
    light: np.ndarray,
    box: tuple[int, int, int, int],
    size: int,
    refine: bool,
    counts,
) -> tuple[float, int, float, float, np.ndarray, np.ndarray, np.ndarray] | None:
    """Reads one run, starting from its geometric fit.

    With `refine` false this costs a single forward pass, which is all that is needed to tell a row of
    tiles from a strip of the table's plastic housing. The winner is then read again with `refine` on.

    Every count in `counts` is asked for by name; there is no unconstrained fit any more. Fitting blind and
    only asking outright when the answer fell outside the allowed counts was two bugs at once — a row of
    fourteen comes back as thirteen at a pitch 1.4% too large, and thirteen is allowed, so it was taken and
    fourteen was never tried. Measured, the blind fit adds nothing at all on top of the named counts.
    """
    _, _, w, h = box
    vertical = h >= w
    # Every count the caller allows, asked for outright, and the blind fit as well. Asking only when the
    # blind answer fell *outside* the allowed counts was the bug this replaces: fit_grid pins the pitch to
    # within a tenth of length/wanted and then recomputes the count from it, so a row of fourteen comes back
    # as thirteen at a pitch 1.4% too large — and thirteen is allowed, so it was accepted and fourteen was
    # never tried. Over the 44 rows framed by hand, 20 could not be fitted at their own tile count and this
    # is most of them; five photos read thirteen of their fourteen tiles, every one of the thirteen right.
    length, depth = (h, w) if vertical else (w, h)
    # Two grids per count, and the count itself is stated rather than fitted. A row of `wanted` tiles in a box
    # that *is* the tiles has a pitch of length/wanted by arithmetic; the box is only approximately the tiles,
    # so fit_grid's own pitch is offered alongside it and the classifier picks. Measured apart over the sample
    # archive: length/wanted alone reads 286 of the 603 tiles, fit_grid's pitch alone 332, the two together
    # 351, and the third below 365.
    #
    # Held to a tile's shape as well, and that is not a detail: a pitch of length/wanted always slices
    # cleanly, so without the guard no run can fail on its count any more and the count stops discriminating.
    # Ten and eleven then fit an eleven-tile row equally, the search settles on no melds, and every hand with
    # melds loses them — 22 tiles when it was left out.
    grids = []
    for wanted in counts:
        narrowed = fit_grid(light, box, vertical, expect=wanted)
        if narrowed is None:
            continue
        for pitch, offset in (
            (narrowed[0], narrowed[1]),
            ((length - narrowed[1]) / wanted, narrowed[1]),
            (length / wanted, 0.0),
        ):
            if not MIN_PITCH_RATIO <= pitch / max(depth, 1) <= MAX_PITCH_RATIO:
                continue
            # The three are often within a pixel of each other, and each costs a forward pass per tile.
            if not any(
                abs(pitch - seen[0]) < 0.5 and abs(offset - seen[1]) < 0.5 and seen[2] == wanted
                for seen in grids
            ):
                grids.append((pitch, offset, wanted))
    if not grids:
        return None

    readings = []
    for pitch, offset, count in grids:
        if count not in counts:
            continue
        combinations = (
            [(pitch * p, offset + pitch * o) for p in PITCH_NUDGE for o in OFFSET_NUDGE]
            if refine
            else [(pitch, offset)]
        )
        # Evenly, and then with each cell in turn taken to hold a tile laid on its side. Melds only: a called
        # tile can sit anywhere in one, and every position is tried. A standing row is never cut that way, and
        # that is a decision about how the hand is laid out rather than a limit of the search — the winning tile
        # is not to be turned. Asking for it at both ends of the row as well reads four more of the 44 sample
        # photographs whole, all of them shot before that was settled, and costs 1.1s of a 1.8s read.
        #
        # Only on the refining pass: the coarse pass is choosing a region and a length, and neither depends on
        # where within the run a turned tile sits.
        #
        # Against every pitch and offset nudge, not only against the best even cut. Trying it the cheap way —
        # find the best nudge first, then the positions from that one alone — runs at 765ms a photo against
        # 1.8s, and costs 17 tiles and four whole photographs. The nudge that suits an even cut is not the one
        # a turned cut wants.
        places: tuple[int | None, ...] = (None,)
        if refine:
            places += tuple(range(count)) if count <= max(MELD_SIZES) else ()
        for candidate_pitch, candidate_offset in combinations:
            for turned in places:
                crops = slice_line(
                    bgr, box, vertical, candidate_offset, candidate_pitch, count, size, turned=turned
                )
                if crops is None:
                    continue
                confidence, predicted, nothing = classify(model, crops)
                readings.append(
                    (
                        float(confidence.mean()),
                        count,
                        candidate_pitch,
                        candidate_offset,
                        confidence,
                        predicted,
                        nothing,
                        turned,
                    )
                )
    if not readings:
        return None
    top = max(reading[0] for reading in readings)
    close = [reading for reading in readings if reading[0] >= top - COUNT_MARGIN]
    return max(close, key=lambda reading: (reading[1], reading[0]))


def slice_line(
    bgr: np.ndarray,
    box: tuple[int, int, int, int],
    vertical: bool,
    start: float,
    pitch: float,
    count: int,
    size: int,
    inset: int = 4,
    turned: int | None = None,
) -> np.ndarray | None:
    """The run cut into `count` cells, evenly unless one of them holds a tile laid on its side.

    A tile turned a quarter takes up its own height along the row rather than its width, which is a third
    more, so a row of three with one turned is 3.3 upright widths across and three equal cells cannot land on
    the tiles. `turned` says which cell holds it, and the rest shrink to keep the run's own width.

    Which cell that is comes from trying each in turn and keeping the cut whose faces read best — put the wide
    cell in the right place and every cell is framed properly, so every face reads better, not just that one.
    Over the 19 marked melds that hold a turned tile this picks the right position 13 times. The turn head is
    no use for it, oddly: asked whether the widened cell is the odd one out it endorses only 2 of the 19.
    """
    x, y, w, h = box
    origin = (y if vertical else x) + start
    # The grid can start a hair before the run or end a hair after it, since the offset is nudged either way
    # and the pitch with it. Clamped into the run rather than passed to numpy as it comes: a negative index
    # counts from the *end* there, so a start of -1 silently produced an empty crop and the whole photo was
    # refused as unsliceable. It cost five of the sample photos, four of which the classifier reads in full.
    limit = (y + h) if vertical else (x + w)
    edge = y if vertical else x
    # A fixed number of pixels, and not a share of the cell, though the same grid is cut twice at very
    # different scales — once off the 900px copy to score it, where a cell is about 50px, and once off the
    # photo as it came, where the same cell is 120px. Trimming proportionally is the tidier idea and it is
    # worse at every share tried, from 387 tiles at 3% down to 100 at 12%, against 390 for four pixels flat.
    # The classifier was trained on crops framed a particular way and wants the tile's own edge in view.
    trim = inset
    # A turned cell is 1/TILE_ASPECT of an upright one, and the pitch given is the upright one's, so the run
    # would overrun by the difference; the whole grid shrinks to hold it.
    if turned is not None:
        pitch *= count / (count - 1 + 1 / TILE_ASPECT)
    edges, at = [], origin
    for i in range(count + 1):
        edges.append(at)
        at += pitch / TILE_ASPECT if i == turned else pitch
    crops = []
    for i in range(count):
        a = min(max(int(edges[i]) + trim, edge), limit)
        b = min(max(int(edges[i + 1]) - trim, edge), limit)
        if b - a < 8:
            return None
        crop = bgr[a:b, x + trim : x + w - trim] if vertical else bgr[y + trim : y + h - trim, a:b]
        if crop.size == 0 or crop.shape[0] < 8 or crop.shape[1] < 8:
            return None
        crops.append(cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA))
    return np.stack(crops)


def load_model() -> tuple[ort.InferenceSession, list[str], int]:
    """The exported classifier with its labels and input size."""
    if not MODEL.exists():
        raise SystemExit(f"no model at {MODEL} — run training/train_classifier.py first")
    session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    labels = json.loads(METADATA.read_text())["labels"]
    return session, labels, SIZE


def softmax(logits: np.ndarray) -> np.ndarray:
    logits = logits - logits.max(axis=1, keepdims=True)
    exponentiated = np.exp(logits)
    return exponentiated / exponentiated.sum(axis=1, keepdims=True)


def probabilities(model: ort.InferenceSession, crops: np.ndarray) -> np.ndarray:
    """Softmax over every class for each crop, the faces first and `none` last."""
    return softmax(_run(model, crops)[0])


def _run(model: ort.InferenceSession, crops: np.ndarray) -> list[np.ndarray]:
    rgb = (crops[:, :, :, ::-1].astype(np.float32) / 255.0) - 0.5
    batch = np.ascontiguousarray(rgb.transpose(0, 3, 1, 2))
    return model.run(None, {model.get_inputs()[0].name: batch})


def turned_cells(model: ort.InferenceSession, crops: np.ndarray) -> list[bool]:
    """Which of these cells holds a tile lying on its side, relative to the rest of the row.

    Relative, and that is the whole point: the photograph may itself be at any quarter turn, so an absolute
    orientation says nothing. What is left is the odd one out — a tile turned a quarter differs from its
    neighbours by one turn or by three, and the photographer turns it either way, while a tile that is merely
    upside down differs by two and is still standing upright in the row.

    Empty when the model has no turn head, which is every model exported before this existed.

    It does not work yet, and the reader does not rely on it. The head is right 93% of the time on synthetic
    crops, 96% with the crop taken 30% into the frame, and 59 of 60 on real cells rotated by hand — and it
    calls every one of the 19 real turned tiles in the sample photos upright, at 0.87 to 0.98, while naming
    their faces correctly. Looked at side by side the cells plainly show a 萬 on its side and the head plainly
    says otherwise.
    Three explanations were tested and none holds: that a real cell is framed too tightly, since the tile fills
    it (a 30% crop costs 13 points, not 96); that the head reads the stretch a rotate-then-resize leaves rather
    than the glyph, since a real cell rotated and then squeezed back to its original shape is still called
    turned 59 times in 60; and that it reads the direction of the lighting, of which _photometric has no term.
    """
    outputs = _run(model, crops)
    if len(outputs) < 2:
        return [False] * len(crops)
    turns = softmax(outputs[1]).argmax(axis=1)
    upright = int(np.bincount(turns, minlength=4).argmax())
    return [bool((int(turn) - upright) % 2) for turn in turns]


def classify(model: ort.InferenceSession, crops: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Best tile class per crop with its probability, and separately the probability of `none`.

    Kept apart because the two are wanted for different things. Ranking candidate runs by plain top-1
    confidence picked the table's plastic housing over the hand: read as fifteen crops of nothing it
    scored 0.844 of confident "none" against the hand's 0.731, so selection has to score confidence
    that something is *a tile*. But whether a crop is nothing at all is still worth knowing, and if
    `none` is simply excluded it becomes unreachable — the check for it downstream was dead code.
    """
    every = probabilities(model, crops)
    faces = every[:, :-1]
    return faces.max(axis=1), faces.argmax(axis=1), every[:, -1]


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
    counts: range = HAND_SIZES,
    full: np.ndarray | None = None,
) -> Reading | Refusal:
    """Reads one photo, or returns the reason it could not be read.

    Tried upright first, at no extra cost for the common case. Only on failure is the photo's tilt
    estimated and a few corrections around it tried — a photo taken at an angle fails at the very
    first step otherwise: `candidate_runs` filters by axis-aligned bounding box, and a tilted row's
    box is far squarer than a straight one's.
    """
    upright = _read_hand_upright(model, labels, size, bgr, counts, full if full is not None else bgr)
    if isinstance(upright, Reading):
        return upright
    angle = _line_angle(tile_mask(bgr))
    if abs(angle) < DESKEW_MIN_ANGLE:
        return upright
    # Stops at the first candidate that is confident enough rather than always trying all of
    # DESKEW_SEARCH — a photo that needed deskewing already cost one extra read; there is no reason
    # to pay for the rest of the nudges once one of them reads the hand cleanly.
    best = None
    for nudge in DESKEW_SEARCH:
        turned = angle + nudge
        candidate = _read_hand_upright(
            model,
            labels,
            size,
            _rotate(bgr, turned),
            counts,
            _rotate(full, turned) if full is not None else _rotate(bgr, turned),
        )
        if not isinstance(candidate, Reading):
            continue
        score = sum(candidate.confidence) / len(candidate.confidence)
        if best is None or score > best[0]:
            best = (score, candidate)
        if score >= CONFIDENT:
            break
    return best[1] if best else upright


def _read_hand_upright(
    model: ort.InferenceSession,
    labels: list[str],
    size: int,
    bgr: np.ndarray,
    counts: range,
    full: np.ndarray,
) -> Reading | Refusal:
    """`read_hand`, assuming the hand is already axis-aligned in `bgr`.

    `full` is the same picture at the resolution it arrived at, turned the same way. Everything that
    searches runs on `bgr`, and only the crops handed to the classifier come from `full`.
    """
    try:
        runs = candidate_runs(bgr)
    except SystemExit as reason:
        return Refusal(str(reason), "nothing in the frame resembles a row of tiles")

    # Every fit and every cut below happens on the run flattened to a rectangle, never on the frame. A row
    # in a photograph is a trapezoid whose depth changes from one end to the other, so its pitch is not
    # constant in the frame and a single pitch is what fit_grid is looking for.
    shape = choose_shape(model, labels, size, runs, counts)
    if shape is None:
        # What went wrong is that no region could be framed as one even row, and saying so is the point:
        # the tiles being few is one cause of it and by far not the commonest. On the sample archive this
        # fires on a row split in two, a row photographed at enough of an angle that no single pitch fits
        # it, and a hand with a tile pushed away from the rest — none of which is about length, and a
        # message about length sent the photographer looking for the wrong thing.
        short = [run for run in runs if meld_candidates(model, labels, size, run)]
        if short:
            # Stated, not diagnosed. Three or four in a row beside the hand is what a meld looks like and
            # also what a row broken into pieces looks like, and picking one reading was wrong on the
            # sample archive as soon as it was tried: two photos with no melds at all were told they
            # looked like a hand with melds, because their row had come apart into runs of that length.
            return Refusal(
                SHORT_RUNS_ONLY,
                f"only {len(short)} run(s) of three or four beside no standing row — either melds, "
                "which are not read on their own yet, or a row that broke into pieces",
            )
        # No separate word for "shot from too far off to one side", though it is a real and distinct way to
        # lose a photo: four of the sample photos are noted for exactly that, at 0.38 to 0.55 of a tile's
        # width against the row's depth where an ordinary one runs 0.66 to 0.92. They are read anyway now,
        # and cleanly — nine to eleven tiles of fourteen with none or one wrong — so the message would have
        # been wrong as well as unnecessary.
        #
        # It stays unnamed because that number cannot be computed here. It needs the tile's width, which needs
        # the count, which is the thing that just failed. Measured from what is available instead — the widest
        # cell any run could hold at any allowed count, over its own depth — the four land at 0.40, 0.49, 0.59
        # and 1.11, straddling the readable photos completely, two of which sit lower than any of them at 0.30
        # and 0.34. Tried once before against the run's box depth with the same result. A message that sends
        # the photographer to change the angle is worse than a vague one when it is wrong this often.
        return Refusal(NO_ROW, "no region frames as one even row of tiles")
    hand, standing, beside = shape

    refined = read_line(model, hand.flat, hand.light, whole(hand.flat), size, refine=True, counts=standing)
    if refined is None:
        return Refusal(UNREADABLE_ROW, "the region that framed as a row could not be sliced")
    _, count, pitch, start, confidence, predicted, _, turned = refined

    # Cut from the photo as it came, not from the copy everything above ran on. Locating the row wants a
    # small image and reading the tiles wants a large one, and until this the tiles were read off the
    # small one too: 38px of tile stretched to the classifier's 64px input, which invents nothing. Cutting
    # the same grid from the original takes a cell from 38px to 106px and per-tile accuracy over the 44
    # marked rows from 71.3% to 91.5%. Nothing else measured this session moved it as far.
    # The winning tile is laid at the end of the row and often a little apart from it, so the mask can stop a
    # tile short. Growing the row's quad by a pitch at either end and re-reading it was tried, and once the
    # count above was being asked for properly it was worth 2 tiles of 377 for eighty lines.
    scale = max(full.shape[:2]) / max(bgr.shape[:2])
    sharp = flatten(full, hand.quad * scale)
    if sharp.size == 0:
        return Refusal(UNREADABLE_ROW, "the region that framed as a row could not be flattened at full size")
    # Both flattenings round their width to whole pixels, so the grid is carried across by the ratio of
    # the two rather than by `scale`.
    stretch = sharp.shape[1] / hand.flat.shape[1]
    # One cut, evenly. Trying two more — the first or the last tile taken to be laid on its side, which is
    # where a called tile and the winning tile go — reads 561 of the 596 marked tiles against 541, so the
    # gain is real on a row whose corners are right. It does not survive the trip through this pipeline's
    # own boxes: end to end it read one photo fewer, and all it did was drop the worst of them. It costs
    # three times the inference on the row, and it is worth coming back to once the boxes are the tiles.
    crops = slice_line(
        sharp, whole(sharp), False, start * stretch, pitch * stretch, count, size, turned=turned
    )
    if crops is None:
        return Refusal(UNREADABLE_ROW, "the region that framed as a row could not be sliced at full size")
    confidence, predicted, _ = classify(model, crops)
    direction = reading_order(bgr, hand.box, [run.box for run, _ in beside])
    if direction.reverse:
        crops = crops[::-1]
        confidence, predicted = confidence[::-1], predicted[::-1]

    tiles = [labels[int(g)] for g in predicted]
    keep, hidden = lift_concealed_kan(tiles)
    tiles = [tiles[i] for i in keep]
    sure = [float(confidence[i]) for i in keep]
    crops = crops[keep]
    melds, notes = keep_possible(tiles, hidden + [meld for _, meld in beside])

    # The winning tile only when which end it sits at was actually established. The calculator moves it
    # to the end of the array itself, so an honest null costs one tap and a guess costs a wrong score.
    winning = tiles[-1] if direction.known and tiles else None
    if not direction.known:
        notes.append(f"which end holds the winning tile is unknown ({direction.why})")
    unsure = [f"#{i + 1} {t}" for i, (t, c) in enumerate(zip(tiles, sure)) if c < CONFIDENT]
    if unsure:
        notes.append(f"least certain about {', '.join(unsure)} — worth a look")
    return Reading(tiles, sure, melds, winning, direction, hand.box, pitch, crops, notes)


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
    original = bgr
    bgr = shrink(bgr, args.long_side)

    model, labels, size = load_model()
    reading = read_hand(model, labels, size, bgr, range(args.min_tiles, args.max_tiles + 1), full=original)
    if isinstance(reading, Refusal):
        raise SystemExit(f"{reading.code}: {reading.why}")

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
    """One set laid aside beside the hand: what kind it is, its tiles, and whether it opened the hand.

    `is_open` decides the score rather than just the display. A 暗杠 is four tiles with two of them turned
    face down, and it is *not* 副露 — it leaves the hand concealed and 门前清 intact — so it carries false,
    while 吃, 碰 and 明杠 all carry true. That is the whole reason the face-down tile is its own class
    instead of part of "not a tile".

    The two turned-over tiles of a 暗杠 cannot be read, and do not need to be: a gang is four of one tile,
    so the pair that is face up names all four.
    """

    kind: str
    tiles: list[str]
    is_open: bool


def judge_meld(tiles: list[str], confidence: list[float], nothing: list[float]) -> Meld | str:
    """What a run of three or four crops is, or the reason it is not a meld.

    Kept free of images so it can be checked against numbers rather than against a composed photograph —
    see tests/test_reader.py. The first attempt at that check built melds out of the calibration crops, and every
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
    #
    # On the mean of the face-up cells rather than the weakest of them: three or four crops that
    # independently agree on one tile corroborate each other in a way one crop cannot, and the shape check
    # below is what keeps that honest — a run has to come out a 吃, 碰 or 杠, at the row's own pitch.
    #
    # The height is not relaxed, and that was measured rather than assumed. Dropping it to 0.6 does let one
    # more meld through on the sample archive, and it costs 8 correctly-read tiles: the meld it admits makes
    # its own photo hold five of a tile, so the whole photo is refused and its standing row goes with it.
    # 308-2's 碰 reads ['5z', '5z', '5z'], correct, at a mean of 0.63, and is still turned away here.
    weakest = sum(confidence[i] for i in faces) / len(faces) if faces else 0.0
    if weakest < MELD_FACE_FLOOR:
        return f"mean face-up confidence {weakest:.2f}"
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


def keep_possible(tiles: list[str], melds: list[Meld]) -> tuple[list[Meld], list[str]]:
    """The melds that can be there beside this row, and a note for any that cannot.

    Four of a tile were ever made, so a meld that would make five of one is wrong. Dropping that meld rather
    than the whole reading, because the harm is confined to it: on the sample photo this fires for, the row
    read all eight of its tiles correctly and one of its two melds came back a 杠 of 2p where the photo holds
    a 碰, and refusing on that threw away fourteen right tiles to avoid one wrong one. The same reasoning the
    refusals themselves rest on — a missing tile costs a tap, a wrong tile costs a wrong score.
    """
    held = Counter(tile for tile in tiles if tile != BACK)
    kept, notes = [], []
    for meld in melds:
        adding = Counter(tile for tile in meld.tiles if tile != BACK)
        if max((held + adding).values(), default=0) > 4:
            notes.append(
                f"a {meld.kind} of {' '.join(meld.tiles)} was dropped — it would make five of a tile"
            )
            continue
        held += adding
        kept.append(meld)
    return kept, notes


def lift_concealed_kan(tiles: list[str]) -> tuple[list[int], list[Meld]]:
    """A 暗杠 found among the standing tiles, taken out of the row and reported as the meld it is.

    Four tiles with the middle two turned over is a 暗杠, and where it sits beside the row with no gap the row
    swallows it: one sample photo reads `back 2z 2z back` in the middle of its standing tiles. Left there it is
    wrong twice over — `back` is not a tile the calculator can score, and a 暗杠 leaves the hand 门前清, which
    it cannot know unless the meld is named.

    Only this exact shape, two backs bracketing two of one tile. A 暗杠 is photographed that way by convention
    and the shape is its own evidence; anything looser would turn a misread cell into a meld.

    Gives back which cells to keep rather than the kept tiles, because the crops and the confidences have to
    lose the same four and a caller that trimmed only the tiles would put the strip out of step with them.
    """
    for i in range(len(tiles) - 3):
        four = tiles[i : i + 4]
        if four[0] == four[3] == BACK and four[1] == four[2] != BACK:
            return list(range(i)) + list(range(i + 4, len(tiles))), [Meld("gang", [four[1]] * 4, False)]
    return list(range(len(tiles))), []


class Candidate(NamedTuple):
    """One reading of a run: what the grid fit and the classifier made of it at some tile count."""

    score: float  # mean classifier confidence, which is how two readings of the same run are ranked
    pitch: float
    tiles: list[str]
    confidence: list[float]
    nothing: list[float]


def choose_meld(candidates: list[Candidate], depth: float) -> list[Meld]:
    """The melds a run holds, from its readings at each length: the best of them, split apart.

    Kept free of images so it can be checked against numbers — see tests/test_reader.py. The first attempt at
    that check built melds out of the calibration crops and every failure it produced came from the
    composition rather than from this logic, which is worse than no check at all: the temptation is then to
    loosen the code until the fixture passes.

    A division counts for whatever melds it does yield; the parts that come out as nothing are dropped and the
    rest kept. A block that divides no way at all into anything that is a meld is not a block of melds.

    Ranked by how close a cell comes to a tile's shape rather than by confidence, and that is what tells three
    cells from four on the same run: their pitches differ by exactly 4/3, so the only question is which width
    is a tile's width, and a three-tile 碰 read as four cells is confidently *something* at 0.75 of the true
    pitch. Ranking by confidence loses it. See TILE_ASPECT.

    This used to compare the run's pitch against the *hand's* pitch, on the reasoning that they are the same
    tiles photographed from the same place. Measured, they are not: over the 22 marked melds the ratio runs
    from 0.62 to 2.18, only 10 of them inside the 0.8–1.25 the check allowed, because a meld with its called
    tile laid on its side is far wider per tile than a standing row and it is often laid nearer or further
    than the row as well. That check cost 50 correctly-read tiles across the archive and rescued none.
    """
    best = None
    for candidate in candidates:
        count = len(candidate.tiles)
        for parts in meld_partitions(count):
            at, found = 0, []
            for part in parts:
                verdict = judge_meld(
                    candidate.tiles[at : at + part],
                    candidate.confidence[at : at + part],
                    candidate.nothing[at : at + part],
                )
                if isinstance(verdict, Meld):
                    found.append(verdict)
                at += part
            if not found:
                continue
            # The most melds a division yields, and among equals the one whose cells come closest to a tile's
            # shape. Requiring *every* part to be a meld threw the good ones away beside a bad one: on one
            # photo a block of six read 4p 5p 6p and then 7z 7z 2s — a 吃 read perfectly and a 碰 with one cell
            # misread — and the whole block was dropped for the sake of the second.
            off = abs(candidate.pitch / max(depth, 1) - TILE_ASPECT)
            if best is None or (len(found), -off) > (len(best[1]), -best[0]):
                best = (off, found)
    return best[1] if best else []


def meld_partitions(count: int):
    """Every way a block of `count` cells divides into melds, each of three tiles or four."""
    for fours in range(count // 4 + 1):
        rest = count - fours * 4
        if rest and rest % 3 == 0:
            yield [4] * fours + [3] * (rest // 3)
        elif not rest and fours:
            yield [4] * fours


def read_melds_in(model: ort.InferenceSession, labels: list[str], size: int, run: Run) -> list[Meld]:
    """The melds this run holds: one, or several butted together and split apart.

    Several, because the gap the photographer leaves goes between the hand and the melds rather than between
    each meld. Over the sample photos every single meld left a gap of about a tile's width and every one of
    those was found; every photo with two or three of them left the gap before the first and butted the rest
    together, at row gaps of 2.5 to 8 tile widths that did no good at all — the run holds six or nine tiles and
    matches no meld length, so all of them were lost. Read whole and divided into threes and fours, the true
    total is the best-scoring reading on three of those four photos.
    """
    depth, width = run.flat.shape[:2]
    readings = []
    for count in (*MELD_SIZES, *MELD_BLOCKS):
        # Arithmetic before inference. A run 365px long and 64 deep cannot hold fourteen tiles at any pitch a
        # tile's shape allows, and finding that out by classifying fourteen crops costs 20ms a time. The
        # window is widened a tenth because the fitted pitch may differ from length/count by that much.
        if not MIN_PITCH_RATIO / 1.1 <= width / count / max(depth, 1) <= MAX_PITCH_RATIO * 1.1:
            continue
        fit = read_line(model, run.flat, run.light, whole(run.flat), size, refine=False, counts=(count,))
        if fit is None:
            continue
        readings.append(
            Candidate(
                fit[0],
                fit[2],
                [labels[int(g)] for g in fit[5]],
                [float(c) for c in fit[4]],
                [float(n) for n in fit[6]],
            )
        )
    return choose_meld(readings, run.flat.shape[0])


def meld_candidates(model: ort.InferenceSession, labels: list[str], size: int, run: Run) -> list[Candidate]:
    """Every reading of a run as a meld: one per length a meld can be.

    Each length asked for by name, which is all read_line does now — on a run this short the unconstrained fit
    answered four cells at 70% of the true pitch on a composed three-tile 碰.

    Unrefined, because what these are for is counting the melds and choosing between three cells and four,
    and the nudges change neither: they cost 225ms a photo and moved nothing on the sample archive. Whether
    the tiles they name are worth refining is not yet a question the archive can answer — no meld has been
    reported on any of the 22 marked ones.
    """
    out = []
    for length in MELD_SIZES:
        fit = read_line(model, run.flat, run.light, whole(run.flat), size, refine=False, counts=(length,))
        if fit is None:
            continue
        out.append(
            Candidate(
                fit[0],
                fit[2],
                [labels[int(g)] for g in fit[5]],
                [float(c) for c in fit[4]],
                [float(n) for n in fit[6]],
            )
        )
    return out


def choose_shape(
    model: ort.InferenceSession, labels: list[str], size: int, runs: list[Run], counts: range
) -> tuple[Run, tuple[int, ...], list[tuple[Run, Meld]]] | None:
    """Which run is the standing row, how long it is, and which runs beside it are melds — as one answer.

    The row's own reading settles its length and nothing else does. That is the third design here and the
    first that works. Counting the melds first and subtracting was wrong in both directions at once: every run
    that happened to fit three or four cells was counted, so hands with no melds had two invented and their
    row was asked for eight tiles, while hands with real melds read none of them. Requiring a meld run beside
    the row to corroborate the count was wrong for a different reason — when the melds are butted against the
    row they share its blob, so no meld run exists to corroborate anything and no meld count can ever hold. One
    sample photo has the right region fitting its 8 tiles at 0.83 under two melds and was refused outright for
    want of a meld run, while the wrong answer at one meld scored 0.31. Dropping the requirement is worth 19 of
    the 477 sample tiles.

    So: the fewest melds whose arithmetic leaves a row that reads well, and the melds are then read out of
    whatever sits beside it. Fewest, because scoring across meld counts cannot work — each extra meld takes
    three tiles off the row, mean confidence rises every time a cell is dropped, and the highest score is
    therefore always the emptiest hand. Tried, and it read a row of ten as eight on three photos.
    """
    for melds in range(5):
        standing = standing_sizes(counts, melds)
        if not standing:
            break
        best = None
        for run in runs:
            fit = read_line(model, run.flat, run.light, whole(run.flat), size, refine=False, counts=standing)
            if fit is None or sum(labels[int(g)] == BACK for g in fit[5]) > MAX_BACKS_STANDING:
                continue
            # Plain mean confidence. Weighting it by how solidly the region is tile was tried, to stop a
            # region that swallowed the row and its melds together from beating the row's own — which it does
            # on two of the samples, at IoU 0.89 and 0.92. It fixes those two and costs 12 tiles elsewhere.
            if best is None or fit[0] > best[0]:
                best = (fit[0], fit, run)
        if best is None or best[0] < SETTLED_ROW:
            continue
        _, fit, hand = best
        # Read only now, and only if the arithmetic says there is something to read. Reading every run as a
        # possible block of melds costs 10s a photo, against 0.8s for the whole of the rest of this; nothing
        # about it belongs in the search when the search no longer depends on it.
        #
        # Note that nothing here forbids a meld holding a tile the row also holds. The same tile can perfectly
        # well be standing and in a meld — 碰 7m, then wait on 4m/7m holding 5m 6m.
        found: list[tuple[Run, Meld]] = []
        if melds:
            for run in runs:
                if run.box == hand.box:
                    continue
                found += [(run, meld) for meld in read_melds_in(model, labels, size, run)]
        # Fewer melds may come back than the row's length assumed, and then the answer is short by three
        # tiles for each one missing. That looks like a bug and is not: making it consistent was measured
        # three ways and every one of them is worse. Reading the row again at the length the melds found do
        # imply gives 490 of the 597 sample tiles against 518; refusing outright when they do not match gives
        # 476 and turns one refusal into eight, and a refusal costs the photographer all fourteen tiles.
        # Eleven cells cut across fourteen tiles read eleven of them right, and handing those back beats
        # every consistent alternative.
        return hand, standing, found[:melds]
    return None


class Direction(NamedTuple):
    """Which way along the run the hand reads, and whether that was actually established."""

    reverse: bool
    known: bool
    why: str


def rail_side(bgr: np.ndarray, hand_box: tuple[int, int, int, int]) -> bool | None:
    """Whether the table's edge is on the low side of the run across it, or None if neither side is it.

    Every player pushes their hand up against the edge in front of them, so the side that edge lies on
    says which seat the hand belongs to, and that is what fixes which end holds the winning tile. Felt is
    strongly coloured — green on one of the two tables here, brown on the other — and the housing beside
    it is grey, so the two are told apart by chroma and not by lightness. That is measured, not assumed:
    over the 35 rows marked by hand the housing is often the *lighter* of the two sides, and picking the
    greyer one gets the seat right on 31 of 33 against 15 of 33 for picking the darker.
    """
    x, y, w, h = hand_box
    vertical = h >= w
    depth = w if vertical else h
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    chroma = np.hypot(lab[:, :, 1].astype(float) - 128, lab[:, :, 2].astype(float) - 128)
    sides = []
    for outward in (-1, 1):
        if vertical:
            edge = x - depth if outward < 0 else x + w
            band = chroma[y : y + h, max(edge, 0) : edge + depth]
        else:
            edge = y - depth if outward < 0 else y + h
            band = chroma[max(edge, 0) : edge + depth, x : x + w]
        sides.append(float(band.mean()) if band.size else None)
    low, high = sides
    if low is None or high is None:
        return None
    # One side has to actually be the housing. Where the row sits out on open felt both sides come back
    # coloured to a similar degree, and then which seat it is cannot be told from the edge at all.
    greyer, coloured = min(low, high), max(low, high)
    if coloured < greyer * MIN_RAIL_CONTRAST:
        return None
    return low < high


def reading_order(
    bgr: np.ndarray, hand_box: tuple[int, int, int, int], meld_boxes: list[tuple[int, int, int, int]]
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

    Failing that, the table's edge, which the hand is pushed up against: see rail_side. Which side it
    lies on gives the seat, and the seat gives the direction — a hand across the frame with the housing
    above it belongs to the player opposite and reads right to left, while one up the frame with the
    housing to its left belongs to the player on the left and reads top to bottom.

    What used to be here instead was the frame alone: a hand lying across it was taken to read left to
    right. That is only true of the photographer's own hand, and it was wrong on 14 of the 35 rows in the
    sample archive — 40% — while reporting that it knew. A wrong winning tile is a wrong score, so when
    neither the melds nor the edge settles it this now says so instead. An admitted unknown is one tap in
    the review screen.
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
    rail_low = rail_side(bgr, hand_box)
    if rail_low is None:
        return Direction(False, False, "no melds in line and neither side of the hand is the table's edge")
    # A hand across the frame with the housing above it is the player opposite, reading right to left;
    # up the frame with the housing to its left is the player on the left, reading top to bottom.
    reverse = not rail_low if vertical else rail_low
    seat = ("left of" if rail_low else "right of") if vertical else ("across from" if rail_low else "held by")
    return Direction(reverse, True, f"the table's edge puts this hand {seat} the camera")


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


if __name__ == "__main__":
    main()
