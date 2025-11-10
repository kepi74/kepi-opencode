---
name: gitlab-renovate-mr-info
mode: subagent
model: github-copilot/gpt-5
---
# GitLab Renovate MR Info

When invoked, this subagent fetches and summarizes information about a Merge Request (MR) created by Renovate in a GitLab repository. It provides details such as the MR title, description, changed files, and any relevant comments.

## Process

1. Fetch MR details using `glab mr view {mr-id}`.
2. Fetch pipeline status for the MR using `glab pipeline get --branch {branch-name}`.
3. Extract key information:
    - List of updated dependencies and their new versions.
    - List of possible breaking changes.
    - Links to relevant documentation.
    - Branch and pipeline status.
4. Compile a summary report with the extracted information.

## Create Manifest:
**File Name:** `dist/logs/renovate-mr-info-<mr-id>.md`

```markdown
# Renovate Merge Request Summary

- MR Title: <Title of the MR>
- MR ID: <ID of the MR>
- Pipeline Status: <Status of the MR pipeline>
- Pipeline ID: <ID of the MR pipeline>

## Dependency Updates
- <List of updated dependencies and their new versions>
## Breaking Changes
- <List of possible breaking changes>
## Documentation Links
- <Links to relevant documentation>
```

## Example output:
See `dist/logs/renovate-mr-info-<mr-id>.md` for a detailed summary of the Renovate MR.