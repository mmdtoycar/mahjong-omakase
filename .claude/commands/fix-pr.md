Review PR comments from CodeRabbit and fix all issues, including nits.

## Steps

1. **Resolve repo + PR number first**
   - Repo: `REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)`
   - PR number:
     - If the user provided a PR URL, extract the number from the URL.
     - Otherwise: `PR=$(gh pr view --json number -q .number)` (uses the current branch's PR).
   - Use `$REPO` and `$PR` in every subsequent `gh api` call below — do NOT hardcode `{owner}/{repo}` or the PR number.

2. **Fetch all comments**
   - Get inline review comments: `gh api repos/$REPO/pulls/$PR/comments`
   - Get review-level comments (nits are often here): `gh api repos/$REPO/pulls/$PR/reviews`

3. **Classify each comment**
   - **Actionable**: has a code suggestion or identifies a real issue → fix it
   - **Nit**: minor style/naming/consistency issue → fix it (all nits should be fixed)
   - **Over-engineered for scale**: concurrency hardening (`@Version` optimistic locking, `@Lock` pessimistic locking, race-condition guards, retry/backoff) suggested for an app whose realistic concurrent user count is a small group (~20 people for this project). At this scale the suggested race rarely happens, and adding optimistic locking adds maintenance burden and has historically broken working flows (e.g., admin retries, concurrent edits). **Default = decline.** Reply explaining the scale. Only fix if the bot identifies an actually-observable bug, not a theoretical race.
   - **Invalid**: the suggestion is wrong or doesn't apply → reply explaining why
   - **Already fixed**: check if a previous commit already addressed it → reply with commit hash

4. **Fix all actionable and nit comments**
   - Make the code changes
   - Run pre-flight checks (ALL from project root):
     - `./gradlew spotlessApply`
     - `(cd ui && npx tsc --noEmit)`
     - `(cd ui && npm run lint:css)`
     - `./gradlew compileJava -q`
     - `./gradlew pmdMain` — **any violation must be fixed or suppressed in the ruleset (with reason comment) before pushing.**
   - Commit with a message referencing what was fixed

5. **Reply to every comment**
   - For inline comments: `gh api repos/$REPO/pulls/$PR/comments -X POST -f body="..." -F in_reply_to={comment_id}`
   - For review-level nits (no inline comment ID): `gh pr comment $PR --body "..."`
   - Include the fix commit hash in the reply
   - For invalid suggestions, explain why it's not a bug

6. **Push**
   - `git push`
