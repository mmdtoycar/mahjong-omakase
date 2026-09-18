"""The tile reader the server calls: find the row in a photo, cut it into tiles, name them.

`serve.py` beside this is the only entry point into it, and nothing here reaches back out to the training or
the tooling. That direction used to be broken: reader.py took SIZE and BACK from synthesize.py, so the
server image shipped a 351-line synthetic-data generator to get two constants. They live in `tiles.py` now,
which is the vocabulary both sides share.
"""
