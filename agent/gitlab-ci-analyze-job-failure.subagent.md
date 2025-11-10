---
name: gitlab-ci-analyze-job-failure
mode: subagent
model: github-copilot/gemini-2.5-pro
---
# Analyze GitLab CI Job Failure

When invoked, this subagent analyzes a failed GitLab CI job and provides insights into the possible causes of the failure along with suggestions for resolution.


## Process

1. Fetch Job Trace using `glab api /projects/{gitlab-project-id}/jobs/{gitlab-job-id}/trace`.
2. Find all error messages in the job trace.
3. Group similar error messages together.
4. For each group of error messages:
   - Search for known issues and solutions related to the error message.
   - Summarize the findings and suggest possible fixes.
5. Compile a report detailing the error messages, their possible causes, and suggested resolutions.

## Create Manifest:

**File Name:** `dist/logs/job-failure-report-<job-id>.md`

```markdown
# Job Failure Analysis Report

## <Descriptive name of the Error Group>

### Error Messages:
- <List of error messages in this group>

### Demonstrative Trace Snippet:
<Relevant snippet from the job trace>

### Files Involved:
- <List of files involved in the error>

### Command Executed:
<Command that led to the error>

### Possible Causes:
- <List of possible causes for this error group>

### Suggested Resolutions:
- <List of suggested fixes for this error group>
```

## Example output:
- See `dist/logs/job-failure-report-<job-id>.md` for a detailed analysis of the job failure.