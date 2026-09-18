"""Renders what the reader did with each photo it would not read, or read wrong, for someone to look at.

A code and a count say a photo failed; they do not say whether the region was wrong, the cut was wrong,
or the photo never held a readable hand. Those need opposite responses — the first two are this code's
problem and the third is the photographer's — and telling them apart has repeatedly needed a look. Two
whole rounds of work went into the wrong stage of the pipeline for want of one.

Each photo becomes one picture: the frame with every run the reader considered, the one it chose, the
grid it cut on, and where the corners were marked by hand if they were; below that, the cells it read
with what it called them and how sure it was. Green is at or above CONFIDENT, red below.

    python -m tools.inspect_reads ../mahjong-samples              # every photo that failed or read wrong
    python -m tools.inspect_reads ../mahjong-samples --all        # every photo
    python -m tools.inspect_reads ../mahjong-samples --only 314-7 315-9   # just these rounds
"""

import argparse
import collections
import json
from pathlib import Path

import cv2
import numpy as np

from recognition.reader import (
    BACK,
    CONFIDENT,
    HAND_SIZES,
    MELD_SIZES,
    Refusal,
    candidate_runs,
    load_model,
    read_hand,
    read_line,
    shrink,
    standing_sizes,
    whole,
)
from serve import implausible

VIEW = 900  # the long side the reader itself works at, so the quads need no scaling to draw
CELL = 90


def considered(bgr, model, size):
    """Every run, with the grid it would be cut on, arrived at the way the reader arrives at it.

    The two passes mirror `_read_hand_upright` on purpose: the melds settle how long the standing row may
    be, so asking every run for 13 or 14 draws a grid the reader never used and a picture that disagrees
    with the crops underneath it.
    """
    try:
        runs = candidate_runs(bgr)
    except SystemExit:
        return []
    melds = sum(
        read_line(model, run.flat, run.light, whole(run.flat), size, refine=False, counts=MELD_SIZES)
        is not None
        for run in runs
    )
    standing = standing_sizes(HAND_SIZES, melds)
    return [
        (run, read_line(model, run.flat, run.light, whole(run.flat), size, refine=True, counts=standing))
        for run in runs
    ]


def draw(bgr, runs, chosen, marked):
    """The frame with what the reader looked at: blue for a run it passed over, red for the one it took, white for yours."""
    canvas = bgr.copy()
    for run, fit in runs:
        taken = chosen is not None and run.box == chosen
        colour = (0, 0, 220) if taken else (255, 130, 0)
        cv2.polylines(canvas, [np.int32(run.quad)], True, colour, 2)
        depth, width = run.flat.shape[:2]
        note = f"{width}x{depth}" + (f" -> {fit[1]}" if fit is not None else " no fit")
        corner = np.int32(run.quad[0])
        cv2.putText(
            canvas,
            note,
            (corner[0] + 3, corner[1] - 5),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            colour,
            1,
            cv2.LINE_AA,
        )
        if taken and fit is not None:
            _, count, pitch, start, *_ = fit
            # The grid is fitted on the flattened strip, so it is carried back through the same warp to be
            # drawn where it actually cut.
            target = np.float32([[0, 0], [width - 1, 0], [width - 1, depth - 1], [0, depth - 1]])
            back = cv2.getPerspectiveTransform(target, run.quad.astype(np.float32))
            edges = np.float32([[[start + i * pitch, e] for e in (0, depth - 1)] for i in range(count + 1)])
            for a, b in cv2.perspectiveTransform(edges.reshape(-1, 1, 2), back).reshape(-1, 2, 2):
                cv2.line(canvas, np.int32(a), np.int32(b), (0, 200, 255), 1)
    for quad in marked:
        cv2.polylines(canvas, [quad.astype(int)], True, (255, 255, 255), 2)
    return canvas


def strip(crops, tiles, sure):
    """The cells the reader read, captioned with what it called them."""
    if crops is None or not len(crops):
        return np.full((CELL + 26, CELL, 3), 255, np.uint8)
    out = np.full((CELL + 26, len(crops) * (CELL + 4), 3), 255, np.uint8)
    for i, crop in enumerate(crops):
        x = i * (CELL + 4)
        out[0:CELL, x : x + CELL] = cv2.resize(crop, (CELL, CELL))
        colour = (0, 140, 0) if sure[i] >= CONFIDENT else (0, 0, 190)
        cv2.putText(
            out, f"{tiles[i]} {sure[i]:.2f}", (x, CELL + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.4, colour, 1
        )
    return out


def expected(hand: dict, mark: dict | None) -> collections.Counter:
    """The tiles a correct reading hands back, which is not what the score sheet records.

    Two ways it differs, and both were being scored against the reader.

    The winning tile is often not in the photograph. It is recorded because the hand held it, but the player
    was holding it or had not laid it down, so the row has thirteen tiles and reading thirteen is right. Six of
    the sample photos are like that, and all six were counted as a tile missing.

    And a 暗杠 is four of one tile with two turned over. The sheet records all four by the meld's own name
    because that is what the meld *is*; what a photograph shows is two of them and two tile backs.

    So where a photo has been marked by hand the marking is the truth, since it records what the camera saw in
    the order the camera saw it. The record is the fallback for anything not yet marked.
    """
    if mark is None:
        wanted = collections.Counter(hand["concealed"])
        melds = hand["melds"]
    else:
        wanted = collections.Counter(mark["tiles"])
        melds = mark.get("melds", [])
    for meld in melds:
        tiles = meld["tiles"]
        hidden = len(tiles) == 4 and len(set(tiles)) == 1 and not meld.get("isOpen", True)
        wanted += collections.Counter(tiles[:2] + [BACK, BACK] if hidden else tiles)
    return wanted


def caption(text, width):
    band = np.full((26, width, 3), 255, np.uint8)
    cv2.putText(band, text, (6, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1, cv2.LINE_AA)
    return band


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("samples", type=Path)
    parser.add_argument("--all", action="store_true", help="include the photos that read correctly")
    parser.add_argument("--only", nargs="*", help="just these rounds, by directory name")
    parser.add_argument("--into", type=Path, default=Path("/tmp/reads"))
    args = parser.parse_args()

    model, labels, size = load_model()
    args.into.mkdir(parents=True, exist_ok=True)
    for old in args.into.glob("*.png"):
        old.unlink()
    marks = {}
    store = args.samples / "annotations.json"
    if store.exists():
        marks = json.loads(store.read_text())
    # Photographs with a known problem — shot from too far to one side, tiles not laid in a line, the winning
    # tile turned a quarter. A note beside the verdict and nothing more.
    #
    # They were scored differently once: some as "the reader must refuse this" and some as "not a fair test,
    # leave it out". Both were wrong, and measuring settled it. What harms is a *wrong* tile, not a missing one:
    # handing back ten of fourteen with none wrong leaves four to tap in, where a refusal leaves fourteen. Of
    # the ten photographs on that list, two read whole, two more read with nothing wrong at all, and none read
    # anything that could be called a guess. Excluding them was hiding 13 correctly-read tiles and three whole
    # photographs.
    known = {}
    listed = args.samples / "photo-problems.json"
    if listed.exists():
        known = json.loads(listed.read_text())

    written = 0
    score = collections.Counter()
    seen = collections.defaultdict(list)
    for record in sorted(args.samples.glob("*/*.json")):
        if "-deleted-" in str(record):
            continue
        photo = record.with_suffix(".jpg")
        key = f"{record.parent.name}/{photo.name}"
        if not photo.exists() or (args.only and record.parent.name not in args.only):
            continue
        try:
            hand = json.loads(record.read_text())["confirmed"]["hand"]
        except (KeyError, TypeError, json.JSONDecodeError):
            continue
        original = cv2.imread(str(photo))
        if original is None:
            continue
        small = shrink(original, VIEW)
        # Printed before the reading, not after: a photo takes seconds, and a run with no output for
        # minutes looks hung.
        print(f"  {key:44s} ", end="", flush=True)
        reading = read_hand(model, labels, size, small, full=original)
        refusal = (
            reading
            if isinstance(reading, Refusal)
            else implausible(reading.tiles, reading.melds, reading.confidence)
        )
        wanted = expected(hand, marks.get(key))
        score["photos"] += 1
        score["of"] += sum(wanted.values())
        if refusal is not None:
            verdict = f"{refusal.code}: {refusal.why}"
            kind = refusal.code
        else:
            got = collections.Counter(reading.tiles) + collections.Counter(
                tile for meld in reading.melds for tile in meld.tiles
            )
            # Both directions, and the missing half is the one that matters: scoring only the tiles read
            # that should not have been called a photo correct when the reader had found nothing but a
            # meld — three tiles, all of them really in the hand, nothing spurious, nothing else read.
            missing = sum((wanted - got).values())
            spurious = sum((got - wanted).values())
            verdict = (
                "every tile correct"
                if not missing and not spurious
                else f"{missing} missing, {spurious} wrong "
                f"({sum(got.values())} of {sum(wanted.values())} tiles read)"
            )
            kind = "correct" if not missing and not spurious else "misread"
            score["right"] += sum((wanted & got).values())
            score["wrong"] += spurious
            if kind == "correct" and not args.all:
                print(verdict)
                continue

        print(verdict, flush=True)
        runs = considered(small, model, size)
        chosen = reading.box if not isinstance(reading, Refusal) else None
        quads = []
        if key in marks:
            scale = max(original.shape[:2]) / max(small.shape[:2])
            outlines = [marks[key]["corners"]] + [meld["corners"] for meld in marks[key].get("melds", [])]
            quads = [np.array(corners, float) / scale for corners in outlines]
        mark = marks.get(key)
        frame = draw(small, runs, chosen, quads)
        cells = strip(
            None if isinstance(reading, Refusal) else reading.crops,
            None if isinstance(reading, Refusal) else reading.tiles,
            None if isinstance(reading, Refusal) else reading.confidence,
        )
        width = max(frame.shape[1], cells.shape[1])
        # What the reader actually hands back, spelled out. The strip of crops below says what each cell was
        # called; it does not say what came out of the whole thing, whether the melds were read, or which tile
        # it took for the winning one — and those are what a reading is judged on.
        if mark is not None:
            shows = " ".join(mark["tiles"]) + "".join(
                "  [" + " ".join(m["tiles"]) + "]" for m in mark.get("melds", [])
            )
        else:
            shows = " ".join(hand["concealed"]) + "".join(
                "  [" + " ".join(m["tiles"]) + "]" for m in hand["melds"]
            )
        if isinstance(reading, Refusal):
            answered = "nothing"
        else:
            answered = " ".join(reading.tiles) + "".join(
                f"  {m.kind}[{' '.join(m.tiles)}]" for m in reading.melds
            )
            answered += f"   winning {reading.winning or 'unknown'}"
        parts = [
            caption(f"{key}", width),
            caption(f"the photo shows   {shows}", width),
            caption(f"the reader says   {answered}", width),
            caption(f"verdict   {verdict}", width),
            frame,
            cells,
        ]
        stacked = np.vstack(
            [np.pad(p, ((0, 0), (0, width - p.shape[1]), (0, 0)), constant_values=255) for p in parts]
        )
        out = args.into / f"{kind}-{record.parent.name}-{photo.stem[-6:]}.png"
        cv2.imwrite(str(out), stacked)
        written += 1
        note = known.get(key, {}).get("why")
        seen[kind].append(f"{record.parent.name} {verdict}" + (f"   [{note}]" if note else ""))
    print(
        f"\n{score['right']}/{score['of']} tiles handed back correctly over the {score['photos']} photos"
        f" it is meant to read, {score['wrong']} tiles wrong"
    )
    for kind, lines in sorted(seen.items(), key=lambda pair: -len(pair[1])):
        print(f"\n{kind}  ({len(lines)})")
        for line in lines:
            print(f"  {line}")
    print(f"\n{written} pictures in {args.into}")


if __name__ == "__main__":
    main()
