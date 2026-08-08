"""Reads a real hand photo end to end: finds the tiles, then names them with the classifier.

Written to answer whether the staged plan was too cautious, and it was. A hand is laid out as a line
of butted tiles, bright and nearly colourless against strongly coloured felt, so finding the line is
a thresholding problem rather than a detection problem — no trained detector, and none of the labelled
photos that would need.

Splitting the line is the part that needs care. The tiles touch, so the line comes back as one blob,
and a brightness profile along it does not show the seams reliably: the engraved characters dip just
as deep. What works instead is to let the classifier find its own alignment. Sweep the start and the
pitch, score each candidate by the mean confidence over the tiles it produces, and keep the best. A
misaligned crop is half of one tile and half of the next, which the classifier is not confident about
— so confidence is exactly the signal that says the grid is wrong.

On one real photo, from a table the model has never seen and felt a different colour from the
calibration photo, this reads 13 of 13 tiles correctly, ten of them above 0.85.
"""

import argparse
from pathlib import Path

import cv2
import numpy as np
import torch

from synthesize import DATA, SIZE
from train_classifier import RUNS, TileNet

# A tile face is near-white: bright, and far less coloured than green felt or a brown table.
MIN_LIGHTNESS = 150
MAX_CHROMA = 26

MIN_RUN_ASPECT = 2.0  # below this a blob is a single tile, not a line of them
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
    box: tuple[int, int, int, int],
    size: int,
    counts: range,
) -> tuple[float, int, float, torch.Tensor, torch.Tensor]:
    """Best (start, pitch, count) for the line, chosen by the classifier's own mean confidence."""
    x, y, w, h = box
    vertical = h >= w
    length = h if vertical else w
    best = None
    across = w if vertical else h
    for count in counts:
        nominal = length / count
        if not MIN_TILE_RATIO <= nominal / across <= MAX_TILE_RATIO:
            continue
        for pitch in np.arange(nominal * 0.94, nominal * 1.07, nominal * 0.01):
            for start in np.arange(-nominal * 0.3, nominal * 0.3, nominal * 0.04):
                crops = slice_line(bgr, box, vertical, start, float(pitch), count, size)
                if crops is None:
                    continue
                confidence, predicted = classify(model, crops)
                score = float(confidence.mean())
                if best is None or score > best[0]:
                    best = (score, count, float(pitch), float(start), confidence, predicted)
    if best is None:
        raise SystemExit("could not fit a grid to the line")
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

    runs = candidate_runs(bgr)
    print(f"{args.photo.name} at {bgr.shape[1]}x{bgr.shape[0]}, {len(runs)} candidate runs")
    best = None
    for box in runs:
        try:
            fit = read_line(model, bgr, box, size, range(args.min_tiles, args.max_tiles + 1))
        except SystemExit:
            continue
        print(f"  {box}: mean confidence {fit[0]:.3f} over {fit[1]} tiles")
        if best is None or fit[0] > best[0][0]:
            best = (fit, box)
    if best is None:
        raise SystemExit("no run could be read")
    (score, count, pitch, start, confidence, predicted), box = best
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
