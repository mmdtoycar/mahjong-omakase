Commit all changes and create a PR. Do not include yourself as co-author or committer.

**Language convention for this repo**: write the commit body, PR title summary, PR description, and Test plan items in **Chinese**. Keep the conventional-commit prefix (`feat:` / `fix:` / `style:` / `refactor:` / `chore:`) in English — that part follows global convention. Code-related identifiers, file paths, command names, and technical jargon (GIS, OAuth, N+1, CSS, etc.) stay in their original form.

## Steps

1. **Pre-flight checks** (ALL commands MUST run from project root)
   - Run `./gradlew spotlessApply` to format Java code
   - Run `(cd ui && npx tsc --noEmit)` to verify TypeScript compiles (subshell keeps cwd at project root)
   - Run `npx oxlint@latest ui/src` to lint JS/TS via oxc. Reads `.oxlintrc.json` at repo root. Block on `correctness` errors; surface `suspicious`/`perf` warnings in the PR description's 测试要点 section so the reviewer is aware (but don't block).
   - Run `./gradlew compileJava -q` to verify Java compiles
   - If any check fails, stop and report the error. Do NOT create the PR.

2. **Review changes**
   - Run `git status` and `git diff HEAD --stat`
   - Run `git log --oneline -5` to understand commit message style

3. **Stage and commit**
   - Stage specific changed files (do NOT use `git add -A` or `git add .`)
   - Write a commit message following the repo's convention:
     - Use conventional commit prefix: `feat:`, `fix:`, `style:`, `refactor:`, `chore:` (English prefix)
     - Title summary in Chinese, keep under 70 chars total
     - Body in Chinese, bullet-point format, group by area (后端 / 前端 / 工具 etc.)
   - Do NOT add `Co-Authored-By` or any co-author trailer

4. **Push and create PR**
   - Push the branch with `-u origin <branch>`
   - Create PR with `gh pr create` using:
     - Title: same as commit message first line (English prefix + Chinese summary)
     - Body in Chinese, structured as:
       - `## 概要` — one-paragraph overview with file count and +/- lines
       - Numbered sections (`## 一、xxx`, `## 二、xxx`, ...) grouping related changes by area, each with a brief reason and the concrete change
       - `## 测试要点` — checklist (`- [ ] ...`) of things the reviewer should verify
       - Optional `## 文件改动` — list of new / deleted / heavily-modified files with one-line role descriptions
     - End body with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

5. **Report the PR URL**

