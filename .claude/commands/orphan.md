Search for unused/orphan code across both backend and frontend.

## Backend (src/main/java/)
- Java classes/enums/interfaces never imported or referenced anywhere
- Unused imports in any Java file
- DTO fields never read by any controller or service
- Repository methods never called by any service
- Service methods never called by any controller

## Frontend (frontend/src/)
- CSS classes in index.css not used by any .tsx component (grep each class name against all .tsx files)
- Exported functions in api/index.ts not imported by any page
- Exported types/interfaces/constants in types/index.ts not imported by any file
- Page components not routed in App.tsx

## Output
For each orphan found, report:
1. File name and line number
2. The unused code
3. Why it's orphaned
4. Suggested action (delete, or reason to keep)

Do NOT make changes — only report findings.
