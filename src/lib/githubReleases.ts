const API = "https://api.github.com";

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
  published_at: string;
}

export async function getLatestRelease(
  owner: string,
  repo: string
): Promise<GitHubRelease | null> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/releases/latest`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function getReleases(
  owner: string,
  repo: string
): Promise<GitHubRelease[]> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/releases?per_page=30`);
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export function parseVersionFromTag(tag: string): { name: string; code: number } {
  const cleaned = tag.replace(/^v/i, "").trim();
  const parts = cleaned.split(/[.\-+]/).filter(Boolean);
  let code = 1;
  if (parts.length >= 3) {
    const major = parseInt(parts[0]) || 0;
    const minor = parseInt(parts[1]) || 0;
    const patch = parseInt(parts[2]) || 0;
    code = major * 10000 + minor * 100 + patch;
    if (code < 1) code = 1;
  }
  return { name: cleaned || tag, code };
}

export function findApkAsset(
  assets: GitHubRelease["assets"]
): GitHubRelease["assets"][0] | null {
  return assets.find((a) => a.name.toLowerCase().endsWith(".apk")) ?? null;
}
