---
name: git-feature-workflow
description: Automates feature branch workflow. Invoke when user says "start feature [description]" to create a branch, or "feature complete/done/finished" to commit changes, push branch, and create PR. Handles branch naming, commit messages, and PR descriptions automatically.
allowed-tools: Bash, Grep, Read, Write
---

# Git Feature Workflow

Automates the complete feature branch workflow from start to finish.

## Instructions

### When User Starts a Feature

**Trigger phrases:** "start feature", "starting new feature", "begin feature", "new feature"

1. Extract the feature description from the user's message
2. Generate branch name:
   - Convert description to lowercase
   - Replace spaces with hyphens
   - Remove special characters (keep only letters, numbers, hyphens)
   - Prefix with `feat/`
   - Example: "Add user authentication" → `feat/add-user-authentication`
3. Create and checkout the new branch:
   ```bash
   git checkout -b feat/[generated-name]
   ```
4. Confirm to user:
   - Branch name created
   - Current branch status
   - Ready to work on the feature

### When User Completes a Feature

**Trigger phrases:** "feature complete", "feature done", "feature finished", "completed feature", "finish feature", "done with feature"

1. **Check for changes:**
   ```bash
   git status
   ```
   - If no changes, inform user and exit
   - If changes exist, proceed

2. **Analyze changes:**
   ```bash
   git diff
   git status
   ```
   - Review all modified, added, and deleted files
   - Understand the scope of changes

3. **Stage all changes:**
   ```bash
   git add .
   ```

4. **Generate commit message:**
   - Analyze the actual changes from git diff
   - Create descriptive commit message following conventions:
     - Start with action verb (Add, Update, Fix, Remove, Refactor, etc.)
     - Be specific about what changed
     - Include key details but keep concise (1-2 lines)
     - Examples:
       - "Add user authentication with JWT tokens and login form"
       - "Fix: resolve database connection timeout in production"
       - "Update bid form UX with transparent placeholder row"
   - Format with Claude Code footer:
     ```
     [Your generated message]

     Generated with [Claude Code](https://claude.com/claude-code)

     Co-Authored-By: Claude <noreply@anthropic.com>
     ```

5. **Commit changes:**
   ```bash
   git commit -m "$(cat <<'EOF'
   [Generated commit message with footer]
   EOF
   )"
   ```

6. **Get current branch name:**
   ```bash
   git branch --show-current
   ```

7. **Push to remote:**
   ```bash
   git push -u origin [branch-name]
   ```

8. **Check recent commits for PR description:**
   ```bash
   git log origin/master..HEAD --oneline
   git diff origin/master...HEAD --stat
   ```

9. **Generate PR description:**
   - Analyze all commits and changes since branching from master
   - Create comprehensive PR description:
     - **Summary section:** 2-4 bullet points of key changes
     - **Changes section:** List of main modifications
     - **Test plan section:** Basic checklist for testing (if applicable)
     - Include Claude Code footer
   - Format:
     ```markdown
     ## Summary
     - Key change 1
     - Key change 2
     - Key change 3

     ## Changes
     Brief description of what was modified and why.

     ## Test plan
     - [ ] Verify functionality X works
     - [ ] Check that Y displays correctly
     - [ ] Test Z scenario

     Generated with [Claude Code](https://claude.com/claude-code)
     ```

10. **Create PR:**
    ```bash
    gh pr create --title "[Auto-generated title from commit]" --body "$(cat <<'EOF'
    [Generated PR description]
    EOF
    )"
    ```

11. **Report to user:**
    - PR URL
    - Branch name
    - Summary of changes
    - Commit message used

## Important Notes

- Always use HEREDOC format for commit messages and PR descriptions to handle multi-line text properly
- Never skip the Claude Code footer in commits and PRs
- If `git status` shows no changes, don't create empty commits - inform the user instead
- If push fails, check if branch already exists on remote and handle accordingly
- If PR creation fails, provide the error and suggest manual creation
- Extract feature description from natural language (e.g., "start feature add login" → `feat/add-login`)
- Auto-invoke this skill whenever user mentions starting or completing a feature

## Examples

### Starting a Feature

**User:** "Start feature: improve search performance"

**Actions:**
1. Create branch: `feat/improve-search-performance`
2. Checkout branch
3. Confirm: "Created and checked out branch `feat/improve-search-performance`. Ready to work on your feature!"

### Completing a Feature

**User:** "Feature complete"

**Actions:**
1. Check git status (finds 3 modified files)
2. Analyze changes (improved search algorithm, added caching, updated tests)
3. Stage all changes
4. Generate commit message: "Improve search performance with caching and optimized algorithm"
5. Commit with Claude Code footer
6. Push to origin
7. Generate PR description with summary of caching implementation and performance gains
8. Create PR
9. Report: "Created PR #42: https://github.com/user/repo/pull/42"

## Error Handling

- **No changes detected:** Inform user no changes to commit
- **Not on a feature branch:** Warn user they should be on a feature branch
- **Push fails:** Check remote status and provide actionable error message
- **PR creation fails:** Provide gh CLI error and suggest alternatives
- **Divergent branches:** Suggest pulling latest changes from master first
