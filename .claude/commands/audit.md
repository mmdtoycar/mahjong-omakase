Audit frontend and backend for localization, mobile responsiveness, UI consistency, dead code, and duplication.

This skill **prefers tooling over hand-rolled bash**. Each section below either:
- Invokes an existing tool (`tsc`, `pmd`, `cpd`) that already runs in this repo, or
- Lists a recommended open-source tool you can install when you need it, or
- Falls back to a small grep when no good tool exists for that specific check (CSS micro-patterns).

If a section says "tool X covers this", trust X's output and skip the bash.

---

## Part 1: Chinese Localization
Check every file in `ui/src/pages/` and `ui/src/App.tsx` for user-visible English text that should be Chinese:
- Labels, headings, button text, placeholder text, error messages, hints, warnings
- Badge text, empty state messages, table column headers, navigation links

Exceptions (do NOT flag):
- `SignUpPage.tsx` English tagline, `AdminPage.tsx` (all English), game session default names
- `App.tsx` "Mahjong Omakase" (branding), `HomePage.tsx` footer (intentional)
- Non-visible text (`alt`, `title` attributes, comments, `console.log`s, variable names)

> No reliable automated tool exists for this — run as a manual semantic pass.

## Part 2: Mobile Responsiveness
Read `ui/src/index.css` and all files in `ui/src/pages/` for issues on screens under 640px:
- Tables without `.score-table` scrollable wrapper
- Flex layouts missing `flex-wrap` on narrow screens
- Inline styles overriding responsive CSS (e.g. fixed `width`/`display` overrides)
- Grids not collapsing to single column
- Fixed widths causing horizontal overflow
- Elements not covered by `@media (max-width: 640px)`

> Manual check; no automated tool covers this category.

## Part 3: UI Consistency
Check all pages for consistent use of shared patterns:
- **Badges**: Use `.badge` + `.badge-progress`/`.badge-completed` (`.badge-sm` for compact). Flag custom status classes.
- **Empty states**: Use `.empty-state`, no inline padding/color overrides. `.empty-state-compact` for smaller.
- **Subtitles**: Use `.page-subtitle`, not inline color/margin styles.
- **Filter bars**: Use `.filter-bar`, not inline flex/gap/wrap styles.
- **Card wrappers**: All content sections in `.card`. Flag floating content.
- **Colors**: Use CSS variables (`--mj-gold`, `--mj-teal`, `--sol-yellow`, etc.), not hardcoded hex values. Eyeball with the grep in Part 5; `color-no-hex` is not part of `stylelint-config-standard`.
- **Inline styles**: Flag any that duplicate a CSS class or appear 2+ times across files (see Part 5).

---

## Part 4: Dead Code

### TypeScript: `tsc --noEmit`
`ui/tsconfig.json` has `noUnusedLocals: true` and `noUnusedParameters: true`. Run:

```bash
(cd ui && npx tsc --noEmit) 2>&1 | grep -E "TS6133|TS6196"
```

- `TS6133` — unused locals / parameters / imports
- `TS6196` — unused type aliases

Triage:
- Unused **import / local variable / function**: delete.
- Unused **parameter** that you can't delete (callback signature, controlled-component prop): rename with `_` prefix → `_foo`.

### TypeScript unused exports — recommended tool: **knip**
`tsc` does not detect cross-file unused exports. The off-the-shelf tool is [`knip`](https://github.com/webpro-nl/knip) (or older `ts-prune`). Install:

```bash
cd ui && npm install --save-dev knip
npx knip
```

Knip also finds unused files, dependencies, and devDependencies. No config needed for default behavior.

> Apple corporate `npm.apple.com` may not mirror this package; install when on a network with public npm access.

### Java: PMD (already wired)
The project ships a curated PMD ruleset at `config/pmd/ruleset.xml` and PMD is **attached to `check`**, so `./gradlew build` and `./gradlew check` both fail on violations. Manual run:

```bash
./gradlew pmdMain
```

PMD covers (so don't grep for these manually):
- `UnnecessaryImport` — unused Java imports
- `UnnecessaryFullyQualifiedName` — `java.foo.Bar` instead of `import` + `Bar`
- `UnusedLocalVariable` / `UnusedAssignment` / `UnusedFormalParameter`
- `UnusedPrivateField` / `UnusedPrivateMethod`
- `PreserveStackTrace`, `LiteralsFirstInComparisons`, etc.

Reports: console + `build/reports/pmd/main.html`.

### CSS: stylelint (already wired)
The project ships `stylelint` + `stylelint-config-standard` and a config at `ui/.stylelintrc.json`. Run:

```bash
(cd ui && npm run lint:css)
```

Catches: unused `@keyframes`, duplicate properties/selectors, deprecated values, broken syntax, kebab-case naming. `no-descending-specificity` is intentionally disabled (pure ordering preference, not a correctness check).

### CSS micro-patterns — bash fallbacks (no good tool)
These remain hand-rolled because they're project-specific patterns no off-the-shelf tool models well. Treat output as **suggestions, not findings** — manual verify each hit.

#### Orphan CSS classes (defined in CSS but never used in JSX)
```bash
grep -oE '^[[:space:]]*\.[a-zA-Z][a-zA-Z0-9_-]*' ui/src/index.css \
  | sed -E 's/^[[:space:]]*\.//' | sort -u | while read cls; do
  if ! grep -rqw "$cls" ui/src/pages/ ui/src/components/ ui/src/App.tsx 2>/dev/null; then
    echo "POSSIBLY UNUSED: .$cls"
  fi
done
```
**Caution**: classes built via template literals (`` `rank-tag-${idx}` ``) won't show in `grep -w`; classes referenced as descendants (`.parent .foo`) are valid even without standalone `.foo {`. Manual verify.

#### Ghost classes (className in JSX but no matching CSS rule)
```bash
grep -rohE 'className="[^"]+"' ui/src/pages/ ui/src/components/ ui/src/App.tsx \
  | sed -E 's/className="//;s/"$//' | tr ' ' '\n' | sort -u | while read cls; do
  [ -z "$cls" ] && continue
  if ! grep -qE "^[[:space:]]*\.${cls}\s*[\{,]" ui/src/index.css; then
    echo "POSSIBLY GHOST: .$cls"
  fi
done
```
**Caution**: legitimate when the class is referenced as a descendant (`.parent .foo`), an E2E hook, or a template-literal target.

#### Conditionally-added dead modifiers
```bash
grep -rnE "className=\{\`[^\`]+\\\$\{[^}]+\?\s*'[a-z][a-z0-9-]+'" ui/src/pages/ ui/src/components/ \
  | grep -oE "'[a-z][a-z0-9-]+'" | tr -d "'" | sort -u | while read mod; do
  if ! grep -qE "\.${mod}\s*[\{,]" ui/src/index.css; then
    echo "DEAD MODIFIER: '$mod'"
  fi
done
```
**Caution**: only catches template-literal ternaries with single-quoted, ≥2-char, lowercase-leading modifiers. Misses double quotes, single chars, PascalCase, and non-template ternaries.

---

## Part 5: Code Duplication

### Java: PMD CPD
```bash
./gradlew cpdMain
```
- Threshold: `--minimum-tokens 75` (configured in `build.gradle`); lower for stricter audit.
- Output: console; report at `build/reports/cpd/`.
- Task is **opt-in audit**, not a CI gate (`ignoreExitValue = true`). Triage findings manually — interface implementations of the same method shape will appear and are usually unavoidable.

### CSS color / selector duplication — stylelint
`stylelint-config-standard` (already wired) flags `no-duplicate-selectors` and duplicate properties out of the box. Hex-color audits remain a manual eyeball pass since `color-no-hex` isn't part of the standard config:

```bash
# Hex colors used 2+ times (candidates for CSS variables):
grep -oP '#[0-9a-fA-F]{3,8}' ui/src/index.css | sort | uniq -c | sort -rn | head -20
```

---

## Output

For each finding, report:
1. File and line number
2. Current text or code snippet
3. What's wrong
4. Suggested fix (or "see tool X for the same finding")

Do NOT make changes — only report findings.
