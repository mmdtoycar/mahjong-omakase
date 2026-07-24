
# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Never Push Unless Asked

**Do NOT `git push` unless the user explicitly says to push (or runs /publish).**

- Making edits, running checks, and committing locally are fine, but stop before pushing.
- Reason: CodeRabbit only reviews a PR about once per hour. Pushing new commits too quickly means it won't review the later parts — batch changes and let the user decide when to push.
- When work is ready, say so and wait for the push signal.

## 6. Do Exactly What's Asked — Reuse, Don't Rewrite

**No overdesign. Build the specific thing requested, reusing what exists.**

- This is §2 (Simplicity First) applied concretely — it was already stated; honor it.
- Reuse/extend existing components, DOM, and styles instead of writing a parallel version. "Make X bigger/fullscreen" → scale or reuse X's existing markup; do NOT re-implement X's layout or author a second set of styles.
- If you catch yourself writing a second version of something that already exists, stop — that's the overdesign smell. Reuse instead.
- Do the requested change and nothing more. No speculative variants, no adjacent "improvements."

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
