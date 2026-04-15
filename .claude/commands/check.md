Audit all frontend pages for Chinese localization and mobile responsiveness.

## Part 1: Chinese Check
Check every file in frontend/src/pages/ and frontend/src/App.tsx for any user-visible English text that should be Chinese. This includes:
- Labels, headings, button text
- Placeholder text in inputs
- Error messages, hints, warnings
- Badge text (In Progress, Completed, etc.)
- Empty state messages
- Table column headers
- Navigation links

Note: SignUpPage.tsx ("Join Leo's friends' mahjong games!") is intentionally English — do not flag it.

## Part 2: Mobile Check
Read frontend/src/index.css and all files in frontend/src/pages/ to check for potential mobile issues on screens under 640px width. Check for:
- Tables not wrapped in a scrollable container (overflow-x: auto)
- Flex layouts that don't wrap on narrow screens
- Inline styles that override responsive CSS (e.g. width: 'auto' preventing full-width)
- Buttons that should be full-width on mobile but aren't
- Form inputs or selects that might overflow
- Grid layouts that don't collapse to single column
- Fixed widths that cause horizontal overflow
- Elements not covered by the existing @media (max-width: 640px) block

## Output
For each issue found, report:
1. File name and line number
2. Current text or code
3. What's wrong
4. Suggested fix

Do NOT make changes — only report findings.
