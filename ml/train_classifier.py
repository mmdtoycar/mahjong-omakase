"""Trains the tile-face classifier on synthetic data and reports how far that number can be trusted.

The architecture is deliberately small. It has to run per tile, ideally in a browser on a phone, and
naming one of 34 fixed faces from a 64px crop is an easy problem for a convolutional network — the
hard part of this project is the data, not the model.

On the numbers this prints: **validation accuracy here is not an estimate of accuracy on a real
photo.** Every image, training and validation alike, is derived from the same 34 crops of the same
one calibration photograph. A high score means the model has learned to be invariant to the
augmentations written in synthesize.py; it says nothing about the ways a real photo will differ that
were not thought of. The `hard` split — every augmentation range widened past what training saw — is
the closest available proxy, and it is still a proxy.

The number that matters comes later, from the photos now accumulating on the server.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

from synthesize import NOT_A_TILE, SIZE, Synthesiser, load_tiles

DATA = Path(__file__).resolve().parent / "data"
RUNS = Path(__file__).resolve().parent / "runs"

# Seed ranges, kept apart so no two splits can draw the same sample.
TRAIN_SEEDS = (0, 10_000_000)
VAL_SEEDS = (10_000_000, 11_000_000)
HARD_SEEDS = (11_000_000, 12_000_000)
# Its own range rather than a slice of VAL_SEEDS: this split picks which checkpoint to keep, so any
# overlap makes the number finally reported partly a number the model was selected on.
WATCH_SEEDS = (12_000_000, 13_000_000)


class TileDataset(Dataset):
    """Synthesises on demand. Sample i always comes out the same, so runs are comparable."""

    def __init__(self, count: int, seed_range: tuple[int, int], hard: bool, size: int):
        self.labels, self.faces, self.masks = load_tiles()
        self.labels = [*self.labels, NOT_A_TILE]
        self.count = count
        self.seed_low, self.seed_high = seed_range
        self.hard = hard
        self.size = size
        # Bumped once per training epoch so the same index yields a different augmentation. Without
        # it the seed depends on the index alone, every epoch re-draws the identical 14k images, and
        # "generated on demand" quietly means a fixed pool the model can start memorising — the very
        # thing the comment on --workers claims this design avoids. Left at zero for the evaluation
        # splits, which have to stay comparable between runs.
        self.epoch = 0

    def __len__(self) -> int:
        return self.count

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        target = index % len(self.labels)  # every class equally often
        span = self.seed_high - self.seed_low
        seed = self.seed_low + (index * 2_654_435_761 + self.epoch * 40_960_001) % span
        synth = Synthesiser(
            self.faces, self.masks, seed=seed, hard=self.hard, size=self.size, labels=self.labels
        )
        image = synth.sample_negative() if target == len(self.faces) else synth.sample(target)
        # BGR uint8 HWC to RGB float CHW, centred on zero.
        rgb = image[:, :, ::-1].astype(np.float32) / 255.0
        return torch.from_numpy(np.ascontiguousarray(rgb.transpose(2, 0, 1)) - 0.5), target


class TileNet(nn.Module):
    """Four downsampling blocks into a pooled classifier. ~300k parameters."""

    def __init__(self, classes: int):
        super().__init__()

        def block(in_channels: int, out_channels: int) -> nn.Sequential:
            return nn.Sequential(
                nn.Conv2d(in_channels, out_channels, 3, padding=1, bias=False),
                nn.BatchNorm2d(out_channels),
                nn.ReLU(inplace=True),
                nn.Conv2d(out_channels, out_channels, 3, padding=1, bias=False),
                nn.BatchNorm2d(out_channels),
                nn.ReLU(inplace=True),
                nn.MaxPool2d(2),
            )

        self.features = nn.Sequential(block(3, 32), block(32, 64), block(64, 96), block(96, 128))
        self.head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(0.2), nn.Linear(128, classes)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.features(x))


def evaluate(model: nn.Module, loader: DataLoader, device: str, classes: int) -> dict:
    """Accuracy overall and per class, the pairs most often mixed up, and confidence per sample."""
    model.eval()
    confusion = torch.zeros(classes, classes, dtype=torch.long)
    scores: list[tuple[float, bool]] = []
    with torch.no_grad():
        for images, targets in loader:
            probabilities = torch.softmax(model(images.to(device)), 1).cpu()
            confidence, predicted = probabilities.max(1)
            for actual, guess, sure in zip(targets, predicted, confidence):
                confusion[actual, guess] += 1
                scores.append((float(sure), bool(actual == guess)))
    correct = confusion.diag().sum().item()
    total = confusion.sum().item()
    per_class = (confusion.diag().float() / confusion.sum(1).clamp(min=1)).tolist()
    mistakes = [
        (confusion[a, b].item(), a, b)
        for a in range(classes)
        for b in range(classes)
        if a != b and confusion[a, b] > 0
    ]
    mistakes.sort(reverse=True)
    return {
        "accuracy": correct / max(total, 1),
        "per_class": per_class,
        "top_confusions": mistakes[:10],
        "scores": scores,
    }


def coverage_table(scores: list[tuple[float, bool]]) -> list[tuple[float, float, float]]:
    """Accuracy against how much is answered, as a confidence threshold is raised.

    This is the number the pipeline is built on rather than raw accuracy. A wrong tile is written
    into the score sheet and quietly changes the result; a tile the model declines to name can be
    handed back to the user, or to Gemini. So what matters is not "how often is it right" but "how
    much can it answer while being right nearly always".
    """
    rows = []
    for threshold in (0.0, 0.5, 0.8, 0.9, 0.95, 0.99, 0.999):
        kept = [correct for sure, correct in scores if sure >= threshold]
        if not kept:
            continue
        rows.append((threshold, len(kept) / len(scores), sum(kept) / len(kept)))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--per-class", type=int, default=400, help="training samples per class")
    parser.add_argument("--batch", type=int, default=128)
    parser.add_argument("--size", type=int, default=SIZE, help="input resolution")
    # Single process on purpose: DataLoader workers need shared memory, which this sandbox refuses
    # ("torch_shm_manager: Operation not permitted"). Synthesis costs 2ms a sample, so an epoch of
    # 13.6k costs under 30s single-threaded, and generating on demand keeps augmentation variety
    # unbounded — a fixed pre-generated pool would be something the model could start memorising.
    parser.add_argument("--workers", type=int, default=0)
    args = parser.parse_args()

    torch.manual_seed(0)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    labels, _, _ = load_tiles()
    labels = [*labels, NOT_A_TILE]
    classes = len(labels)
    print(f"device {device}, {classes} classes: {' '.join(labels)}")

    def loader(count: int, seeds: tuple[int, int], hard: bool, shuffle: bool) -> DataLoader:
        return DataLoader(
            TileDataset(count, seeds, hard, args.size),
            batch_size=args.batch,
            shuffle=shuffle,
            num_workers=args.workers,
            persistent_workers=args.workers > 0,
        )

    train = loader(classes * args.per_class, TRAIN_SEEDS, False, True)
    # Small during training so the per-epoch line is cheap; large for the final report, because 60
    # samples a class puts an error bar of a couple of points on every figure below.
    watch = loader(classes * 60, WATCH_SEEDS, False, False)
    val = loader(classes * 300, VAL_SEEDS, False, False)
    hard = loader(classes * 300, HARD_SEEDS, True, False)

    model = TileNet(classes).to(device)
    parameters = sum(p.numel() for p in model.parameters())
    optimiser = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-4)
    schedule = torch.optim.lr_scheduler.OneCycleLR(
        optimiser, max_lr=3e-3, total_steps=args.epochs * len(train)
    )
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
    print(f"{parameters:,} parameters, {len(train.dataset):,} training samples per epoch\n")

    RUNS.mkdir(exist_ok=True)
    best = 0.0
    for epoch in range(1, args.epochs + 1):
        train.dataset.epoch = epoch
        model.train()
        running, seen, right = 0.0, 0, 0
        for images, targets in train:
            images, targets = images.to(device), targets.to(device)
            optimiser.zero_grad(set_to_none=True)
            output = model(images)
            loss = criterion(output, targets)
            loss.backward()
            optimiser.step()
            schedule.step()
            running += loss.item() * targets.size(0)
            right += (output.argmax(1) == targets).sum().item()
            seen += targets.size(0)
        measured = evaluate(model, watch, device, classes)
        print(
            f"epoch {epoch:2d}  loss {running / seen:.4f}  train {right / seen:.4f}"
            f"  val {measured['accuracy']:.4f}"
        )
        if measured["accuracy"] >= best:
            best = measured["accuracy"]
            torch.save(
                {"state": model.state_dict(), "labels": labels, "size": args.size},
                RUNS / "classifier.pt",
            )

    model.load_state_dict(torch.load(RUNS / "classifier.pt")["state"])
    report(model, labels, val, hard, device, classes, parameters, args.size)


def report(
    model: nn.Module,
    labels: list[str],
    val: DataLoader,
    hard: DataLoader,
    device: str,
    classes: int,
    parameters: int,
    size: int,
) -> None:
    """Prints the results with the per-hand consequence, which is the number that decides this."""
    same = evaluate(model, val, device, classes)
    wider = evaluate(model, hard, device, classes)

    print("\n" + "=" * 66)
    for name, measured in (("same distribution as training", same), ("widened ranges", wider)):
        per_tile = measured["accuracy"]
        # A hand is about 16 tiles and every one has to be right, so this is what a user experiences.
        print(f"\n{name}: {per_tile:.4f} per tile  ->  {per_tile ** 16:.4f} per 16-tile hand")
        worst = sorted(zip(measured["per_class"], labels))[:5]
        print("  weakest classes: " + ", ".join(f"{label} {score:.3f}" for score, label in worst))
        if measured["top_confusions"]:
            print(
                "  most confused:   "
                + ", ".join(
                    f"{labels[a]}->{labels[b]} x{count}"
                    for count, a, b in measured["top_confusions"][:5]
                )
            )
        print("  confidence  threshold  answered   accuracy   16-tile hand")
        for threshold, answered, accuracy in coverage_table(measured["scores"]):
            print(
                f"              {threshold:9.3f}  {answered:8.1%}   {accuracy:8.4f}"
                f"   {accuracy ** 16:8.4f}"
            )

    export(model, labels, parameters, same, wider, size)


def export(
    model: nn.Module, labels: list[str], parameters: int, same: dict, wider: dict, size: int
) -> None:
    """Saves an ONNX copy, which is what a browser or a sidecar would load."""
    model.eval().cpu()
    path = RUNS / "classifier.onnx"
    torch.onnx.export(
        model,
        (torch.zeros(1, 3, size, size),),
        str(path),
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
    )
    # The exporter puts the weights in a sidecar .onnx.data by default. Fold them back in: whatever
    # loads this — a browser, a sidecar process — is simpler with one file to fetch.
    import onnx

    onnx.save_model(onnx.load(str(path)), str(path), save_as_external_data=False)
    (RUNS / "classifier.onnx.data").unlink(missing_ok=True)
    (RUNS / "classifier.json").write_text(
        json.dumps(
            {
                "labels": labels,
                "input": [1, 3, size, size],
                "preprocessing": "RGB, divide by 255, subtract 0.5",
                "parameters": parameters,
                "synthetic_accuracy": same["accuracy"],
                "widened_accuracy": wider["accuracy"],
                "caveat": (
                    "Both figures come from images derived from one calibration photo per class. "
                    "They measure invariance to the augmentations in synthesize.py, not accuracy on "
                    "a real photo."
                ),
            },
            indent=2,
        )
        + "\n"
    )
    print(f"\nwrote {path} ({path.stat().st_size / 1024:.0f} KB) and {RUNS / 'classifier.json'}")


if __name__ == "__main__":
    main()
