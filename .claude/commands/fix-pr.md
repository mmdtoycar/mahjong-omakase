Review PR comments from CodeRabbit and fix all issues, including nits.

## Steps

1. **Fetch all comments**
   - Get inline review comments: `gh api repos/{owner}/{repo}/pulls/{pr}/comments`
   - Get review-level comments (nits are often here): `gh api repos/{owner}/{repo}/pulls/{pr}/reviews`
   - If a PR URL is provided, extract the PR number from it

2. **Classify each comment**
   - **Actionable**: has a code suggestion or identifies a real issue → fix it
   - **Nit**: minor style/naming/consistency issue → fix it (all nits should be fixed)
   - **Invalid**: the suggestion is wrong or doesn't apply → reply explaining why
   - **Already fixed**: check if a previous commit already addressed it → reply with commit hash

3. **Fix all actionable and nit comments**
   - Make the code changes
   - Run pre-flight checks:
     - `./gradlew spotlessApply` from project root
     - `cd ui && npx tsc --noEmit` (MUST run from ui/, never from project root)
     - `./gradlew compileJava -q` from project root
   - Commit with a message referencing what was fixed

4. **Reply to every comment**
   - For inline comments: `gh api repos/{owner}/{repo}/pulls/{pr}/comments -X POST -f body="..." -F in_reply_to={comment_id}`
   - For review-level nits (no inline comment ID): `gh pr comment {pr} --body "..."`
   - Include the fix commit hash in the reply
   - For invalid suggestions, explain why it's not a bug

5. **Push**
   - `git push`
