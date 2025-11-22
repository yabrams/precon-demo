---
description: Complete feature: branch, commit, push, PR, merge, cleanup, and sync
---

Execute the complete feature completion workflow:

1. Ask me for a feature name/description to use for branch naming
2. Create a new feature branch from current state (format: `feature/[description]`)
3. Check git status to see changed files
4. Stage all changes with `git add .`
5. Create a commit with a descriptive message (include footer: "🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>")
6. Push the branch to remote with `-u` flag
7. Create a PR to `initial-application` branch using `gh pr create` with:
   - Clear title summarizing the feature
   - Body with ## Summary and ## Test plan sections
   - Footer: "🤖 Generated with [Claude Code](https://claude.com/claude-code)"
8. Ask for confirmation before merging
9. Merge the PR using `gh pr merge --squash`
10. Delete the remote branch using `git push origin --delete [branch-name]`
11. Checkout the `initial-application` branch
12. Pull latest changes from remote

Return the PR URL and confirmation of each step.
