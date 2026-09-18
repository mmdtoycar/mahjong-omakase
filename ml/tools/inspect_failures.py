"""Dumps the crops the classifier gets wrong, so the number can be interpreted rather than tuned.

The confusion counts say the 萬 suit is the weak spot — 2m read as 1m and so on, which is plausible
enough, since those faces differ only in how many strokes sit above the character. But a count cannot
say whether the model is missing something legible or whether the augmentation destroyed the evidence
and the label is no longer recoverable from the image. Those call for opposite responses, and only
looking settles it.

Two sources of crops, and the second matters more. `--synthetic` draws them the way training does, which says
what the model was taught. `--marked` cuts them out of the sample photos at the corners marked by hand, which
says what it does on the thing it is actually for — and it has never been trained on one of those.

    python -m tools.inspect_failures --marked ../mahjong-samples
    python -m tools.inspect_failures --synthetic --hard
"""

import argparse
import collections
import json
from pathlib import Path

import cv2
import numpy as np

from recognition.tiles import DATA, NOT_A_TILE, RUNS, SIZE


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--marked", type=Path, help="the sample archive, to cut crops from its marked corners"
    )
    parser.add_argument("--synthetic", action="store_true", help="draw crops the way training does")
    parser.add_argument("--per-class", type=int, default=200)
    parser.add_argument("--hard", action="store_true", help="use the widened ranges")
    args = parser.parse_args()

    if args.marked:
        marked(args.marked)
        return
    if not args.synthetic:
        raise SystemExit("pick a source of crops: --marked <archive> or --synthetic")
    import torch

    from training.synthesize import Synthesiser, load_tiles
    from training.train_classifier import HARD_SEEDS, VAL_SEEDS, TileNet

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
                image = synth.sample_negative() if labels[target] == NOT_A_TILE else synth.sample(target)[0]
                rgb = image[:, :, ::-1].astype(np.float32) / 255.0
                batch = torch.from_numpy(np.ascontiguousarray(rgb.transpose(2, 0, 1)) - 0.5)[None]
                logits = model(batch)[0][0]
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


def marked(samples: Path) -> None:
    """Every marked tile the classifier reads wrong, cut from the corners marked by hand.

    Cut at the recorded tile count and divided evenly, which is the cleanest cut there is: no region to find,
    no count to fit, no phase to search. Whatever is wrong here is the classifier and nothing else.
    """
    from recognition.reader import classify, load_model
    from tools.annotate_samples import cells_of, order_corners, rectify

    marks = json.loads((samples / "annotations.json").read_text())
    problems = json.loads((samples / "photo-problems.json").read_text())
    model, labels, size = load_model()
    failures, total = [], 0
    for key, mark in sorted(marks.items()):
        if not (samples / key).exists():
            continue
        photo = cv2.imread(str(samples / key))
        rows = [(mark["corners"], mark["tiles"])]
        rows += [(m["corners"], m["tiles"]) for m in mark.get("melds", [])]
        for corners, wanted in rows:
            quad = order_corners([tuple(c) for c in corners]).astype(np.float32)
            cells = [cell for cell in cells_of(rectify(photo, quad), len(wanted)) if cell.size]
            if len(cells) != len(wanted):
                continue
            batch = np.stack([cv2.resize(c, (size, size), interpolation=cv2.INTER_AREA) for c in cells])
            confidence, predicted, _ = classify(model, batch)
            for cell, sure, guess, want in zip(batch, confidence, predicted, wanted):
                total += 1
                if labels[int(guess)] != want:
                    failures.append((f"{want} {key.split('/')[0]}", labels[int(guess)], float(sure), cell))
    print(
        f"cut from the marked corners: {len(failures)} wrong out of {total} ({1 - len(failures) / total:.4f})"
    )
    counts = collections.Counter((a.split()[0], g) for a, g, _, _ in failures)
    print("  " + ", ".join(f"{a}->{g} x{n}" for (a, g), n in counts.most_common(14)))
    if failures:
        grid(failures, DATA / "failures_marked.png", SIZE)
    turned(samples, marks, problems, model, size)


def turned(samples: Path, marks: dict, problems: dict, model, size: int) -> None:
    """Whether the turn head finds the tile lying on its side, against the position marked by hand.

    The one number that says whether knowing the orientation is worth having. A called meld is marked by laying
    its called tile on its side, so that tile is where one meld ends and the next begins — and the melds are set
    aside in a line with no gap between them, which is why a block of them cannot be told apart today. The
    annotations record which cell it is, so this is checkable.

    Chance is one in three on a meld of three. A geometric substitute was tried first, since turning a face
    swaps the axes its ink spreads along, and it got 7 of 15 — which is why the model was asked instead.
    """
    from recognition.reader import turned_cells
    from tools.annotate_samples import cells_of, order_corners, rectify

    hits = rows = 0
    print("\nthe turned tile, against the position marked by hand:")
    for key, mark in sorted(marks.items()):
        for meld in [m for m in mark.get("melds", []) if m.get("sideways", 0) >= 1]:
            photo = cv2.imread(str(samples / key))
            quad = order_corners([tuple(c) for c in meld["corners"]]).astype(np.float32)
            cells = [c for c in cells_of(rectify(photo, quad), len(meld["tiles"])) if c.size]
            if len(cells) != len(meld["tiles"]):
                continue
            batch = np.stack([cv2.resize(c, (size, size), interpolation=cv2.INTER_AREA) for c in cells])
            named = [i + 1 for i, turn in enumerate(turned_cells(model, batch)) if turn]
            rows += 1
            hit = named == [meld["sideways"]]
            hits += hit
            print(
                f"  {key.split('/')[0]:8s} {' '.join(meld['tiles']):14s} marked {meld['sideways']}"
                f"  called {named or 'none'}{'' if hit else '   <- wrong'}"
            )
    print(f"\nexactly right on {hits} of {rows} melds (one in three is chance on a meld of three)")


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
