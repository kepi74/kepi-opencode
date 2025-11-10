export type PipelineDetails = {
  id: number;
  project_id: number;
  name?: string;
  ref?: string;
};

export type Job = {
  id: number;
  name: string;
  status: string;
};

export type BridgeJob = {
  downstream_pipeline?: {
    id: number;
    project_id?: number;
  } | null;
};

export class GitLabClient {
  private readonly headers: Record<string, string>;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {
    this.headers = {
      "Content-Type": "application/json",
      "Private-Token": this.token,
    };
  }

  async getMergeRequest<T = unknown>(
    projectId: number,
    mrIID: number
  ): Promise<T> {
    return this.fetchJson<T>(`/projects/${projectId}/merge_requests/${mrIID}`);
  }

  async getPipeline(
    projectId: number,
    pipelineId: number
  ): Promise<PipelineDetails> {
    return this.fetchJson<PipelineDetails>(
      `/projects/${projectId}/pipelines/${pipelineId}`
    );
  }

  async getPipelineJobs(projectId: number, pipelineId: number): Promise<Job[]> {
    return this.fetchPaged<Job>(
      `/projects/${projectId}/pipelines/${pipelineId}/jobs`
    );
  }

  async getPipelineBridges(
    projectId: number,
    pipelineId: number
  ): Promise<BridgeJob[]> {
    return this.fetchPaged<BridgeJob>(
      `/projects/${projectId}/pipelines/${pipelineId}/bridges`
    );
  }

  async getJobTrace(projectId: number, jobId: number): Promise<string> {
    const response = await this.fetch(
      `/projects/${projectId}/jobs/${jobId}/trace`
    );
    return response.text();
  }

  private async fetchJson<T>(
    path: string,
    searchParams?: Record<string, string | number | undefined>
  ): Promise<T> {
    const res = await this.fetch(path, searchParams);
    return (await res.json()) as T;
  }

  private async fetch(
    path: string,
    searchParams?: Record<string, string | number | undefined>
  ): Promise<Response> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url, {
      headers: this.headers,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GitLab API request failed (${response.status} ${response.statusText}): ${body}`
      );
    }

    return response;
  }

  private async fetchPaged<T>(
    path: string,
    params?: Record<string, string | number | undefined>
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (true) {
      const response = await this.fetch(path, {
        ...params,
        page,
        per_page: 100,
      });

      const chunk = (await response.json()) as T[];
      if (!Array.isArray(chunk)) {
        throw new Error("Expected paged response to be an array.");
      }

      results.push(...chunk);

      const nextPage = response.headers.get("x-next-page");
      if (!nextPage) {
        break;
      }

      const nextPageNumber = Number(nextPage);
      if (!nextPageNumber) {
        break;
      }

      page = nextPageNumber;
    }

    return results;
  }
}
