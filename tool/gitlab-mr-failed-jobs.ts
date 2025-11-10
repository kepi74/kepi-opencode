import { tool } from "@opencode-ai/plugin";
import { GitLabClient } from "./GitLabClient";
import type { BridgeJob, Job, PipelineDetails } from "./GitLabClient";
import { resolveGitLabApiUrl } from "../tools/gitlab-helpers/resolveGitLabApiUrl";

export default tool({
  description: "Get current failed CI/CD jobs in a GitLab Merge Request.",
  args: {
    projectId: tool.schema.int().describe("The ID of the GitLab project."),
    mrIID: tool.schema.int().describe("The IID of the Merge Request."),
  },
  async execute({ projectId, mrIID }) {
    const token = process.env.GITLAB_TOKEN;
    if (!token) {
      throw new Error("GITLAB_TOKEN environment variable is required.");
    }

    const baseUrl = resolveGitLabApiUrl();
    const client = new GitLabClient(baseUrl, token);

    const mergeRequest = await client.getMergeRequest<MergeRequest>(
      projectId,
      mrIID
    );
    const headPipeline = mergeRequest.head_pipeline;
    const header = `# Failed jobs for the MR IID ${mrIID}:\n\n`;

    if (!headPipeline) {
      return `${header}No head pipeline found for this merge request.`;
    }

    const pipelineProjectId = headPipeline.project_id ?? projectId;
    const pipelines = await collectPipelines(client, {
      id: headPipeline.id,
      projectId: pipelineProjectId,
    });

    const failedJobs = await collectFailedJobs(client, pipelines);

    if (failedJobs.length === 0) {
      return `${header}No failed jobs found.`;
    }

    const tableHeader =
      "|pipelineID|pipelineName|jobID|jobName|\n| -------- | ---------- | --- | ----- |";
    const tableRows = failedJobs
      .sort((a, b) => a.pipelineId - b.pipelineId || a.jobId - b.jobId)
      .map(
        (row) =>
          `| ${row.pipelineId} | ${escapeCell(row.pipelineName)} | ${
            row.jobId
          } | ${escapeCell(row.jobName)} |`
      )
      .join("\n");

    return `${header}${tableHeader}\n${tableRows}`;
  },
});

type MergeRequest = {
  head_pipeline?: PipelineSummary | null;
};

type PipelineSummary = {
  id: number;
  project_id?: number;
  name?: string;
  ref?: string;
};

type PipelineRef = {
  id: number;
  projectId: number;
};

type FailedJobRow = {
  pipelineId: number;
  pipelineName: string;
  jobId: number;
  jobName: string;
};

async function collectPipelines(
  client: GitLabClient,
  root: PipelineRef
): Promise<PipelineRef[]> {
  const pipelines: PipelineRef[] = [];
  const visited = new Set<string>();

  async function walk(ref: PipelineRef): Promise<void> {
    const key = `${ref.projectId}:${ref.id}`;
    if (visited.has(key)) {
      return;
    }

    visited.add(key);
    pipelines.push(ref);

    const bridges = await client.getPipelineBridges(ref.projectId, ref.id);
    for (const bridge of bridges) {
      const downstream = bridge.downstream_pipeline;
      if (!downstream) {
        continue;
      }

      const downstreamProjectId = downstream.project_id ?? ref.projectId;
      await walk({
        id: downstream.id,
        projectId: downstreamProjectId,
      });
    }
  }

  await walk(root);

  return pipelines;
}

async function collectFailedJobs(
  client: GitLabClient,
  pipelines: PipelineRef[]
): Promise<FailedJobRow[]> {
  const cache = new Map<string, PipelineDetails>();
  const rows: FailedJobRow[] = [];

  for (const pipelineRef of pipelines) {
    const pipeline = await getPipelineDetails(
      client,
      cache,
      pipelineRef.projectId,
      pipelineRef.id
    );
    const jobs = await client.getPipelineJobs(pipeline.project_id, pipeline.id);
    for (const job of jobs) {
      if (job.status !== "failed") {
        continue;
      }

      rows.push({
        pipelineId: pipeline.id,
        pipelineName: resolvePipelineName(pipeline),
        jobId: job.id,
        jobName: job.name,
      });
    }
  }

  return rows;
}

async function getPipelineDetails(
  client: GitLabClient,
  cache: Map<string, PipelineDetails>,
  projectId: number,
  pipelineId: number
): Promise<PipelineDetails> {
  const key = `${projectId}:${pipelineId}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const pipeline = await client.getPipeline(projectId, pipelineId);
  cache.set(key, pipeline);
  return pipeline;
}

function resolvePipelineName(
  pipeline: PipelineDetails | PipelineSummary
): string {
  return pipeline.name ?? pipeline.ref ?? `pipeline-${pipeline.id}`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}
