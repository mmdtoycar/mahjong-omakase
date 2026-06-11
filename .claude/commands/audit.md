Audit frontend and backend for localization, mobile responsiveness, UI consistency, dead code, and duplication.

## Part 1: Chinese Localization
Check every file in ui/src/pages/ and ui/src/App.tsx for user-visible English text that should be Chinese:
- Labels, headings, button text, placeholder text, error messages, hints, warnings
- Badge text, empty state messages, table column headers, navigation links

Exceptions (do NOT flag):
- SignUpPage.tsx English tagline, AdminPage.tsx (all English), game session default names
- App.tsx "Mahjong Omakase" (branding), HomePage.tsx footer (intentional)
- Non-visible text (alt, title attributes, comments, console logs, variable names)

## Part 2: Mobile Responsiveness
Read ui/src/index.css and all files in ui/src/pages/ for issues on screens under 640px:
- Tables without `.score-table` scrollable wrapper
- Flex layouts missing flex-wrap on narrow screens
- Inline styles overriding responsive CSS (e.g. width/display overrides)
- Grids not collapsing to single column
- Fixed widths causing horizontal overflow
- Elements not covered by @media (max-width: 640px)

## Part 3: UI Consistency
Check all pages for consistent use of shared patterns:
- **Badges**: Use `.badge` + `.badge-progress`/`.badge-completed` (`.badge-sm` for compact). Flag custom status classes.
- **Empty states**: Use `.empty-state`, no inline padding/color overrides. `.empty-state-compact` for smaller.
- **Subtitles**: Use `.page-subtitle`, not inline color/margin styles.
- **Filter bars**: Use `.filter-bar`, not inline flex/gap/wrap styles.
- **Card wrappers**: All content sections in `.card`. Flag floating content.
- **Colors**: Use CSS variables (--mj-gold, --mj-teal, --sol-yellow, etc.), not hardcoded hex values.
- **Inline styles**: Flag any that duplicate a CSS class or appear 2+ times across files.

## Part 4: Dead Code (Frontend + Backend)

### CSS orphan classes
```bash
# macOS-safe: use [[:space:]] (BSD sed doesn't grok \s) + word-boundary in grep
grep -oE '^[[:space:]]*\.[a-zA-Z][a-zA-Z0-9_-]*' ui/src/index.css \
  | sed -E 's/^[[:space:]]*\.//' | sort -u > /tmp/css-classes.txt
while read cls; do
  if ! grep -rqw "$cls" ui/src/pages/ ui/src/components/ ui/src/App.tsx 2>/dev/null; then
    echo "UNUSED CSS: .$cls"
  fi
done < /tmp/css-classes.txt
```
**Caution — known false positives**:
- Classes built via template literals like `` `rank-tag-${idx + 1}` `` won't show in `grep -w`. Manually verify any flagged class that has a numeric/dynamic suffix sibling (`.rank-tag-1` → check `rank-tag-` template-literal usages).
- A class only ever appearing inside a descendant selector like `.game-card .rank-1 .rank-number` may have no standalone CSS rule but still be valid as an HTML hook. Inspect the JSX before deleting.

### Unused TypeScript locals / parameters / imports
The project's `ui/tsconfig.json` enables `noUnusedLocals: true` and `noUnusedParameters: true`. Run TypeScript with `--noEmit` and grep `TS6133` from the output — anything reported is a real dead identifier (TS sees it declared but never read).

```bash
(cd ui && npx tsc --noEmit) 2>&1 | grep -E "TS6133|TS6196"
```
- `TS6133` — unused locals / parameters / imports
- `TS6196` — unused type aliases

**Triage**:
- Unused **import**: just delete from the import list.
- Unused **local variable** (`const foo = ...` never read): delete the line.
- Unused **function** declaration: delete (it's truly orphaned).
- Unused **parameter** that you can't delete (e.g. callback signature, position-based args, controlled-component prop): rename with `_` prefix → `_foo`. TS treats `_`-prefixed identifiers as intentionally ignored.
- Unused **type alias**: delete the `type Foo = ...` line.

**Caution — what tsc does NOT catch**:
- Unused **exports** (declared `export` and used in same file but never imported elsewhere). For that, use a separate tool like `ts-prune` or `knip`. The grep-based check below is a best-effort fallback when those tools aren't available.

```bash
# Best-effort fallback for unused exports (manual verify each hit — type-only
# imports and template-literal usage can hide references the grep misses):
grep -oP 'export (interface|function|const|type) \K\w+' ui/src/types/index.ts | while read name; do
  count=$(grep -rn "\b$name\b" ui/src/pages/ ui/src/components/ ui/src/App.tsx ui/src/api/ ui/src/logic/ ui/src/utils/ 2>/dev/null | grep -v "types/index.ts" | wc -l)
  if [ "$count" -eq 0 ]; then echo "UNUSED EXPORT (manual verify): $name in types/index.ts"; fi
done
```

### Unused CSS @keyframes
```bash
grep -oP '@keyframes \K[\w-]+' ui/src/index.css | while read kf; do
  if ! grep -q "animation.*$kf" ui/src/index.css; then echo "UNUSED KEYFRAME: @keyframes $kf"; fi
done
```

### CSS brace balance
```bash
awk '{for(i=1;i<=length($0);i++){c=substr($0,i,1);if(c=="{")n++;if(c=="}")n--}}END{print "CSS brace balance:",n,"(should be 0)"}' ui/src/index.css
```

### Java static analysis via PMD
The project ships a curated PMD ruleset at `config/pmd/ruleset.xml` covering
real bugs and dead code. **Run this for the comprehensive backend check** —
it's much more thorough than the grep-based scans below:

```bash
./gradlew pmdMain
```

Output:
- Console list of every violation (file:line, rule, message).
- Full HTML report at `build/reports/pmd/main.html`.
- XML at `build/reports/pmd/main.xml` (CI-friendly).

Rules grouped by category — categories included:
- `bestpractices` — unused locals/parameters/private methods/private fields, etc.
- `errorprone` — likely-real bugs (PreserveStackTrace, EmptyControlStatement, etc.)
- `performance` — UseStringBuilderInStringConcat, AvoidArrayLoops, etc.
- `multithreading` — concurrency patterns
- `design` — coupling, complexity (some thresholds raised; pure noise rules excluded)
- A handful of `codestyle` rules Spotless doesn't already cover (UnnecessaryImport, UselessParentheses, UnnecessaryFullyQualifiedName).

Excluded rules carry inline `<!-- ... -->` reasons in `config/pmd/ruleset.xml`.
PMD is configured with `ignoreFailures = true` and **not auto-attached to `check`**,
so it's opt-in via `./gradlew pmdMain` and won't break the regular build.

When triaging:
- Real findings (UnusedLocalVariable, PreserveStackTrace, LiteralsFirstInComparisons, etc.) → fix in code.
- False positives → either suppress globally in the ruleset (with reason comment) or annotate the call site with `@SuppressWarnings("PMD.RuleName")`.

### Java unused imports / FQN — quick fallback
PMD already covers these via `UnnecessaryImport` and `UnnecessaryFullyQualifiedName`. The grep below is a fallback for when you can't run Gradle:

```bash
# Possibly unused imports (manual verify — naive grep)
find server/src -name "*.java" | while read f; do
  grep "^import " "$f" | sed 's/import //;s/;//;s/static //' | while read imp; do
    cls=$(echo "$imp" | sed 's/.*\.//')
    if [ "$cls" != "*" ]; then
      count=$(grep -c "\b${cls}\b" "$f")
      if [ "$count" -le 1 ]; then echo "POSSIBLY UNUSED IMPORT: $cls in $(basename $f)"; fi
    fi
  done
done
```

### Java fully-qualified names (should be imports)
PMD's `UnnecessaryFullyQualifiedName` already catches this. Quick grep fallback:

```bash
grep -rnE 'java(\.[a-z][a-z0-9_]*)+\.[A-Z][A-Za-z0-9_]*' server/src --include='*.java' \
  | grep -v '^[^:]*:[0-9]*:import ' \
  | grep -v '^[^:]*:[0-9]*: \* '
```

### Java unused private methods
PMD's `UnusedPrivateMethod` (in `bestpractices`) catches this reliably. Manual fallback if Gradle isn't available: read each Java service/controller/handler file and check if every private method is called within the same class.

**Caution — known false positives in the manual fallback**: Naive method-name extraction via `grep`+`sed` regularly drops the trailing `s` in plural names (`saveRoundScores` → `saveRoundScore`). Always verify a flagged method by manually re-grepping its full name before removing.

## Part 5.5: CSS Excess & Reuse

After running orphan/duplicate scans, also check whether the *existing* CSS is bloated or under-used. These checks frequently catch classes that "look used" but aren't actually doing anything.

### Ghost classes (className without a matching CSS rule)
A class that appears as `className="foo"` in JSX but has no corresponding `.foo { ... }` rule in CSS is a ghost — JSX uses it as a label, but the visual styling all sits in inline `style={{ ... }}` next to it. This is the worst pattern: you get class-based selector noise without the consolidation benefit.

```bash
# For every JSX className, confirm a matching top-level CSS rule exists
grep -rohE 'className="[^"]+"' ui/src/pages/ ui/src/components/ ui/src/App.tsx \
  | sed -E 's/className="//;s/"$//' | tr ' ' '\n' | sort -u | while read cls; do
  [ -z "$cls" ] && continue
  if ! grep -qE "^[[:space:]]*\.${cls}\s*[\{,]" ui/src/index.css; then
    echo "GHOST CLASS (no top-level CSS rule): .$cls"
  fi
done
```

**Triage**: ghost classes are sometimes legitimate. Before deleting:
- Check if the class is referenced as a **descendant** in a compound selector (`.parent .foo` styles `.foo` even without a standalone `.foo {`). Run `grep -nE "\.${cls}\b" ui/src/index.css` to verify.
- Check if it's a hook for E2E tests, a future-styling placeholder, or a dynamic-template-literal target (`` `prefix-${id}` ``).
- A truly ghost class will have **no descendant references either** AND its sibling JSX uses inline `style={{ ... }}` for its actual visuals. That's the case worth fixing — either inline the className or move the inline styles into a real CSS rule.

### Conditionally-added classes that have no CSS rule
A pattern like `` className={`base ${flag ? 'modifier' : ''}`} `` adds a modifier class only when `flag` is true — but if `.modifier` has no CSS rule, the entire conditional is dead code.

```bash
grep -rnE "className=\{\`[^\`]+\\\$\{[^}]+\?\s*'[a-z][a-z0-9-]+'" ui/src/pages/ ui/src/components/ \
  | grep -oE "'[a-z][a-z0-9-]+'" | tr -d "'" | sort -u | while read mod; do
  if ! grep -qE "\.${mod}\s*[\{,]" ui/src/index.css; then
    echo "DEAD MODIFIER: '$mod' added conditionally in JSX but no CSS rule"
  fi
done
```

**Caution — known regex limitations**: this pattern only catches:
- Template-literal ternaries (`` `base ${flag ? 'mod' : ''}` ``); plain string ternaries (`flag ? 'mod' : ''`) are missed.
- Single-quoted modifiers; double-quoted (`"mod"`) are missed.
- Modifier names of 2+ chars starting with lowercase letter; single-char or PascalCase modifiers are missed.

For exhaustive coverage, manually grep `className={` regions you're suspicious of, or eyeball the JSX.

### Single-use classes (defined once, referenced once)
Single-use classes are not always wrong — they're justified when:
- The CSS rule has a `:hover`/`:focus`/`:disabled` pseudo-state (impossible inline)
- The class is a hook for a `@media` query
- The rule has 5+ properties that would clutter the JSX

Flag the rest:

```bash
grep -oE '^[[:space:]]*\.[a-zA-Z][a-zA-Z0-9_-]*\s*\{' ui/src/index.css | sed -E 's/^[[:space:]]*\.//;s/\s*\{$//' | sort -u | while read cls; do
  jsx=$(grep -rhEow "${cls}" ui/src/pages/ ui/src/components/ ui/src/App.tsx 2>/dev/null | wc -l | tr -d ' ')
  if [ "$jsx" = "1" ]; then echo "SINGLE-USE: .$cls"; fi
done
```
For each result, read the rule body. If it has no pseudo-state, no media-query reference, and ≤4 properties, suggest inlining it.

### New classes that overlap with existing utilities
Before adding a new class, check whether `.card`, `.flex-between`, `.badge` (+ `-progress`/`-completed`/`-sm`), `.empty-state`, `.empty-state-compact`, `.page-subtitle`, `.filter-bar` already cover it. New classes that re-implement these patterns with slightly different colors/sizes should be:
- Composed (`<div className="card my-modifier">`) rather than fully replicated
- Or upstreamed into the base class as a variant (`.badge-warning-soft`)

```bash
# Quick sanity scan: any new class whose body duplicates ≥3 properties of an existing utility?
# (manual inspection — no clean script — read the new class body, then read .card / .flex-between / .badge)
```

## Part 5: Code Duplication (Frontend + Backend)

### CSS color duplication
```bash
# Find hardcoded hex colors that should be CSS variables
grep -oP '#[0-9a-fA-F]{3,8}' ui/src/index.css | sort | uniq -c | sort -rn | head -20
```

### CSS duplicate selectors
```bash
# Match only top-level selector definitions (not those nested inside @media blocks)
grep -nE '^[[:space:]]*\.[a-zA-Z][\w-]*\s*\{' ui/src/index.css \
  | sed -E 's/^[0-9]+:[[:space:]]*\.//;s/\s*\{.*//' \
  | sort | uniq -c | sort -rn \
  | awk '$1>1 {print "DUPLICATE SELECTOR:",$2,"("$1" times)"}'
```
**Note**: A selector appearing both top-level AND inside an `@media` block is *not* a duplicate — the second one is a responsive override. Only flag when both copies are at top level.

### Frontend inline style duplication
```bash
grep -rn 'style={{' ui/src/pages/ ui/src/components/ | sed 's/.*style={{//' | sed 's/}}.*//' | sort | uniq -c | sort -rn | head -20
```

### Backend duplication
Look for:
- Methods with 5+ identical lines across different functions in same class
- Repeated parameter validation patterns (gameMode parsing, date range parsing)
- Repeated data transformation logic (fan detail parsing, score extraction)
- Repeated entity-to-DTO mapping patterns

```bash
find server/src -name "*.java" -exec grep -l "split.*,.*trim\|valueOf.*gameMode\|findById.*orElse" {} \;
```

### What to flag:
- Any logic block (5+ lines) that appears nearly identically in 2+ places
- Parameter validation duplicated across controller methods
- Entity parsing/mapping duplicated across service methods
- Suggest extracting to a shared private method or utility

## Output
For each issue found, report:
1. File name and line number
2. Current text or code
3. What's wrong
4. Suggested fix

Do NOT make changes — only report findings.
