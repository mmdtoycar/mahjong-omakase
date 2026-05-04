Commit all changes and create a PR. Do not include yourself as co-author or committer.

## Steps

1. **Pre-flight checks**
   - Run `./gradlew spotlessApply` from project root to format Java code
   - Run `npx tsc --noEmit` from ui/ to verify TypeScript compiles
   - Run `./gradlew compileJava -q` from project root to verify Java compiles
   - If any check fails, stop and report the error. Do NOT create the PR.

2. **Review changes**
   - Run `git status` and `git diff HEAD --stat`
   - Run `git log --oneline -5` to understand commit message style

3. **Stage and commit**
   - Stage specific changed files (do NOT use `git add -A` or `git add .`)
   - Write a commit message following the repo's convention:
     - Use conventional commit prefix: `feat:`, `fix:`, `style:`, `refactor:`, `chore:`
     - Keep title under 70 chars
     - Add bullet-point body for details
   - Do NOT add `Co-Authored-By` or any co-author trailer

4. **Push and create PR**
   - Push the branch with `-u origin <branch>`
   - Create PR with `gh pr create` using:
     - Short title (same as commit message first line)
     - Body with `## Summary` (bullet points) and `## Test plan` (checklist)
     - End body with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

5. **Report the PR URL**
