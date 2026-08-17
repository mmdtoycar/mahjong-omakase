# ml — local tile recognition

Experiment to replace the Gemini photo-recognition call with a small local model. Gemini takes 11–24s and
can fail on quota, model overload or the gateway timeout; this reads a whole photo in **~490ms** locally.

Not deployed. The server still uses Gemini.

## Setup

```bash
uv venv --python 3.12
uv pip install -r requirements.txt
```

## Run

```bash
.venv/bin/python slice_calibration.py             # 6 photos -> 88 labelled crops + masks
.venv/bin/python train_classifier.py              # ~30 min on an M2 Pro
.venv/bin/python reader.py hand.jpg                # read a hand end to end
.venv/bin/python reader.py --self-check            # the meld logic
.venv/bin/python grid_fit.py                      # the grid fit, against known tile counts
.venv/bin/python inspect_failures.py --hard        # look at what it gets wrong
```

The classifier is 467k parameters, 64px input, 36 classes — the 34 faces, `back` for a face-down tile, and
`none` for anything that is not one tile face. Exported to `runs/classifier.onnx`, 1.9MB. Trained purely on
synthetic data augmented from the crops; no hand photos needed.

`none` and `back` both earn their place. Without `none` the model is closed-set and reads felt or the
table's plastic housing as some tile above 0.8 confidence. Without `back` a 暗杠 cannot be told from a
明杠, which changes the score.
