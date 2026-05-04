Audit frontend and backend for localization, mobile responsiveness, UI consistency, dead code, and duplication.

## Part 1: Chinese Localization
Check every file in ui/src/pages/ and ui/src/App.tsx for user-visible English text that should be Chinese:
- Labels, headings, button text, placeholder text, error messages, hints, warnings
- Badge text, empty state messages, table column headers, navigation links

Exceptions (do NOT flag):
- SignUpPage.tsx English tagline, AdminPage.tsx (all English), game session default names
- App.tsx "Mahjong Omakase" (branding), HomePage.tsx footer (intentional)
- Japanese Riichi terms (役満, 三倍満, 倍満, 跳満, 満貫) in SessionPage
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
grep -oP '^\s*\.[a-zA-Z][\w-]*' ui/src/index.css | sed -E 's/^\s*\.//' | sort -u > /tmp/css-classes.txt
while read cls; do
  if ! grep -rq "$cls" ui/src/pages/ ui/src/components/ ui/src/App.tsx 2>/dev/null; then
    echo "UNUSED CSS: .$cls"
  fi
done < /tmp/css-classes.txt
```

### Unused TypeScript exports
```bash
grep -oP 'export (interface|function|const|type) \K\w+' ui/src/types/index.ts | while read name; do
  count=$(grep -rn "$name" ui/src/pages/ ui/src/components/ ui/src/App.tsx ui/src/api/ ui/src/logic/ ui/src/utils/ 2>/dev/null | grep -v "types/index.ts" | wc -l)
  if [ "$count" -eq 0 ]; then echo "UNUSED EXPORT: $name in types/index.ts"; fi
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

### Java unused imports
```bash
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

### Java unused private methods
Read each Java service/controller/handler file and check if every private method is called within the same class.

## Part 5: Code Duplication (Frontend + Backend)

### CSS color duplication
```bash
# Find hardcoded hex colors that should be CSS variables
grep -oP '#[0-9a-fA-F]{3,8}' ui/src/index.css | sort | uniq -c | sort -rn | head -20
```

### CSS duplicate selectors
```bash
grep -oP '^\s*\.[a-zA-Z][\w-]*' ui/src/index.css | sed -E 's/^\s*\.//' | sort | uniq -c | sort -rn | awk '$1>1{print "DUPLICATE SELECTOR:", $2, "("$1" times)"}'
```

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
