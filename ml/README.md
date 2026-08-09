# ml — local tile recognition

Experiment to replace the Gemini photo-recognition call with a small local model.

Recognition currently takes 11–24s through the API and can fail on quota, model overload, or the
gateway timeout. The classifier here runs in **0.93ms per tile on CPU** — some 15ms of inference for a
whole hand — with none of those failure modes. Naming the tiles is the cheap half: finding them costs
more, and reading a whole photo end to end measures **~490ms**, three quarters of it in the alignment
refinement.

## Setup

```bash
uv venv --python 3.12
uv pip install -r requirements.txt
```

## Stages

**0. Slice the calibration photos** — done

```bash
.venv/bin/python slice_calibration.py
```

Writes 72 labelled crops — each of the 34 faces once per photo, plus the two tile backs each photo
holds — to `data/faces/`, a cut-out mask for each to `data/masks/`, and `data/faces_contact_sheet.png`
to eyeball the cut in one look. It also prints an edge audit, because every problem found in this
routine was spotted by eye first.

Getting the boxes clean took several passes — see the script docstring. Worth the effort because there
are only two source images per class, so any leftover neighbour or table is a *near-perfect* cue for
that class and the classifier will use it instead of the tile pattern.

**1. Face classifier (36 classes)** — done

```bash
.venv/bin/python synthesize.py          # sample sheets, to check the data by eye
.venv/bin/python train_classifier.py    # ~30 min on an M2 Pro
.venv/bin/python inspect_failures.py --hard
```

467k parameters, 64px input, exported to `runs/classifier.onnx` (1.9MB, single file). Trained purely
on synthetic data augmented from the 72 crops; no hand photos needed.

Two of the classes are not tile faces. `none` is for everything that is not one face: without it the
classifier is closed-set, has to answer with one of the 34, and felt, the plastic housing of the mahjong
table and a misaligned crop all come back as some tile, often above 0.8 confidence. Reading a real photo
failed on exactly that — the housing scored better than the hand — and in production it would have
written invented tiles into the score sheet. `back` is the face-down tile, which is what separates a
暗杠 from a 明杠 and so changes the score; folded into `none` that is unrecoverable.

**2. Reading a real photo** — works, and needed no trained detector

```bash
.venv/bin/python try_real_photo.py data/test_hand.jpg
```

On `data/test_hand.jpg` — a 13-tile standing hand at the edge of a green table, every tile a quarter
turn over, with a discard pile and the table's plastic housing also in frame — it finds the hand, works
out that there are 13 tiles, and **names all 13 correctly**. Fully automatic: no region, count or pitch
supplied. The discard pile is rejected before the classifier is asked anything, on the grounds that its
spacing is 243% of the hand's and so cannot be the same tiles.

The reading is not delicate. Every input size from 640px to 1707px on the long side gave the same 13
labels; only the old fixed `--scale 0.25` default failed, and it failed by miscounting rather than
mislabelling — at 31px a tile, it found 12 tiles at 0.55 mean confidence. That default is now a target
long side instead, for the reasons in the flag's comment.

What it does *not* yet have is a photo containing 副露 or a 暗杠, so the meld path has never been run
against real data. That is the gap worth closing next.

The staged plan assumed this needed a trained detector and a few dozen labelled photos. It does not.
A hand is a line of butted tiles, bright and nearly colourless against strongly coloured felt, so
finding candidate lines is a thresholding problem; and the grid within a line is found geometrically
and then nudged by a pixel or two using the classifier. A misaligned crop is half of one tile and half
of the next, which the classifier is not confident about, so its own confidence is the alignment signal.

**3. Spatial logic** — concealed vs melds, meld grouping, 暗杠, winning tile. Gemini does this today
via the prompt; a local model needs it written out.

## Results

Per tile, and the same figure raised to the 16th power, since a hand is about 16 tiles and every one
has to be right:

| split | per tile | per hand |
| --- | --- | --- |
| same distribution as training | 0.9993 | 0.988 |
| every augmentation range widened | 0.9897 | 0.848 |

**These are not estimates of accuracy on a real photo.** Every image, training and evaluation alike,
derives from the same 72 crops of two calibration photographs. They measure invariance to the
augmentations in `synthesize.py` and say nothing about the ways a real photo will differ that were
not thought of. The widened split is the closest available proxy and is still a proxy. The real
number comes from stage 2's photos.

### Abstaining beats guessing

The deployable figure is not raw accuracy but how much the model can answer while being right nearly
always. A wrong tile is written into the score sheet and quietly changes the result; a tile the model
declines to name can be handed back to the user, or to Gemini.

On the widened split:

| confidence ≥ | answered | per tile | per hand |
| --- | --- | --- | --- |
| 0.0 | 100% | 0.9897 | 0.848 |
| 0.5 | 98.3% | 0.9961 | 0.940 |
| **0.8** | **92.4%** | **0.9988** | **0.981** |
| 0.9 | 81.4% | 0.9999 | 0.998 |

So a threshold of 0.8 answers eleven tiles in twelve and is essentially never wrong on those.
(Confidence saturates near 0.95 because of the label smoothing, so thresholds above that are not
meaningful.)

### The synthetic numbers and the real photo moved in opposite directions

Worth recording, because it is the clearest evidence that the table above is not a deployment criterion.
This was measured on an earlier model and an earlier hand photo, both since replaced; the numbers below
are that experiment's, not the current ones.

Giving each epoch its own augmentation seeds — the training set had been re-drawing the same 14k images
every epoch — lifted the widened split from 0.9858 to 0.9912 per tile, and per hand from 0.796 to 0.869.

On the real photo, the same change left the reading correct at 13 of 13 and **lowered the confidences**:
tiles at or above 0.8 went from 6 of 13 to 4 of 13. More augmentation variety makes the model less sure
of itself, which is better calibration on synthetic data and, there, worse coverage on the only real
data that existed. Nine tiles handed back instead of seven is worse to use.

Neither figure is wrong. They measure different things, and only the second one is about photographs.

### What the failures turned out to be

Two findings from looking at them rather than tuning against the number:

- **Resolution is not the bottleneck.** 96px scored the same as 64px to within noise, so the 萬 suit
  is not being lost to downsampling.
- **Most early failures had unrecoverable labels.** Cropping a few percent into a tile removes the
  numeral on a 萬 face, which sits at the very top edge, and 1m 2m 3m become the same image. That was
  label noise, not hard examples. Tightening the crop and occlusion ranges moved the widened split
  from 0.9799 to 0.9882 per tile, and per hand from 0.723 to 0.828.

What remains is genuinely the 萬 suit — `2m->1m`, `3m->2m` — where the difference is a stroke count.
Those failures come with low confidence, which is why the threshold above works.

## The two tile sets

There are two mahjong tables and a set of tiles for each, with a calibration photo of each set. Both
now lay the whole set out the same way — a 4x9 grid of upright tiles, the three suits in the first three
rows and the seven honours plus two tile backs in the last — so one routine slices both, and every class
has two appearances rather than one.

"Now" is doing work in that sentence. Both photos have been re-shot twice, and the arrangement changed
each time: four rows, then four columns with the tiles a quarter turn over, then four rows again. The
honours order has also differed *between* the two sets in the past. It currently runs 東西南北白發中 in
both, which is **not** the canonical 東南西北 — guessing it mislabels four classes, and nothing would
complain.

So the layout lives in a table in `slice_calibration.py`, and each version of it was read back by having
the classifier name all 36 cells and checking the answer is a legal permutation of the set: each of the
34 faces exactly once, plus the backs. Doing that with a model trained *before* the photos were replaced
is what makes it an independent check rather than a circular one.

The two backgrounds still need one threshold apiece to be separated from the tiles. A face is bright and
nearly colourless (L above 150, chroma below 30) in both, but the blue tile back of set 2 measures L 118
at a chroma of 52 — further from grey than the felt around it — so it has to be admitted on lightness
alone. That relaxation is per photo, not global: the wall behind set 1's tiles reaches L 150, and
applying it there swallows the whole frame.

### Cross-lighting generalisation, measured

The re-shoots make an unusually clean test, because a classifier trained on the previous pair of photos
had never seen any of the new ones — different light, different layout, and in one case a set of tile
backs it had no example of.

Measured twice, and the faces held both times:

- The first replacement was read at **34 of 34 faces correct**, 0.67 to 0.97 confidence.
- The second replaced *both* photos, and the model trained on the first pair named **all 68 faces
  correctly**, at a minimum confidence of 0.91.

The tile backs are a separate story and are covered under the weak spots below. Both checks scored them
by ranking the tile classes only, which flatters them: it asks whether `back` beats the other 34 faces,
not whether it beats `none`, and against `none` it often does not.

Set 2 also settled a smaller question along the way. One of its 3m photos was placed upside down, and
the model read it at 0.95 anyway — orientation is trained out, since all four quarter turns of a face
are one class. That is also why `test_hand.jpg`, whose every tile lies at 90 degrees, reads correctly.

## Known weak spots

**`back` does not work, and this is the one that matters.** The current model, asked about the four back
crops it was itself trained on, calls three of them `none` — at 0.62, 0.65 and 0.84. `back->none` is
also the most common failure on the widened split. Since `back` is the entire basis for telling a 暗杠
from a 明杠, and that changes the score, the meld path cannot be trusted until this is fixed.

The likely cause, stated as a hypothesis rather than a finding: a tile back is a bright, almost
featureless rectangle with a faint pattern, and `sample_negative` deliberately generates bright
featureless patches as `none`. At 64px those two are close to the same image, and `none` has orders of
magnitude more variety behind it than `back`'s four appearances, so it wins. Two ways out — narrow the
negative class away from bright plain fields, or photograph more backs — and the second is likely worth
more, since four images across two colours is very little to generalise from.

**發 (6z), confirmed on real data.** It reads 0.55–0.72 on `test_hand.jpg` — correct all three times it
appears, but under the 0.8 floor, so all three would be handed back. The synthetic failures point at the
same thing from the other side: `7s->6z` and `6s->6z` are among the most common confusions, so green ink
on off-white is being confused *both ways* between the 發 character and a field of bamboo bars. That is
one weakness, not two.

**The 萬 suit**, where the difference between faces is a stroke count: `2m->1m` and `3m->2m` on the
widened split. Those come with low confidence, which is why the threshold works.
