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
.venv/bin/python try_real_photo.py hand.jpg       # read a hand end to end
.venv/bin/python try_real_photo.py --self-check   # the meld logic
.venv/bin/python grid_fit.py                      # the grid fit, against known tile counts
.venv/bin/python inspect_failures.py --hard        # look at what it gets wrong
```

The classifier is 467k parameters, 64px input, 36 classes — the 34 faces, `back` for a face-down tile, and
`none` for anything that is not one tile face. Exported to `runs/classifier.onnx`, 1.9MB. Trained purely on
synthetic data augmented from the crops; no hand photos needed.

`none` and `back` both earn their place. Without `none` the model is closed-set and reads felt or the
table's plastic housing as some tile above 0.8 confidence. Without `back` a 暗杠 cannot be told from a
明杠, which changes the score.

## What works, on real photos

- **Reading a standing hand.** 13 of 13 correct on the one hand photo tried, fully automatic — no region,
  count or pitch supplied. Same 13 labels at every input size from 640px to 1707px.
- **Rejecting what is not the hand.** The discard pile is thrown out before the classifier is asked
  anything, on the grounds that its tile spacing is 243% of the hand's.
- **Cross-lighting and cross-layout.** Both calibration photos have been re-shot twice. A model trained on
  the previous pair read all 68 faces of the new pair correctly, minimum confidence 0.91 — data it had
  never seen.
- **Tile backs.** All 20 back crops correct, 0.63–0.97.

That hand photo is one photo. 13 of 13 is encouraging, not a validated system.

## What does not

- **副露 and 暗杠 have never been run against a real photo**, because none has been taken. `--self-check`
  covers every decision made once a meld is found, but nothing about whether one would be found.
- **發 (6z)** reads *correctly* but at 0.41–0.63, under the review threshold. Confused both ways with 6s
  and 7s — green ink against green bars. Ruled out as causes: class similarity (the probability goes to
  `none`, not to them), blur (發 is the *most* blur-robust class — still 0.87 at 18px, where 北 is 0.25),
  and crop framing. The measured difference is that its ink washes out to near-neutral grey in the photo
  (L 109, a\* −3, b\* 0) against L 56–81, a\* −12, b\* +12 in training, which no augmentation covers.
- **Spatial logic** — concealed vs melds, winning tile, self-draw — is not written for the local model at
  all. Gemini does it today via the prompt.
- **There is no real accuracy number.** The figures below are synthetic.

## Results

| split | per tile | per 16-tile hand |
| --- | --- | --- |
| same distribution as training | 0.9993 | 0.988 |
| every augmentation range widened | 0.9914 | 0.871 |

**Not estimates of accuracy on a real photo.** Every image, training and evaluation alike, derives from the
same 88 crops of six photographs, so these measure invariance to the augmentations in `synthesize.py` and
nothing about how a real photo will differ. The widened split is the closest proxy available.

Abstaining beats guessing, since a wrong tile silently changes the score while a flagged one costs a
glance. On the widened split a 0.8 floor answers 91.7% of tiles at 0.9997 each.

**But 0.8 has never rejected a real error.** On the one real photo it flagged 3–4 *correct* tiles and caught
none — the photo reads 13 of 13 with no threshold at all. Its benefit is synthetic, its cost is real, and 13
tiles cannot calibrate it. For the standing hand it is only a label; nothing is dropped. The number should
come from the collected samples measured against Gemini's answers, which is the offline evaluation still to
be written.

## Things learned the hard way

Each of these cost real time. The detail is in the code, where it applies.

- **Read the layout off the photo; never assume it.** The honours run 東西南北白發中, not the canonical
  東南西北, and the two sets disagreed before being re-shot. Guessing mislabels four classes silently. Every
  layout is verified by having a model trained *before* the photos changed name all 36 cells and checking
  the answer is a legal permutation of the set. See `slice_calibration.py`.
- **Colour does not survive a change of light; texture does.** The same brown carpet measures chroma 37 in
  one photo and 11 in another, where the *tile* is the more coloured of the two. Tile backs are found by
  brightness plus smoothness instead — glossy plastic against fabric. That rule must not be used on faces:
  engraving is exactly what it measures. See `slice_calibration.py`.
- **"The model is wrong about its own training data" means look at the input pipeline.** `back` failed on
  the very crops it was trained on. Not data volume (16 more photos did not fix it) and not resolution
  (well measured, still wrong) — training pasted tiles with a margin of background while the reader cuts
  inside the cell, so the model had learnt to expect a border. Twelve of 20 backs read `none` tight; all 20
  read `back` at 0.94+ with a margin added. See `synthesize.py`.
- **Validate every candidate before choosing one.** A three-tile 碰 also fits four cells at ¾ of the true
  pitch, and can score higher. Choosing on score and validating afterwards discards the correct reading.
  See `choose_meld` in `try_real_photo.py`.
- **Synthetic scores and real photos move in opposite directions.** Widening the synthetic table-colour
  range covered a genuine gap, improved every synthetic figure, and halved 發's confidence on the real
  photo. Sampling near measured colours instead recovered it.

## Next

1. **Photograph a hand with a 副露 and one with a 暗杠.** The only way to validate that path.
2. **Use the recognition a few times** so `/app/samples` accumulates real photos with Gemini's answers.
   Comparing the two is the only route to a real accuracy number and to a defensible threshold.
3. Then 發.
