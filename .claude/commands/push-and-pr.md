---
description: Create branch, commit changes, push to remote, and create PR
---

Automate the complete Git workflow:

1. Check git status to see what files have changed
2. Create a new feature branch with a descriptive name based on the changes (use format: `feature/[description]`)
3. Stage all changes with `git add .`
4. Create a commit with a descriptive message that summarizes the changes (include the footer: "🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>")
5. Push the branch to remote with `-u` flag
6. Create a PR to the `initial-application` branch using `gh pr create` with:
   - A clear title summarizing the changes
   - A body with:
     - ## Summary section with bullet points of changes
     - ## Test plan section with testing checklist
     - Footer: "🤖 Generated with [Claude Code](https://claude.com/claude-code)"

Return the PR URL when done.
