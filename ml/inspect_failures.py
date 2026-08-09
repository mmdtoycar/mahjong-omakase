"""Dumps the samples the classifier gets wrong, so the number can be interpreted rather than tuned.

The confusion counts say the 萬 suit is the weak spot — 2m read as 1m and so on, which is plausible
enough, since those faces differ only in how many strokes sit above the character. But a count cannot
say whether the model is missing something legible or whether the augmentation destroyed the evidence
and the label is no longer recoverable from the image. Those call for opposite responses, and only
looking settles it.
"""

import argparse
from pathlib import Path

import cv2
import numpy as np
import torch

from synthesize import NOT_A_TILE, SIZE, Synthesiser, load_tiles
from train_classifier import HARD_SEEDS, VAL_SEEDS, TileNet

RUNS = Path(__file__).resolve().parent / "runs"
DATA = Path(__file__).resolve().parent / "data"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-class", type=int, default=200)
    parser.add_argument("--hard", action="store_true", help="use the widened ranges")
    args = parser.parse_args()

    checkpoint = torch.load(RUNS / "classifier.pt")
    # Labels from the checkpoint, not from the crops: the trained head has the extra `none` class and
    # building the model from 34 labels fails outright on the head shape.
    face_labels, faces, masks = load_tiles()
    labels = checkpoint["labels"]
    if labels != [*face_labels, NOT_A_TILE]:
        raise SystemExit(f"checkpoint labels {labels} do not match the crops in data/faces")
    size = checkpoint.get("size", SIZE)
    model = TileNet(len(labels))
    model.load_state_dict(checkpoint["state"])
    model.eval()

    low, high = HARD_SEEDS if args.hard else VAL_SEEDS
    failures = []
    total = 0
    with torch.no_grad():
        for target in range(len(labels)):
            for n in range(args.per_class):
                seed = low + (target * args.per_class + n) % (high - low)
                synth = Synthesiser(faces, masks, seed=seed, hard=args.hard, size=size, labels=face_labels)
                image = synth.sample_negative() if labels[target] == NOT_A_TILE else synth.sample(target)
                rgb = image[:, :, ::-1].astype(np.float32) / 255.0
                batch = torch.from_numpy(np.ascontiguousarray(rgb.transpose(2, 0, 1)) - 0.5)[None]
                logits = model(batch)[0]
                guess = int(logits.argmax())
                total += 1
                if guess != target:
                    confidence = torch.softmax(logits, 0)[guess].item()
                    failures.append((labels[target], labels[guess], confidence, image))

    split = "widened" if args.hard else "same distribution"
    print(f"{split}: {len(failures)} wrong out of {total} ({1 - len(failures) / total:.4f})")
    if not failures:
        return

    counts: dict[tuple[str, str], int] = {}
    for actual, guess, _, _ in failures:
        counts[(actual, guess)] = counts.get((actual, guess), 0) + 1
    print(
        "  " + ", ".join(f"{a}->{g} x{n}" for (a, g), n in sorted(counts.items(), key=lambda kv: -kv[1])[:12])
    )

    grid(failures[:96], DATA / f"failures_{'hard' if args.hard else 'val'}.png", size)


def grid(failures: list, path: Path, size: int) -> None:
    """Each failure with what it is and what the model said, at three times scale to be readable."""
    scale = 3
    cell = size * scale
    columns = 8
    rows = (len(failures) + columns - 1) // columns
    sheet = np.full((rows * (cell + 22), columns * cell, 3), 255, np.uint8)
    for i, (actual, guess, confidence, image) in enumerate(failures):
        r, c = divmod(i, columns)
        y, x = r * (cell + 22), c * cell
        sheet[y : y + cell, x : x + cell] = cv2.resize(image, (cell, cell), interpolation=cv2.INTER_NEAREST)
        cv2.putText(
            sheet,
            f"{actual} -> {guess} {confidence:.2f}",
            (x + 3, y + cell + 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (0, 0, 160),
            1,
            cv2.LINE_AA,
        )
    cv2.imwrite(str(path), sheet)
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
