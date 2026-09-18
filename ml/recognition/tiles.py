"""What a tile is, to everything here: the classifier's input size, its two non-face labels, and where the
crops live.

Its own module because both sides need it and neither should depend on the other. These constants started
in training/synthesize.py, which meant the server image shipped the whole synthetic-data generator to get
SIZE and BACK out of it.
"""

from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
FACES, MASKS = DATA / "faces", DATA / "masks"
# Patches of the table itself, cut from the sample photos wherever no hand was marked. The `none` class was
# drawn entirely from synthetic negatives and had never seen a real one: of 528 background patches taken from
# the photos, 156 came back as a tile and 57 of those as `back`, a flat pattern being what a bare table looks
# like too. Two of them decided a whole photo — a cell of brown table read `back` at 0.75 and a cell of wall
# at 0.88, inside a row that was otherwise read correctly.
NEGATIVES = DATA / "negatives"
# The trained weights, in both the shapes anything here loads: the checkpoint training writes and the ONNX the
# sidecar runs. One definition because three files computed it from their own location and two of them moved.
RUNS = Path(__file__).resolve().parents[1] / "runs"

SIZE = 64  # what the classifier sees; a tile face is a simple shape and this is plenty

# A 35th class for everything that is not a tile face. Without it the classifier is closed-set: it
# has to answer with one of the 34, so felt, the table's plastic housing and a misaligned crop all
# come back as some tile, often above 0.8 confidence. That broke reading a real photo — the housing
# scored higher than the hand — and it would quietly write invented tiles into the score sheet.
NOT_A_TILE = "none"

# The face-down tile. Its own label rather than part of NOT_A_TILE, because it is what separates a
# 暗杠 from a 明杠: four tiles with two of them turned over is concealed, does not count as 副露, and
# does not break 门前清 — which changes the score. Folded into "not a tile" that is unrecoverable.
BACK = "back"
