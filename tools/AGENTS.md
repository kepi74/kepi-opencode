# Custom Tools Guide

- All GitLab API calls must go through the shared client in `tool/GitLabClient`. Reuse it instead of creating new fetch logic so headers, pagination, and error handling stay consistent.
- `GITLAB_TOKEN` is required for any GitLab REST access. Tools should validate it early and support overriding the API root via `GITLAB_API_URL` (defaults to `https://gitlab.com/api/v4`).
- Call `resolveGitLabApiUrl()` from `tools/gitlab-helpers/resolveGitLabApiUrl.ts` whenever you need the API base so overrides via `GITLAB_API_URL`/`GITLAB_HOST` stay consistent across tools.
- Tool outputs should be concise and, when listing jobs or pipelines, prefer Markdown tables like the one used in `tool/gitlab-mr-failed-jobs.ts` so results are easy to scan in the CLI.

## Custom Tool Instructions

### Structure

The easiest way to create tools is using the **tool()** helper which provides type-safety and validation.

```ts
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Query the project database",
  args: {
    query: tool.schema.string().describe("SQL query to execute"),
  },
  async execute(args) {
    // Your database logic here
    return `Executed query: ${args.query}`
  },
})
```
The _filename_ becomes the _tool name_. For example, `tool/my-tool.ts` is invoked as `my-tool`.

### Arguments

You can use `tool.schema`, which is just Zod, to define argument types.

```ts
args: {
  query: tool.schema.string().describe("SQL query to execute")
}
```

### Context

Tools receive context about the current session:

```ts
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Get project information",
  args: {},
  async execute(args, context) {
    // Access context information
    const { agent, sessionID, messageID } = context
    return `Agent: ${agent}, Session: ${sessionID}, Message: ${messageID}`
  },
})
```

### Multiple Tools per File

You can also export multiple tools from a single file. Each export becomes a separate tool with the name `<filename>_<exportname>`:

file: `tool/math.ts`

```ts
import { tool } from "@opencode-ai/plugin"

export const add = tool({
  description: "Add two numbers",
  args: {
    a: tool.schema.number().describe("First number"),
    b: tool.schema.number().describe("Second number"),
  },
  async execute(args) {
    return args.a + args.b
  },
})

export const multiply = tool({
  description: "Multiply two numbers",
  args: {
    a: tool.schema.number().describe("First number"),
    b: tool.schema.number().describe("Second number"),
  },
  async execute(args) {
    return args.a * args.b
  },
})
```

This creates two tools: `math_add` and `math_multiply`.


## GitLab client

- Located in `tool/GitLabClient/index.ts`. Always import the `GitLabClient` and the exported types (`PipelineDetails`, `Job`, `BridgeJob`) instead of redefining them.
- Handles authentication headers, base URL (`resolveGitLabApiUrl()` already applies env overrides), and pagination (`per_page=100`, automatic next-page following), so individual tools only need to call the provided helpers.
- Provides helpers:
  - `getMergeRequest(projectId, mrIID)` – returns raw MR JSON; pass a type parameter when you need stricter typing.
  - `getPipeline(projectId, pipelineId)` – fetches pipeline metadata (name, ref, owning project).
  - `getPipelineJobs(projectId, pipelineId)` – retrieves every job in a pipeline with pagination handled.
  - `getPipelineBridges(projectId, pipelineId)` – returns bridge jobs so you can traverse downstream/child pipelines.
- Errors already include the HTTP status and GitLab body; surface them unless a tool needs custom messaging.
