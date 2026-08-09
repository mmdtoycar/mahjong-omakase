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
from pathlib import Path
from typing import NamedTuple

import cv2
import numpy as np
import torch

from grid_fit import fit_grid
from synthesize import BACK, DATA, SIZE
from train_classifier import RUNS, TileNet

# A tile face is near-white: bright, and far less coloured than green felt or a brown table.
MIN_LIGHTNESS = 150
MAX_CHROMA = 26

MIN_RUN_ASPECT = 2.0  # below this a blob is a single tile, not a line of them

# How far the classifier is allowed to move the geometric fit. Small on purpose: the fit is already
# within a pixel of the brute-force answer, and every step here costs a forward pass per tile.
PITCH_NUDGE = (0.99, 1.0, 1.01)
OFFSET_NUDGE = (-0.04, 0.0, 0.04)
COUNT_NUDGE = (-1, 0, 1)  # the run's box can clip a tile at either end

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
    model: torch.nn.Module,
    bgr: np.ndarray,
    light: np.ndarray,
    box: tuple[int, int, int, int],
    size: int,
    refine: bool,
    counts,
    expect: int | None = None,
) -> tuple[float, int, float, float, torch.Tensor, torch.Tensor, torch.Tensor] | None:
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
        [
            (pitch * p, offset + pitch * o, count + c)
            for p in PITCH_NUDGE
            for o in OFFSET_NUDGE
            for c in COUNT_NUDGE
        ]
        if refine
        else [(pitch, offset, count)]
    )

    best = None
    for candidate_pitch, candidate_offset, candidate_count in combinations:
        if candidate_count not in counts:
            continue
        crops = slice_line(
            bgr, box, vertical, candidate_offset, candidate_pitch, candidate_count, size
        )
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
        crop = (
            bgr[a:b, x + inset : x + w - inset] if vertical else bgr[y + inset : y + h - inset, a:b]
        )
        if crop.size == 0 or crop.shape[0] < 8 or crop.shape[1] < 8:
            return None
        crops.append(cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA))
    return np.stack(crops)


def classify(
    model: torch.nn.Module, crops: np.ndarray
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Best tile class per crop with its probability, and separately the probability of `none`.

    Kept apart because the two are wanted for different things. Ranking candidate runs by plain top-1
    confidence picked the table's plastic housing over the hand: read as fifteen crops of nothing it
    scored 0.844 of confident "none" against the hand's 0.731, so selection has to score confidence
    that something is *a tile*. But whether a crop is nothing at all is still worth knowing, and if
    `none` is simply excluded it becomes unreachable — the check for it downstream was dead code.
    """
    rgb = (crops[:, :, :, ::-1].astype(np.float32) / 255.0) - 0.5
    with torch.no_grad():
        probabilities = torch.softmax(
            model(torch.from_numpy(np.ascontiguousarray(rgb.transpose(0, 3, 1, 2)))), 1
        )
    confidence, predicted = probabilities[:, :-1].max(1)
    return confidence, predicted, probabilities[:, -1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("photo", type=Path)
    # A target size rather than a scale factor, because what matters is how many pixels a tile ends up
    # being, and that follows from the absolute size. This was a fixed 0.25, which suited the 5712px
    # photo it was written against and silently miscounted a 1280px one — 12 tiles instead of 13, at
    # 0.55 mean confidence, because each tile came out 31px wide.
    #
    # 900 puts a tile at roughly 55px. Both hand photos tried frame the hand about the same way, so the
    # pitch comes to 6.1% of the long side in both, and this is the one setting that read every tile
    # correctly with the most of them above the confidence floor. It is close to the classifier's own
    # 64px input, which is the sense in which it is not arbitrary: shrinking further throws away detail
    # the model would use, and going much larger only sharpens the crop's edges into features the
    # synthetic training data does not have. Every setting from 640 to 1707 read this photo correctly,
    # so the exact number is not delicate — 0.25 was simply far below the range.
    parser.add_argument("--long-side", type=int, default=900)
    parser.add_argument("--min-tiles", type=int, default=12)
    parser.add_argument("--max-tiles", type=int, default=15)
    # Under data/ rather than /tmp: that directory is this script's own and gitignored, so two runs on
    # photos with the same stem cannot collide with each other or with anything else on the machine.
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    bgr = cv2.imread(str(args.photo))
    if bgr is None:
        raise SystemExit(f"cannot read {args.photo}")
    # Only ever down. Enlarging a photo that is already smaller than this invents no detail and would
    # push the tiles past the size the model was trained to see.
    scale = min(1.0, args.long_side / max(bgr.shape[:2]))
    if scale < 1.0:
        bgr = cv2.resize(bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    checkpoint = torch.load(RUNS / "classifier.pt")
    labels = checkpoint["labels"]
    size = checkpoint.get("size", SIZE)
    model = TileNet(len(labels))
    model.load_state_dict(checkpoint["state"])
    model.eval()

    light = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)
    counts = range(args.min_tiles, args.max_tiles + 1)
    runs = candidate_runs(bgr)
    print(f"{args.photo.name} at {bgr.shape[1]}x{bgr.shape[0]}, {len(runs)} candidate runs")

    # The standing hand and the melds are separate runs — the melds are set aside on the right with a
    # gap, so the mask gives them their own blobs. Read every run that could be either.
    hand_candidates, melds = [], []
    for box in runs:
        for sizes, bucket in ((counts, hand_candidates), (MELD_SIZES, melds)):
            fit = read_line(model, bgr, light, box, size, refine=False, counts=sizes)
            if fit is None:
                continue
            print(f"  {box}: {fit[1]} tiles at pitch {fit[2]:.1f}px, confidence {fit[0]:.3f}")
            bucket.append((fit[0], box))
            break
    if not hand_candidates:
        raise SystemExit("no run long enough to be a hand")
    box = max(hand_candidates)[1]

    refined = read_line(model, bgr, light, box, size, refine=True, counts=counts)
    if refined is None:
        raise SystemExit("no run could be read")
    score, count, pitch, start, confidence, predicted, _ = refined
    print(f"\nchose {box}: {count} tiles, pitch {pitch:.1f}px, mean confidence {score:.3f}\n")
    for i, (guess, sure) in enumerate(zip(predicted.tolist(), confidence.tolist()), 1):
        mark = "" if sure >= CONFIDENT else "   <- hand this one back"
        print(f"  {i:2d}. {labels[guess]:4s} {sure:.2f}{mark}")
    kept = sum(1 for c in confidence.tolist() if c >= CONFIDENT)
    print(f"\n{kept}/{count} at confidence >= {CONFIDENT}\n")

    read_melds(model, bgr, light, melds, box, pitch, size, labels)

    x, y, w, h = box
    vertical = h >= w
    crops = slice_line(bgr, box, vertical, start, pitch, count, size)
    out = args.output or DATA / f"{args.photo.stem}_read.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet(crops, labels, predicted, confidence, out)


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


def judge_meld(
    tiles: list[str], confidence: list[float], nothing: list[float]
) -> Meld | str:
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


def read_melds(
    model: torch.nn.Module,
    bgr: np.ndarray,
    light: np.ndarray,
    melds: list[tuple[float, tuple[int, int, int, int]]],
    hand_box: tuple[int, int, int, int],
    hand_pitch: float,
    size: int,
    labels: list[str],
) -> list[Meld]:
    """Reads the runs of three or four set aside beside the hand, as (kind, tiles, isOpen).

    Two distinctions here decide the score rather than just the display:

    A 暗杠 is four tiles with two of them turned face down. It is *not* 副露 — it leaves the hand
    concealed and 门前清 intact — so it carries isOpen false, while 吃, 碰 and 明杠 all carry true.
    That is the whole reason the face-down tile is its own class instead of part of "not a tile".

    The two turned-over tiles of a 暗杠 cannot be read, and do not need to be: a gang is four of one
    tile, so the pair that is face up names all four.
    """
    found = []
    for _, box in melds:
        if box == hand_box:
            continue
        # Each meld length asked for by name, keeping whichever the classifier is happiest with. See
        # the note on `expect` in read_line for why the blind fit is not good enough on a run this short.
        fit = None
        for length in MELD_SIZES:
            attempt = read_line(
                model, bgr, light, box, size, refine=True, counts=(length,), expect=length
            )
            if attempt is not None and (fit is None or attempt[0] > fit[0]):
                fit = attempt
        if fit is None:
            continue
        ratio = fit[2] / hand_pitch
        if not MIN_PITCH_MATCH <= ratio <= MAX_PITCH_MATCH:
            print(
                f"  meld at {box}: pitch {fit[2]:.1f}px is {ratio:.0%} of the hand's"
                f" {hand_pitch:.1f}px, not the same tiles"
            )
            continue
        _, _, _, _, confidence, predicted, nothing = fit
        tiles = [labels[int(g)] for g in predicted]
        verdict = judge_meld(tiles, [float(c) for c in confidence], [float(n) for n in nothing])
        if isinstance(verdict, str):
            print(f"  meld at {box}: {tiles} — {verdict}, skipped")
            continue
        print(f"  meld at {box}: {verdict.kind} {verdict.tiles} isOpen={verdict.is_open}")
        found.append(verdict)
    return found


def sheet(
    crops: np.ndarray,
    labels: list[str],
    predicted: torch.Tensor,
    confidence: torch.Tensor,
    path: Path,
) -> None:
    cell = 110
    out = np.full((len(crops) * (cell + 18), cell + 230, 3), 255, np.uint8)
    for i, crop in enumerate(crops):
        y = i * (cell + 18)
        out[y : y + cell, :cell] = cv2.resize(crop, (cell, cell))
        sure = float(confidence[i])
        colour = (0, 140, 0) if sure >= CONFIDENT else (0, 0, 190)
        cv2.putText(
            out,
            f"{i + 1}. {labels[predicted[i]]} {sure:.2f}",
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
        ("back is likelier nothing", ["5p", "5p", BACK, BACK], [good, good, 0.2, 0.9], [0.01, 0.01, 0.7, 0.01], None),
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
    print(f"\n{len(cases) - failures}/{len(cases)} correct")
    return failures


if __name__ == "__main__":
    import sys

    if "--self-check" in sys.argv:
        sys.exit(1 if self_check() else 0)
    main()
