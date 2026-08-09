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

Writes 88 labelled crops to `data/faces/`, a cut-out mask for each to `data/masks/`, and
`data/faces_contact_sheet.png` to eyeball the cut in one look. It also prints an edge audit, because
every problem found in this routine was spotted by eye first.

That is each of the 34 faces twice, once per set, plus **20 tile backs** — four tiles per file, one file
per back colour per set. The extra back photos were shot to fix a class that was not working; they were
not the fix, but they are worth keeping, and the story is under "How the `back` class was fixed" below.

Getting the boxes clean took several passes — see the script docstring. Worth the effort because a class
has only a handful of source images, so any leftover neighbour or table is a *near-perfect* cue for that
class and the classifier will use it instead of the tile pattern.

**1. Face classifier (36 classes)** — done

```bash
.venv/bin/python synthesize.py          # sample sheets, to check the data by eye
.venv/bin/python train_classifier.py    # ~30 min on an M2 Pro
.venv/bin/python inspect_failures.py --hard
```

467k parameters, 64px input, exported to `runs/classifier.onnx` (1.9MB, single file). Trained purely
on synthetic data augmented from the 88 crops; no hand photos needed.

Two of the classes are not tile faces. `none` is for everything that is not one face: without it the
classifier is closed-set, has to answer with one of the 34, and felt, the plastic housing of the mahjong
table and a misaligned crop all come back as some tile, often above 0.8 confidence. Reading a real photo
failed on exactly that — the housing scored better than the hand — and in production it would have
written invented tiles into the score sheet. `back` is the face-down tile, which is what separates a
暗杠 from a 明杠 and so changes the score; folded into `none` that is unrecoverable.

**2. Reading a real photo** — works, and needed no trained detector

```bash
.venv/bin/python try_real_photo.py data/test_hand.jpg
.venv/bin/python try_real_photo.py --self-check   # the meld logic, which has no real photo yet
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
against real data. That is the gap worth closing next. The individual tile backs a 暗杠 shows now read
correctly on every crop available — see below — but that is not the same as reading one in a hand.

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
| every augmentation range widened | 0.9914 | 0.871 |

**These are not estimates of accuracy on a real photo.** Every image, training and evaluation alike,
derives from the same 88 crops of six calibration photographs. They measure invariance to the
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
| 0.0 | 100% | 0.9914 | 0.871 |
| 0.5 | 98.2% | 0.9969 | 0.951 |
| **0.8** | **91.7%** | **0.9997** | **0.995** |
| 0.9 | 80.4% | 1.0000 | 1.000 |

So a threshold of 0.8 answers eleven tiles in twelve and is essentially never wrong on those.
(Confidence saturates near 0.95 because of the label smoothing, so thresholds above that are not
meaningful.)

### The 0.8 confidence floor has never rejected a real error

Worth being precise about, because it is easy to read the table above as though 0.8 were established.

It is not a rejection threshold today. For the standing hand it is a *label*: every tile is reported
whatever its confidence, and the ones below 0.8 are printed and drawn in red for review. Nothing is
dropped.

Where it did drop things was melds, which required every tile in the run to clear it — and that is how
it came to discard 暗杠. Tile backs read 0.63 to 0.97, so seven of the twenty back crops sat under the
floor and two also tripped the not-a-tile gate at 32%. A 暗杠 photographed with a pale-backed tile would
have vanished from the output with nothing to say it had. Fixed by judging the two roles apart: a face-up
tile carries the meld's identity and must be named outright, a face-down one names nothing and only has
to be likelier a back than nothing at all, which needs no threshold. To keep that from being a way in,
the shape is now required too — exactly two turned over and two agreeing faces, which is what this
project photographs and what the Gemini prompt describes. Previously `[back, back, back, 5p]` would have
been scored as a gang of 5p on the evidence of one face-up tile.

On the number itself: it came from the synthetic abstain table, where 0.8 buys 0.9997 per tile against
0.9914. On the one real photo it has flagged 3 or 4 correct tiles and caught **zero errors** — the photo
reads 13 of 13 with no threshold at all. So its benefit is entirely synthetic and its cost is real. The
asymmetry that motivates *having* a review signal is sound — a wrong tile silently changes the score, a
flagged one costs a glance — but it does not justify this particular value, and thirteen tiles are not
enough to calibrate one. That number should come from the collected samples measured against Gemini's
answers, which is the offline evaluation still to be written.


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

The two backgrounds still need separating from the tiles, and how to do that turned out to be the most
interesting question here — see below.

### Colour does not survive a change of light; texture does

The obvious way to find a tile is that it is pale and the table is strongly coloured. That rule is
wrong, and the tile-back photos show it clearly. The *same* brown carpet measures a chroma of 37 in one
and 11 in another, taken under different lamps; in the second the **tile** is the more coloured of the
two, at 42. So "a tile is the less coloured thing" gets that photo exactly backwards. Lightness alone
does not rescue it either — there the carpet reaches L 147 and the tile starts at 149 — and Otsu merges
them outright, because the carpet is genuinely bright.

What does work is that a tile is *smooth*: glossy plastic against fabric that shows its weave. A back
measures a local standard deviation of 2 to 6, felt and carpet 4 to 19, and that is a property of the
material rather than of the light, so it holds across photos taken hours apart. It separates all four
back photos with room to spare, and it admits the strongly coloured blue back with no special case.

It does **not** generalise to the faces, and that is not a threshold to be tuned: engraving is exactly
what local variation measures. Applied to the calibration grids it kept as little as 4% of a 条 face.
Blank tiles and engraved tiles are different problems and get different rules — the grids stay on
brightness plus colour, with one per-photo relaxation for a dark blue back that sits inside the grid.

The same lesson applied to the synthetic backgrounds, where it found a real bug. The green-felt range was
B 50-105, G 85-150, R 35-85 — a *bright* green — and the three green backgrounds actually photographed
measure (37,46,22), (34,82,74) and (50,56,30). Not one was inside it, so the model had never been shown a
dark green table, which is the commonest thing behind a real hand. The ranges are now measured rather
than guessed.

### Cross-lighting generalisation, measured

The re-shoots make an unusually clean test, because a classifier trained on the previous pair of photos
had never seen any of the new ones — different light, different layout, and in one case a set of tile
backs it had no example of.

Measured twice, and the faces held both times:

- The first replacement was read at **34 of 34 faces correct**, 0.67 to 0.97 confidence.
- The second replaced *both* photos, and the model trained on the first pair named **all 68 faces
  correctly**, at a minimum confidence of 0.91.

Both checks scored the tile backs by ranking the tile classes only, which flatters them: it asks whether
`back` beats the other 34 faces, not whether it beats `none`. That distinction turned out to matter a
great deal — see the section on the `back` class below.

Set 2 also settled a smaller question along the way. One of its 3m photos was placed upside down, and
the model read it at 0.95 anyway — orientation is trained out, since all four quarter turns of a face
are one class. That is also why `test_hand.jpg`, whose every tile lies at 90 degrees, reads correctly.

## Known weak spots

**發 (6z).** It reads 0.41–0.63 on `test_hand.jpg` — correct all three times it appears, but under the
0.8 floor, so all three would be handed back. The synthetic failures point at the same thing from the
other side: `6s->6z` and `7s->6z` are among the most common confusions, so green ink on off-white is
confused *both ways* between the 發 character and a field of bamboo bars. That is one weakness, not two,
and it is now the largest thing left.

**The 萬 suit**, where the difference between faces is a stroke count: `2m->1m` and `3m->2m` on the
widened split. Those come with low confidence, which is why the threshold works.

**The meld path has still never run against real data**, because no hand photo with a 副露 or a 暗杠 has
been taken yet. `back` now works on every crop there is, but "works on the calibration crops" is not the
same claim as "works on a 暗杠 in a photograph". `--self-check` covers the decisions made once a meld is
found — twelve cases over judge_meld, carrying the worst tile-back confidences actually measured — and
says nothing about whether one would be found.

## How the `back` class was fixed, and what it cost to find out

Worth writing down, because two plausible explanations were both wrong and the third was cheap to test.

The symptom: the model called 3 of the 4 tile backs `none` — *on the crops it had been trained on*. Since
`back` is the whole basis for telling a 暗杠 from a 明杠, and that changes the score, this made the meld
path unusable.

**First guess: not enough data.** Four back images across two colours is very little. Photographing 16
more helped and did not fix it — the blue backs started reading correctly, but the cream ones still came
back `none`, 6 of 20 wrong and later 12 of 20. Real progress, wrong diagnosis.

**Second guess: 64px is too coarse.** This one had a good measurement behind it. A cream back's lightness
spread at 64px is 3.3 to 11.8, against 48 to 83 for a face — its faint pattern is nearly gone. And 40% of
the synthetic `none` samples are equally featureless, with 26% falling inside the back's exact range. So
`back` genuinely overlaps `none` in the only dimension left, and no number of photographs recovers
information the input resolution has thrown away. That reasoning is sound, and it was still not the cause.

**The actual cause was crop framing.** Training pasted each tile onto a background with `slack` almost
always positive, so nearly every sample showed a margin around the tile. The reader cuts *inside* each
fitted cell, so a real crop shows none. The test took a minute: present the 20 back crops tight, as the
reader does, and 12 come back `none`; paste a margin of felt around the same crops and **all 20 read as
`back` at 0.94 to 0.97, with `none` at 0.00**. The class was fine and the framing was not. The model had
learnt to expect a border, which for a featureless tile was the only cue it had.

The fix is one line — a face may not be cropped into, because that removes the numeral on a 萬 and turns
1m, 2m and 3m into the same image, but a back has no numeral to lose. Letting `slack` reach -0.12 for that
class alone took the tight-crop result from 12 wrong to **0 wrong, at 0.63 to 0.97**, and nudged the hand
photo up from 8 of 13 above the floor to 10 of 13.

The lesson is not about tile backs. It is that "the model is wrong about its own training data" points at
the input pipeline before it points at the model or the data volume, and that the cheap experiment —
change one thing about the presentation and re-ask — beats two well-argued hypotheses.

The overlap has not vanished, only stopped being one-sided: on the widened split `back->none` and
`none->back` are both still among the top confusions, at 8 and 5 out of 7,200. That is the genuine
ambiguity the resolution argument identified — a featureless pale square is not always decidable — and it
is why the second hypothesis was worth measuring even though it was not the cause.
