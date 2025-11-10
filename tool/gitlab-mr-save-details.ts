import { tool } from "@opencode-ai/plugin";
import { promises as fs } from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { GitLabClient } from "./GitLabClient";
import { resolveGitLabApiUrl } from "./gitlab-helpers/resolveGitLabApiUrl";

type MergeRequest = {
  iid: number;
  title: string;
  description: string;
  source_branch: string;
  target_branch: string;
  diff_refs?: {
    base_sha?: string | null;
    head_sha?: string | null;
  } | null;
};

export default tool({
  description:
    "Save a GitLab merge request's title/description and diff to local files.",
  args: {
    projectId: tool.schema
      .int()
      .describe("The numeric ID of the GitLab project"),
    mrIID: tool.schema.int().describe("The merge request IID"),
    detailPath: tool.schema
      .string()
      .describe("File path where the MR details markdown will be written"),
    diffPath: tool.schema
      .string()
      .describe("File path where the git diff will be written"),
  },
  async execute({ projectId, mrIID, detailPath, diffPath }) {
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

    await assertGitRepository();

    const diffRefs = mergeRequest.diff_refs;
    if (!diffRefs?.base_sha || !diffRefs.head_sha) {
      throw new Error(
        "Merge request response did not include diff_refs.base_sha and diff_refs.head_sha."
      );
    }

    if (!mergeRequest.source_branch || !mergeRequest.target_branch) {
      throw new Error(
        "Merge request response did not include source or target branch names."
      );
    }

    await ensureCommitAvailable(
      diffRefs.base_sha,
      mergeRequest.target_branch,
      "target"
    );
    await ensureCommitAvailable(
      diffRefs.head_sha,
      mergeRequest.source_branch,
      "source"
    );

    const detailAbsolutePath = path.resolve(detailPath);
    const diffAbsolutePath = path.resolve(diffPath);

    const detailContents = formatDetailsMarkdown(mergeRequest);
    await writeFile(detailAbsolutePath, detailContents);

    const diffContents = await runGitDiff(diffRefs.base_sha, diffRefs.head_sha);
    await writeFile(diffAbsolutePath, diffContents);

    return [
      `Saved MR details to ${detailAbsolutePath}`,
      `Saved git diff to ${diffAbsolutePath}`,
    ].join("\n");
  },
});

function formatDetailsMarkdown(mr: MergeRequest): string {
  const trimmedDescription = mr.description?.trim();
  const description =
    trimmedDescription && trimmedDescription.length > 0
      ? trimmedDescription
      : "_No description provided._";

  return [
    `# ${mr.title || "Untitled merge request"} (!${mr.iid})`,
    "",
    `- IID: ${mr.iid}`,
    "",
    "## Description",
    "",
    description,
    "",
  ].join("\n");
}

async function writeFile(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

async function runGitDiff(baseSha: string, headSha: string): Promise<string> {
  const result = await runGit(["diff", `${baseSha}...${headSha}`], {
    failureHint:
      "Verify you are running this tool inside the repository that matches the investigated merge request.",
  });
  return result.stdout;
}

async function assertGitRepository(): Promise<void> {
  try {
    const { stdout } = await runGit(["rev-parse", "--is-inside-work-tree"]);
    if (stdout.trim() !== "true") {
      throw new Error();
    }
  } catch {
    throw new Error(
      "Current directory is not inside a Git repository. Verify you are running this tool from the correct project workspace."
    );
  }
}

async function ensureCommitAvailable(
  sha: string,
  branch: string,
  role: "source" | "target"
): Promise<void> {
  if (!sha) {
    throw new Error(`Missing ${role} commit SHA.`);
  }

  if (await gitHasObject(sha)) {
    return;
  }

  const remoteName = process.env.GIT_REMOTE_NAME || "origin";
  await runGit(["fetch", "--quiet", remoteName, branch], {
    failureHint: `Unable to fetch ${role} branch "${branch}" from remote "${remoteName}". Ensure the remote exists or fetch the merge request refs manually.`,
  });

  if (await gitHasObject(sha)) {
    return;
  }

  throw new Error(
    [
      `Commit ${sha} from the ${role} branch "${branch}" is unavailable even after fetching.`,
      "Verify this repository matches the GitLab project and has access to the merge request branches.",
    ].join(" ")
  );
}

async function gitHasObject(sha: string): Promise<boolean> {
  try {
    await runGit(["cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

async function runGit(
  args: string[],
  options?: { failureHint?: string }
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const hint = options?.failureHint
          ? ` ${options.failureHint}`
          : "";
        reject(
          new Error(
            `git ${args.join(" ")} exited with code ${code}. ${
              stderr.trim() || "No stderr."
            }${hint}`
          )
        );
        return;
      }

      resolve({ stdout });
    });
  });
}
