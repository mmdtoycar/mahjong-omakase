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

import cv2
import numpy as np
import torch

from grid_fit import fit_grid
from synthesize import DATA, SIZE
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
) -> tuple[float, int, float, float, torch.Tensor, torch.Tensor] | None:
    """Reads one run, starting from its geometric fit.

    With `refine` false this costs a single forward pass, which is all that is needed to tell a row of
    tiles from a strip of the table's plastic housing. The winner is then read again with `refine` on.
    """
    x, y, w, h = box
    vertical = h >= w
    fit = fit_grid(light, box, vertical)
    if fit is None:
        return None
    pitch, offset, count = fit

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
        if candidate_count < 1:
            continue
        crops = slice_line(
            bgr, box, vertical, candidate_offset, candidate_pitch, candidate_count, size
        )
        if crops is None:
            continue
        confidence, predicted = classify(model, crops)
        score = float(confidence.mean())
        if best is None or score > best[0]:
            best = (
                score,
                candidate_count,
                candidate_pitch,
                candidate_offset,
                confidence,
                predicted,
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


def classify(model: torch.nn.Module, crops: np.ndarray) -> tuple[torch.Tensor, torch.Tensor]:
    """Best tile class per crop, with its probability. The none class is reported separately."""
    rgb = (crops[:, :, :, ::-1].astype(np.float32) / 255.0) - 0.5
    with torch.no_grad():
        probabilities = torch.softmax(
            model(torch.from_numpy(np.ascontiguousarray(rgb.transpose(0, 3, 1, 2)))), 1
        )
    # Score on the tile classes only. Ranking candidate runs by plain top-1 confidence picked the
    # table's plastic housing over the hand: read as fifteen crops of nothing, it scored 0.844 of
    # confident "none" against the hand's 0.731. Confidence that something is *a tile* is the
    # quantity that was wanted all along.
    return probabilities[:, :-1].max(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("photo", type=Path)
    parser.add_argument("--scale", type=float, default=0.25)
    parser.add_argument("--min-tiles", type=int, default=12)
    parser.add_argument("--max-tiles", type=int, default=15)
    # Under data/ rather than /tmp: that directory is this script's own and gitignored, so two runs on
    # photos with the same stem cannot collide with each other or with anything else on the machine.
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    bgr = cv2.imread(str(args.photo))
    if bgr is None:
        raise SystemExit(f"cannot read {args.photo}")
    if args.scale != 1.0:
        bgr = cv2.resize(bgr, None, fx=args.scale, fy=args.scale, interpolation=cv2.INTER_AREA)

    checkpoint = torch.load(RUNS / "classifier.pt")
    labels = checkpoint["labels"]
    size = checkpoint.get("size", SIZE)
    model = TileNet(len(labels))
    model.load_state_dict(checkpoint["state"])
    model.eval()

    light = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float)
    runs = candidate_runs(bgr)
    print(f"{args.photo.name} at {bgr.shape[1]}x{bgr.shape[0]}, {len(runs)} candidate runs")

    # One pass each to pick the run, then the neighbourhood search on the winner alone.
    scored = []
    for box in runs:
        fit = read_line(model, bgr, light, box, size, refine=False)
        if fit is None:
            print(f"  {box}: no grid fits")
            continue
        print(f"  {box}: {fit[1]} tiles at pitch {fit[2]:.1f}px, confidence {fit[0]:.3f}")
        scored.append((fit[0], box))
    if not scored:
        raise SystemExit("no run could be read")
    box = max(scored)[1]

    refined = read_line(model, bgr, light, box, size, refine=True)
    if refined is None:
        raise SystemExit("no run could be read")
    score, count, pitch, start, confidence, predicted = refined
    print(f"\nchose {box}: {count} tiles, pitch {pitch:.1f}px, mean confidence {score:.3f}\n")
    for i, (guess, sure) in enumerate(zip(predicted.tolist(), confidence.tolist()), 1):
        mark = "" if sure >= CONFIDENT else "   <- hand this one back"
        print(f"  {i:2d}. {labels[guess]:3s} {sure:.2f}{mark}")
    kept = sum(1 for s in confidence.tolist() if s >= CONFIDENT)
    print(f"\n{kept}/{count} at confidence >= {CONFIDENT}")

    x, y, w, h = box
    vertical = h >= w
    crops = slice_line(bgr, box, vertical, start, pitch, count, size)
    out = args.output or DATA / f"{args.photo.stem}_read.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet(crops, labels, predicted, confidence, out)


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


if __name__ == "__main__":
    main()
