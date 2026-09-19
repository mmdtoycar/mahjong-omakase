"""Runs every check in this directory. CI runs this; so does the pre-push habit.

A runner rather than pytest, because nothing here needs discovery or configuration: each check is a plain
`self_check()` returning its number of failures. It needs only `requirements-serve.txt` — no torch — which is
why CI can run all of it in half a minute.

    python -m tests.check          # from ml/
    python -m tests.test_reader    # one of them on its own
"""

import sys

from tests import test_grid_fit, test_reader, test_serve

CHECKS = (
    ("grid fit", test_grid_fit.self_check),
    ("reader", test_reader.self_check),
    ("serve", test_serve.self_check),
)


def main() -> int:
    failures = 0
    for name, check in CHECKS:
        print(f"\n── {name} ──")
        failures += check()
    print(f"\n{'all checks pass' if not failures else f'{failures} failure(s)'}")
    return failures


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
