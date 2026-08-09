
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

Before adding a rule, class, or helper — check whether one already exists:
- Grep for it. Half the "duplication" in this codebase turns out to be an inline style that
  restates a CSS rule already applying to that element. The fix is to delete the inline, not to
  author a class.
- Then check the blast radius of any *shared* rule you are about to add: list every element the
  selector would hit and confirm they all want it. `.card > .flex-between` looked right for two
  header rows and would have added 16px to four others.
- Follow the convention already in the file over one you would introduce. If the codebase has
  `.col-num` / `.text-right`, add `.text-center`; do not invent a parallel utility scheme.
- And check what the existing convention deliberately omits. Table column classes here carry no
  width on purpose — `table-layout: fixed` shares the remainder — so "move this width into the
  col-\* class" would break the layout it was written to protect.

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

## 7. Mobile First — iPhone and iPad Are the Product

**This app is used on iPhone and iPad. Optimise for those; desktop is incidental.**

- When a tradeoff has to be made, mobile wins: touch target size, one-column layouts, narrow-screen
  legibility, payload size over a phone connection.
- Verify against a narrow viewport before calling something done, not after.
- Desktop-only affordances are not features. They are weight.

**Concretely: no `:hover`, no `cursor: pointer`.** Touch is the input that is always there. An iPad
can have a trackpad attached, so a pointer is possible — but never assume one, and never let anything
depend on having one.

- Do NOT write `:hover` styles, and do NOT write `cursor: pointer` (in CSS or in a `style={{}}`).
- Anything that only appears or only becomes legible on hover is **invisible** to a finger. A control
  revealed by `:hover` is a control that does not exist for most of this app's use.
- Do NOT convert a removed `:hover` into an `:active` just to keep the effect. Press feedback has to
  earn its place: add it only when the tap produces no immediately visible result, and only when a
  spinner or a disabled state is not the better answer.

## 8. Comments in English

**Every comment in the codebase is written in English** — CSS, TypeScript, Java, Python alike.

- Keep a Chinese term when the term *is* the name of the thing: 放铳, 自摸, 和牌, 段位, 番种, and the
  table tiers (大圣之间 …). Explain around it in English; translating the term itself loses precision.
- User-facing UI text stays Chinese. That is product copy, not a comment.
- Commit messages and PR descriptions are not comments; leave those as they are.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
