"""Marks where the tiles are in a sample photo, so its confirmed hand becomes labelled crops.

Marking by hand is the whole point. The automatic version of this reached four of the forty-four samples
and only ever the rows the classifier already read correctly — a biased sample of the easy cases, which
cannot teach it the tiles it gets wrong. Here the cut is right whatever the model thinks of it.

Four corners rather than the two ends of the row. A row photographed at an angle does not have one
pitch — measured across five samples the spacing drifts by up to 28% from one end to the other — so
dividing the box evenly puts the later cells between tiles. The quadrilateral is warped to a rectangle
first, which makes the spacing uniform by construction, and the cells are cut from that.

The order has to be confirmed too, by reading the captions rather than by trusting the check. A sample's
hand is a set of labels in canonical order with the winning tile last, and that matched the order in the
photo on four of the eleven samples where it could be checked, so it cannot be assumed. The classifier
proposes an order; because the proposal is drawn from the hand it is always a permutation of it, so
"these are the right tiles" is never the question — whether each one is under the right tile is.

Annotations are saved beside the samples, as the durable artefact — the crops can be cut again whenever
the masks or the insets change, but the corners cannot be recovered. Keep that file.

This is a tool, not the product: it wants a mouse, a keyboard and a window, none of which the app on a
phone may assume.

    python -m tools.annotate_samples ../mahjong-samples          # mark the samples not yet marked
    python -m tools.annotate_samples ../mahjong-samples --write   # cut and write what has been marked

In the window: click the four corners of the row, `u` undoes the last one, `s` skips the photo, `q`
saves and quits. The order is then typed in the terminal.
"""

import argparse
import json
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from recognition.reader import load_model, probabilities, tile_mask
from recognition.tiles import BACK, DATA, NEGATIVES, SIZE
from training.slice_calibration import NEIGHBOUR_EDGE, contact_sheet, write_variant

ANNOTATIONS = "annotations.json"
WINDOW = "mark the four corners of the row"
# Big enough to place a corner on the right tile, small enough for a phone photo to fit a laptop screen.
VIEW = 1100
# The share of a background patch that may look like a tile before the patch is thrown out — see holds_tiles.
TILE_TRACE = 0.002


def assign(
    model: ort.InferenceSession, crops: np.ndarray, columns: list[int]
) -> tuple[list[int], float, np.ndarray]:
    """Which label of the hand each crop is, how much of it the classifier had already named itself,
    and the chance it gave the label it ended up with.

    Greedy rather than optimal: the most probable (crop, label) pair is taken, both are struck out, and
    it repeats. On a row where the model is mostly right the two agree, and where it is not, no
    assignment recovers the truth anyway.
    """
    chances = probabilities(model, crops)
    scores = np.log(chances + 1e-9)
    remaining = scores[:, columns].copy()
    labels = [0] * len(crops)
    for _ in columns:
        crop, slot = np.unravel_index(np.argmax(remaining), remaining.shape)
        labels[int(crop)] = columns[int(slot)]
        remaining[int(crop), :] = -np.inf
        remaining[:, int(slot)] = -np.inf
    named = scores.argmax(axis=1)
    agreement = float(np.mean([a == b for a, b in zip(named, labels)]))
    return labels, agreement, chances[np.arange(len(crops)), labels]


def order_corners(points: list[tuple[float, float]]) -> np.ndarray:
    """The four clicks as top-left, top-right, bottom-right, bottom-left, whatever order they came in."""
    corners = np.array(points, dtype=np.float32)
    centre = corners.mean(axis=0)
    clockwise = corners[np.argsort(np.arctan2(*(corners - centre).T[::-1]))]
    start = int(np.argmin(clockwise.sum(axis=1)))  # the corner nearest the origin is the top-left
    return np.roll(clockwise, -start, axis=0)


def rectify(bgr: np.ndarray, corners: np.ndarray) -> np.ndarray:
    """The marked quadrilateral as an upright rectangle, long side across."""
    top, right, bottom, left = (
        np.linalg.norm(corners[1] - corners[0]),
        np.linalg.norm(corners[2] - corners[1]),
        np.linalg.norm(corners[2] - corners[3]),
        np.linalg.norm(corners[3] - corners[0]),
    )
    width, height = round(max(top, bottom)), round(max(left, right))
    target = np.float32([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]])
    flat = cv2.warpPerspective(bgr, cv2.getPerspectiveTransform(corners, target), (width, height))
    # A hand stood up in a column rather than laid out in a row: turn it so the tiles always run across
    # and everything below can divide the width.
    return flat if width >= height else cv2.rotate(flat, cv2.ROTATE_90_CLOCKWISE)


def cells_of(flat: np.ndarray, count: int) -> list[np.ndarray]:
    """The rectified row divided into its tiles, evenly, whatever any of them is turned.

    A tile laid on its side to mark a call takes up more of the row than an upright one, and dividing
    unevenly to account for it was tried and made things worse: over the 27 marked rows that hold one, the
    classifier read 117 of 148 tiles against 138 cut evenly. The width it was given came from the row's own
    depth, and that turns out not to be the tile's height — how deep a standing row looks depends on how
    far down the camera is looking, so near the middle of the frame the sideways cell came out half again
    too wide and pushed every cell after it along. Even division is 25% out on that one cell and nothing
    on the rest, which over three or four tiles stays inside half a cell.

    Which tile was turned is still worth recording, and the annotations keep it: it is the one thing that
    tells a meld from a short standing row, since a hand with four melds can have a single tile standing.
    """
    pitch = flat.shape[1] / count
    out = []
    for i in range(count):
        a, b = int(i * pitch) + NEIGHBOUR_EDGE, int((i + 1) * pitch) - NEIGHBOUR_EDGE
        out.append(flat[NEIGHBOUR_EDGE : flat.shape[0] - NEIGHBOUR_EDGE, a:b] if b > a else flat[:, :0])
    return out


def strip(cells: list[np.ndarray], names: list[str] | None = None, tall: int = 150) -> np.ndarray:
    """The cells side by side at one height, captioned, to check the cut in a single look."""
    scaled = []
    for cell in cells:
        if cell.size == 0:
            scaled.append(np.zeros((tall, tall // 2, 3), np.uint8))
            continue
        wide = max(int(cell.shape[1] * tall / cell.shape[0]), 4)
        scaled.append(cv2.resize(cell, (wide, tall)))
    sheet = np.full((tall + 24, sum(c.shape[1] + 4 for c in scaled), 3), 255, np.uint8)
    x = 0
    for i, cell in enumerate(scaled):
        sheet[0:tall, x : x + cell.shape[1]] = cell
        if names:
            cv2.putText(sheet, names[i], (x, tall + 17), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
        x += cell.shape[1] + 4
    return sheet


def mark(bgr: np.ndarray, title: str) -> np.ndarray | str:
    """Four corners clicked on the photo, in its own pixels. Or why none came back."""
    scale = min(1.0, VIEW / max(bgr.shape[:2]))
    view = (
        cv2.resize(bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else bgr.copy()
    )
    points: list[tuple[float, float]] = []

    def on_mouse(event, x, y, _flags, _param):
        if event == cv2.EVENT_LBUTTONDOWN and len(points) < 4:
            points.append((x, y))

    cv2.namedWindow(WINDOW, cv2.WINDOW_AUTOSIZE)
    cv2.setMouseCallback(WINDOW, on_mouse)
    while True:
        canvas = view.copy()
        for i, (x, y) in enumerate(points):
            cv2.circle(canvas, (int(x), int(y)), 6, (0, 0, 255), -1)
            cv2.putText(
                canvas, str(i + 1), (int(x) + 8, int(y) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2
            )
        if len(points) == 4:
            cv2.polylines(canvas, [order_corners(points).astype(int)], True, (0, 0, 255), 2)
        cv2.putText(canvas, title, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        cv2.imshow(WINDOW, canvas)
        key = cv2.waitKey(20) & 0xFF
        if key == ord("u") and points:
            points.pop()
        elif key == ord("s"):
            return "skipped"
        elif key == ord("q"):
            return "quit"
        elif key in (13, 32) and len(points) == 4:
            return order_corners(points) / scale


def confirm(
    model, labels: list[str], index: dict[str, int], cells: list[np.ndarray], hand: list[str]
) -> list[str] | str:
    """The tiles in the order they appear, proposed by the classifier and confirmed against the strip.

    Accepting takes `y` rather than a bare return, and deliberately: the proposal is drawn from the
    confirmed hand, so it is always a rearrangement of it and "are these the right tiles" is never the
    question — on the first row tried it still put 3s under a 萬 and 6m under a row of bamboo. Nothing
    here can catch that; the captions have to be read.

    Typing a different number of tiles is how you say the photo holds a different number than the hand
    recorded, which happens — a forgotten winning tile leaves the hand one short of what was
    photographed. The count is then the typed one and the row is cut again, because the earlier rule that
    the tiles had to match the hand made those photos impossible to annotate at all: no input could
    satisfy it, so the only way out was to skip.

    Once the counts disagree the proposal comes from the classifier alone, with the hand no longer able to
    constrain it. Showing nothing at all was the first attempt and it left the strip captionless, which is
    the one thing this screen is for — there was no way to tell what the cut had done, so it was another
    dead end rather than a way through.
    """
    sized = np.stack([cv2.resize(c, (SIZE, SIZE), interpolation=cv2.INTER_AREA) for c in cells if c.size])
    if len(sized) != len(cells):
        return "some cells came out empty — the corners are probably out"
    if len(cells) == len(hand):
        proposed = [labels[c] for c in assign(model, sized, [index[t] for t in hand])[0]]
        constrained = True
    else:
        proposed = [labels[int(c)] for c in probabilities(model, sized)[:, :-1].argmax(axis=1)]
        constrained = False
    while True:
        cv2.imshow(WINDOW, strip(cells, proposed))
        cv2.waitKey(1)
        print(f"    the hand recorded: {' '.join(sorted(hand))}")
        print(f"    proposed:          {' '.join(proposed)}")
        if not constrained:
            print(f"    {len(cells)} cells cut against the hand's {len(hand)} tiles, so that is the")
            print("    classifier on its own — the hand cannot narrow it down")
        typed = input(
            "    check every caption: 'y' if all correct, else type the tiles left to right ('s' skips): "
        )
        typed = typed.strip()
        if typed == "s":
            return "skipped"
        if not typed:
            print("    'y' to accept, or type the order — a bare return is not an answer here")
            continue
        tiles = proposed if typed == "y" else typed.replace(",", " ").split()
        unknown = [tile for tile in tiles if tile not in index]
        if unknown:
            print(
                f"    not labels the model knows: {' '.join(unknown)} — they look like 3m, 7p, 2s, 5z, back"
            )
            continue
        if len(tiles) != len(cells):
            return tiles  # a different count: the caller cuts again and asks once more
        if not constrained:
            # No multiset check while the counts differ. It would list the whole hand as missing, which
            # says nothing: a photo holding a tile the hand never recorded cannot agree with it by
            # construction, so the confirmation is all there is to ask for.
            if (
                input(
                    f"    saving {len(tiles)} tiles against the hand's {len(hand)} — 'y' to confirm: "
                ).strip()
                != "y"
            ):
                continue
            return tiles
        if sorted(tiles) != sorted(hand):
            extra = sorted((Counter(tiles) - Counter(hand)).elements())
            missing = sorted((Counter(hand) - Counter(tiles)).elements())
            print(
                f"    that is not the recorded hand — extra: {' '.join(extra) or 'none'}; "
                f"missing: {' '.join(missing) or 'none'}"
            )
            if input("    'y' if the photo really shows that, anything else to retype: ").strip() != "y":
                continue
        return tiles


def mark_row(model, labels: list[str], index: dict[str, int], bgr: np.ndarray, wanted: list[str], title: str):
    """One row of tiles: its four corners, where any sideways tile sits, and its tiles in order.

    Used for the standing row as well as for each meld. A tile laid on its side is the one thing that
    makes the cut unequal — turned a quarter it takes up the row's own depth along the row instead of a
    tile's width, so the other cells follow from the length once its position is known. Melds are marked
    that way by convention, and the winning tile sometimes is too, at the end of the standing row.

    The position is asked for after the row is shown cut into numbered cells, not before. Asking first
    meant answering against the photo, and rectify turns a row that stands up the frame a quarter to lay
    it flat — so on a vertical row the photo's leftmost tile is not cell one, and the answer would have
    cut the row in the wrong place while looking as if it had been given correctly.
    """
    corners = mark(bgr, f"{title}, {len(wanted)} tiles  u undo  s skip  q quit")
    if isinstance(corners, str):
        return corners
    flat = rectify(bgr, corners)
    count = len(wanted)
    for _ in range(6):
        cv2.imshow(WINDOW, strip(cells_of(flat, count), [str(i + 1) for i in range(count)]))
        cv2.waitKey(1)
        print(f"    the tiles recorded: {' '.join(wanted)}")
        answer = input(
            f"    which cell is laid on its side? 1-{count}, 0 for none, s skips"
            " (recorded only — the cut is even either way): "
        ).strip()
        if answer == "s":
            return "skipped"
        if not (answer.isdigit() and 0 <= int(answer) <= count):
            print(f"    a position from 1 to {count}, or 0")
            continue
        sideways = int(answer)
        tiles = confirm(model, labels, index, cells_of(flat, count), wanted)
        if isinstance(tiles, str):
            return tiles
        if len(tiles) == count:
            return {"corners": corners.tolist(), "tiles": tiles, "sideways": sideways}
        count = len(tiles)
        print(f"    cutting {count} cells instead")
    return "the count kept changing"


def load(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {}


def holds_tiles(patch: np.ndarray) -> bool:
    """Whether a patch away from the marked hand has tiles in it anyway — the wall, or the discards.

    Three shares give them away and none belongs to a bare table: bright pixels, since a face or a tile's edge
    is much lighter than felt or wood; low-chroma bright pixels, which is what `tile_mask` looks for; and woven
    blue, which nothing else in these frames is, the felt being green and the housing brown.

    The threshold is deliberately far below what a tile would show. Throwing away a good patch of felt costs
    nothing — there is more felt in every frame — while keeping one patch of the wall teaches the `none` class
    that a tile back is background, which is the confusion this whole exercise is meant to remove. At this
    setting the model that had never seen these patches finds nothing tile-like left in what survives.
    """
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    hue, saturation, value = hsv[..., 0].astype(int), hsv[..., 1], hsv[..., 2]
    blue = (hue >= 90) & (hue <= 130) & (saturation > 40) & (value > 40)
    return bool(
        blue.mean() > TILE_TRACE
        or (value > 150).mean() > TILE_TRACE
        or (tile_mask(patch) > 0).mean() > TILE_TRACE
    )


def negatives_sheet(files: list[Path], thumb: int = 48, per_row: int = 40) -> None:
    """Every harvested patch on one page, so the whole set can be checked by eye rather than sampled."""
    rows = []
    for start in range(0, len(files), per_row):
        row = [cv2.resize(cv2.imread(str(f)), (thumb, thumb)) for f in files[start : start + per_row]]
        row += [np.full((thumb, thumb, 3), 255, np.uint8)] * (per_row - len(row))
        rows.append(np.hstack(row))
    out = DATA / "negatives_contact_sheet.png"
    cv2.imwrite(str(out), np.vstack(rows))
    print(f"contact sheet: {out}")


def harvest_negatives(samples: Path, saved: dict, per_photo: int = 40) -> None:
    """Patches of whatever is not the hand, from every marked photo, for the `none` class to learn from.

    Marking a row is the assertion that it holds tiles; everywhere else in the frame is the assertion that it
    does not. That makes the annotations a source of real negatives as well as real tiles — the table, the
    felt, the wall, the discards, a sleeve — and the `none` class had never seen one of those.

    Taken a margin away from every marked quad, so a patch that clips the edge of a tile cannot be labelled as
    holding none. Sizes are drawn over the range a cell comes out at, because a negative the model will never
    be shown at that scale teaches it nothing.

    And not everything outside the hand is background: the wall stands in most of these frames, and a patch of
    it is a row of tile backs — taught as `none` that is the opposite of the `back` class, which is the one the
    reader most often gets wrong on a bare table. Of the first 1760 patches taken with no filter at all, 236
    were called `back` by a model that had not seen them. `holds_tiles` is what removes them; bounding to the
    table surface as well only took that 236 to 220, because the wall is built on the table.

    Nor is the frame bounded to the table. What is behind it — a sleeve, the floor, a curtain, a chair leg —
    is not a tile either, and a candidate region that strays off the table is one the reader has to be able to
    score badly. Judged by a model that had seen none of them, the 1592 patches taken this way hold no tiles:
    the 195 it calls a tile are all cloth, skin, floor tile and metal, which is the confusion itself.
    """
    rng = np.random.default_rng(0)
    NEGATIVES.mkdir(parents=True, exist_ok=True)
    for old in NEGATIVES.glob("*.png"):
        old.unlink()
    written = 0
    for key, note in sorted(saved.items()):
        bgr = cv2.imread(str(samples / key))
        if bgr is None:
            continue
        busy = np.zeros(bgr.shape[:2], np.uint8)
        for corners in [note["corners"]] + [m["corners"] for m in note.get("melds", [])]:
            cv2.fillPoly(busy, [np.int32(order_corners([tuple(c) for c in corners]))], 1)
        margin = max(bgr.shape[0] // 40, 8)
        busy = cv2.dilate(busy, np.ones((margin, margin), np.uint8))
        taken = 0
        for _ in range(per_photo * 20):
            if taken >= per_photo:
                break
            side = int(rng.integers(bgr.shape[0] // 14, bgr.shape[0] // 5))
            y = int(rng.integers(0, max(bgr.shape[0] - side, 1)))
            x = int(rng.integers(0, max(bgr.shape[1] - side, 1)))
            if busy[y : y + side, x : x + side].any():
                continue
            patch = bgr[y : y + side, x : x + side]
            if holds_tiles(patch):
                continue
            patch = cv2.resize(patch, (SIZE, SIZE), interpolation=cv2.INTER_AREA)
            cv2.imwrite(
                str(NEGATIVES / f"{key.replace('/', '-').rsplit('.', 1)[0][-14:]}-{taken}.png"), patch
            )
            taken += 1
            written += 1
    print(f"wrote {written} patches of background to {NEGATIVES}")
    negatives_sheet(sorted(NEGATIVES.glob("*.png")))


def looks_face_down(model, labels: list[str], cell: np.ndarray) -> bool:
    """Whether this crop is a tile back rather than the face its label claims.

    The model deciding what goes into its own training set is circular, and acceptable in one direction only:
    this can throw a crop away, never relabel or keep one, and a woven tile back against a printed face is
    not a fine distinction. Every crop it drops is named on the way out so it can be checked by eye.
    """
    batch = np.stack([cv2.resize(cell, (SIZE, SIZE), interpolation=cv2.INTER_AREA)])
    chances = probabilities(model, batch)[0]
    return labels[int(chances.argmax())] == BACK and float(chances.max()) > 0.5


def harvest(samples: Path, saved: dict, model, labels: list[str]) -> None:
    """Cuts and writes every marked photo. Re-runnable: the annotations are what is durable."""
    cells_seen, seen, dropped = [], {}, []
    for key, note in sorted(saved.items()):
        photo = samples / key
        bgr = cv2.imread(str(photo))
        if bgr is None:
            print(f"  skip {key}: cannot read it")
            continue
        # The standing row and then each meld, which is the same cut with one cell the row's own depth
        # wide where a tile was laid on its side. Melds are where the crops are scarcest — a 暗杠's two
        # face-down tiles are the only place `back` appears in a hand at all.
        rows = [(note["corners"], note["tiles"])]
        rows += [(m["corners"], m["tiles"]) for m in note.get("melds", [])]
        for corners, wanted in rows:
            flat = rectify(bgr, np.array(corners, dtype=np.float32))
            for cell, label in zip(cells_of(flat, len(wanted)), wanted):
                if cell.size == 0 or min(cell.shape[:2]) < 8:
                    continue
                # A cell that is plainly a tile back, under a label that is a tile face. The marking cannot
                # say which: a 暗杠 is recorded as four of one tile because that is what the meld *is*, and
                # two of those four are turned over. Written out under the face's label they poison it — of
                # the nine real 2z crops two were tile backs, and 2z is one of the labels the reader gets
                # wrong. The same check catches a cell that came out as a tile's edge rather than its face.
                if label != BACK and looks_face_down(model, labels, cell):
                    dropped.append((key.split("/")[0], label))
                    continue
                # The whole cell is tile, and the mask says so. Marking the row is the assertion that the
                # quadrilateral holds nothing else, and the tiles inside it are butted, so there is no
                # table to cut away — which is all trim() is for in slice_calibration, where the grid is
                # divided evenly over a block that sits a degree off square and the rim cells overshoot it.
                #
                # Not face_mask here, and that was measured: on 41 of 436 cells it found no solid line at
                # all and they were dropped, every one of them a good crop. It excludes the red of a 筒 as
                # too coloured to be tile, and fills an engraved character back in only when the face
                # encloses it — on a crop cut this tight the ink reaches the edge, so the stroke stays a
                # hole. Used as the alpha channel it would show the background through the character that
                # is the label.
                piece = np.ones(cell.shape[:2], bool)
                seen[label] = seen.get(label, 0) + 1
                source = f"marked-{key.replace('/', '-').rsplit('.', 1)[0][-14:]}-{seen[label]}"
                write_variant(label, source, cell, piece)
                cells_seen.append((label, cell, piece))
    harvest_negatives(samples, saved)
    if dropped:
        print(
            f"\ndropped {len(dropped)} cells that are tile backs under a face's label: "
            + ", ".join(f"{photo} {label}" for photo, label in dropped)
        )
    print(f"\nwrote {len(cells_seen)} crops over {len({label for label, _, _ in cells_seen})} labels")
    if cells_seen:
        # No audit() here. It reports how much of a crop's edge the mask calls background, and the mask
        # is the marking, so it would report none of it whatever the corners were. The contact sheet,
        # sorted by label, is the check that still means something.
        cells_seen.sort(key=lambda cell: cell[0])
        contact_sheet(cells_seen)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("samples", type=Path, help="the archive of sample photos and confirmed hands")
    parser.add_argument("--write", action="store_true", help="cut and write the marked photos, mark nothing")
    parser.add_argument(
        "--remark", action="store_true", help="mark the photos that already have an annotation too"
    )
    args = parser.parse_args()

    store = args.samples / ANNOTATIONS
    saved = load(store)
    model, labels, _ = load_model()
    if args.write:
        harvest(args.samples, saved, model, labels)
        return

    index = {label: i for i, label in enumerate(labels)}
    todo = []
    for record in sorted(args.samples.glob("*/*.json")):
        if "-deleted-" in str(record):
            continue
        photo = record.with_suffix(".jpg")
        key = f"{record.parent.name}/{photo.name}"
        if not photo.exists():
            continue
        confirmed = json.loads(record.read_text()).get("confirmed")
        if not confirmed:
            continue
        hand = confirmed["hand"]["concealed"]
        melds = [m["tiles"] for m in confirmed["hand"]["melds"]]
        if not all(tile in index for tile in hand + [t for m in melds for t in m]):
            continue
        # A photo already marked still has work if its melds were never marked. The first 44 were done
        # before this asked about them, and a meld is where the reader is furthest from reading anything.
        done = saved.get(key)
        if done is None or args.remark or (melds and "melds" not in done):
            todo.append((key, photo, hand, melds, done))

    print(f"{len(todo)} photos to mark, {len(saved)} already marked")
    for number, (key, photo, hand, melds, done) in enumerate(todo, 1):
        bgr = cv2.imread(str(photo))
        if bgr is None:
            continue
        shape = f"{len(hand)} standing" + (
            f" and melds of {', '.join(str(len(m)) for m in melds)}" if melds else ""
        )
        print(f"\n[{number}/{len(todo)}] {key} — {shape}")
        rows, quit_now = [], False
        for what, wanted in [("standing row", hand)] + [(f"meld {i}", m) for i, m in enumerate(melds, 1)]:
            if what == "standing row" and done is not None and not args.remark:
                print("    the standing row is already marked; melds only")
                rows.append(done)
                continue
            outcome = mark_row(model, labels, index, bgr, wanted, f"{key}  {what}")
            if outcome == "quit":
                quit_now = True
                break
            if isinstance(outcome, str):
                print(f"    {what}: {outcome}")
                rows.append(None)
                continue
            rows.append(outcome)
        if not quit_now and rows and rows[0] is not None:
            entry = dict(rows[0])
            if melds:
                entry["melds"] = [row for row in rows[1:] if row is not None]
            saved[key] = entry
            store.write_text(json.dumps(saved, indent=2, sort_keys=True) + "\n")
            print(f"    saved, {len(saved)} marked in total")
        if quit_now:
            break
    cv2.destroyAllWindows()
    print(f"\n{len(saved)} annotations in {store}")
    print(f"cut them with: python {Path(__file__).name} {args.samples} --write")


if __name__ == "__main__":
    main()
