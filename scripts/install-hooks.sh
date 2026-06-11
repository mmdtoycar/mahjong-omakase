#!/usr/bin/env bash
# One-time setup: point git at the in-repo hook directory so .githooks/pre-commit fires.
# Run this once after cloning (or after installing a new machine).

set -e

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/*

echo "✓ Git hooks installed (core.hooksPath = .githooks)"
echo "  pre-commit will run: spotless / tsc / javac / pmd"
echo "  bypass once with: git commit --no-verify"
