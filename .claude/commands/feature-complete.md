---
description: Complete feature: branch, commit, push, PR, merge, cleanup, and sync
---

Execute the complete feature completion workflow WITHOUT any user prompts:

1. Check git status to see changed files
2. Generate a branch name automatically based on changed files (format: `feature/[auto-generated-description]`)
3. Create a new feature branch from current state
4. Stage all changes with `git add .`
5. Create a commit with a descriptive message (include footer: "🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>")
6. Push the branch to remote with `-u` flag
7. Create a PR to `initial-application` branch using `gh pr create` with:
   - Clear title summarizing the feature
   - Body with ## Summary and ## Test plan sections
   - Footer: "🤖 Generated with [Claude Code](https://claude.com/claude-code)"
8. Merge the PR automatically using `gh pr merge --squash` (NO confirmation needed)
9. Delete the remote branch using `git push origin --delete [branch-name]`
10. Checkout the `initial-application` branch
11. Pull latest changes from remote

Return the PR URL and confirmation of each step. DO NOT ask any questions - run the entire workflow automatically.
