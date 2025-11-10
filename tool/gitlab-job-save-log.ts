import { tool } from "@opencode-ai/plugin";
import { promises as fs } from "fs";
import * as path from "path";
import { GitLabClient } from "./GitLabClient";
import { resolveGitLabApiUrl } from "./gitlab-helpers/resolveGitLabApiUrl";

export default tool({
  description:
    "Download a GitLab job's raw log and save it to a local file for later review.",
  args: {
    projectId: tool.schema
      .int()
      .describe("Numeric ID of the GitLab project that owns the job."),
    jobId: tool.schema.int().describe("ID of the GitLab job."),
    logPath: tool.schema
      .string()
      .describe("Path where the job log will be written."),
  },
  async execute({ projectId, jobId, logPath }) {
    const token = process.env.GITLAB_TOKEN;
    if (!token) {
      throw new Error("GITLAB_TOKEN environment variable is required.");
    }

    const baseUrl = resolveGitLabApiUrl();
    const client = new GitLabClient(baseUrl, token);

    const logContents = await client.getJobTrace(projectId, jobId);
    const absolutePath = path.resolve(logPath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, logContents, "utf8");

    return `Saved job ${jobId} log to ${absolutePath}`;
  },
});
