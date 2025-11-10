# Custom Tools Guide

- All GitLab API calls must go through the shared client in `tool/GitLabClient`. Reuse it instead of creating new fetch logic so headers, pagination, and error handling stay consistent.
- `GITLAB_TOKEN` is required for any GitLab REST access. Tools should validate it early and support overriding the API root via `GITLAB_API_URL` (defaults to `https://gitlab.com/api/v4`).
- Tool outputs should be concise and, when listing jobs or pipelines, prefer Markdown tables like the one used in `tool/gitlab-mr-failed-jobs.ts` so results are easy to scan in the CLI.

## GitLab client

- Located in `tool/GitLabClient/index.ts`. Always import the `GitLabClient` and the exported types (`PipelineDetails`, `Job`, `BridgeJob`) instead of redefining them.
- Handles authentication headers, base URL (`GITLAB_API_URL` override, default `https://gitlab.com/api/v4`), and pagination (`per_page=100`, automatic next-page following), so individual tools only need to call the provided helpers.
- Provides helpers:
  - `getMergeRequest(projectId, mrIID)` – returns raw MR JSON; pass a type parameter when you need stricter typing.
  - `getPipeline(projectId, pipelineId)` – fetches pipeline metadata (name, ref, owning project).
  - `getPipelineJobs(projectId, pipelineId)` – retrieves every job in a pipeline with pagination handled.
  - `getPipelineBridges(projectId, pipelineId)` – returns bridge jobs so you can traverse downstream/child pipelines.
- Errors already include the HTTP status and GitLab body; surface them unless a tool needs custom messaging.
