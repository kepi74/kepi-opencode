/**
 * Resolve the GitLab REST base URL honoring overrides via environment variables.
 */
export function resolveGitLabApiUrl(): string {
  const explicit = process.env.GITLAB_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const host = process.env.GITLAB_HOST?.trim();
  if (host) {
    return `${host.replace(/\/$/, "")}/api/v4`;
  }

  return "https://gitlab.com/api/v4";
}
