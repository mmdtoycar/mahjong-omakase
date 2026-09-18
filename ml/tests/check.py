"""Runs every check in this directory, and is what the Dockerfile calls as its build gate.

A runner rather than pytest, because the server image has no pytest in it and should not: it installs
`requirements-serve.txt` and nothing else, and the gate has to run inside the image it is gating. Each check
is a plain `self_check()` returning the number of failures, so there is nothing to discover and nothing to
configure.

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
