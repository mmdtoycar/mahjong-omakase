# ml — local tile recognition

Experiment to replace the Gemini photo-recognition call with a small local model. Gemini takes 11–24s and
can fail on quota, model overload or the gateway timeout; this reads a whole photo in **~1.8s** locally.

Over the 44 sample photos it hands back **514 of the 597 tiles** correctly and reads **24 of them whole**,
with 34 wrong tiles across the archive, and turns down 1. What counts as correct is what the *photograph*
shows, not what the score sheet recorded: the winning tile is often not in the frame — six of these photos are
like that — and a 暗杠 shows two of its four tiles as backs. Ten photographs carry a known problem, noted
beside the samples and scored like the rest. Grading them apart was tried both ways, as "must be refused" and
as "not a fair test", and measuring settled it: what harms is a wrong tile, not a missing one.

Cut from hand-marked corners at the known tile count the classifier reads **99%** of tiles.

The `none` class is trained on 1760 patches of real table cut from the sample photos wherever no hand was
marked — the felt, the rail, the wall, a sleeve. It had only ever seen composed negatives, and composed
negatives turn out not to look like a table: of 528 real patches, 156 came back as a tile and 57 of those as
`back`, a bare table being as flat as a tile back. Two such cells decided a whole photo, read as `back` at 0.75
and 0.88 inside a row that was otherwise correct. With the real patches in, 451 of the 528 are called nothing,
and the `back` confusion is halved.

That change is also why the gate that refuses a photo for being half in doubt sits at 0.7 rather than 0.8: the
classifier became honest about background cells, saying 0.4 where it used to say 0.88, and the old gate turned
that honesty into two refusals.

The classifier has a second head predicting the tile's quarter turn, since a tile laid on its side is how a
called meld and the winning tile are marked. It is right 93% of the time on synthetic crops and 59 of 60 on
real cells rotated by hand — and it calls all 19 real turned tiles in the sample photos upright, at 0.87 to
0.98, while naming their faces correctly. Three explanations have been tested and ruled out; see turned_cells.
Nothing relies on it. What does find a turned tile is cutting the row with one cell widened at each position in
turn and keeping whichever cut reads best, which puts it in the right place on 13 of the 19.

Not deployed. The server still uses Gemini.

## Setup

```bash
uv venv --python 3.12
uv pip install -r requirements.txt
```

## Layout

`serve.py` is the only thing at the top level and the only entry point the server has. Everything the
reading needs is under `recognition/`, and nothing there reaches back out into the training or the tooling —
those depend on it, not the other way round.

```
serve.py                 the sidecar: HTTP in, tiles out
recognition/             what it calls: tiles.py, grid_fit.py, reader.py
tests/                   the checks, and the Dockerfile's build gate
training/                what produces the model: crops, synthetic data, weights
tools/                   run by hand, to look at things
```

The image ships `serve.py` and `recognition/` and nothing else. It used to ship `synthesize.py` too — 351
lines of synthetic-data generator — because `reader.py` took `SIZE` and `BACK` out of it. Those two are in
`recognition/tiles.py` now, which is the vocabulary both sides share.

## Run

```bash
.venv/bin/python -m training.slice_calibration      # 6 photos -> 88 labelled crops + masks
.venv/bin/python -m training.train_classifier       # ~30 min on an M2 Pro
.venv/bin/python -m recognition.reader hand.jpg     # read a hand end to end
.venv/bin/python -m tests.check                     # every check: grid fit, reader, serve
.venv/bin/python -m tools.inspect_reads ../mahjong-samples --all   # what it did with each sample photo
.venv/bin/python -m tools.inspect_failures --hard   # what the classifier gets wrong
.venv/bin/python -m tools.annotate_samples ../mahjong-samples     # mark where the tiles are
```

The classifier is 467k parameters, 64px input, 36 classes — the 34 faces, `back` for a face-down tile, and
`none` for anything that is not one tile face. Exported to `runs/classifier.onnx`, 1.9MB. Trained purely on
synthetic data augmented from the crops; no hand photos needed.

`none` and `back` both earn their place. Without `none` the model is closed-set and reads felt or the
table's plastic housing as some tile above 0.8 confidence. Without `back` a 暗杠 cannot be told from a
明杠, which changes the score.
