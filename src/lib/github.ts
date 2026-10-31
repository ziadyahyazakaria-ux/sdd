const API = "https://api.github.com";

export function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

export async function getOrCreateBranch(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<void> {
  const headers = githubHeaders(token);

  const branchRes = await fetch(`${API}/repos/${owner}/${repo}/branches/${branch}`, { headers });
  if (branchRes.ok) return;

  const repoRes = await fetch(`${API}/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) throw new Error(`Repository not found: ${owner}/${repo}`);
  const repoData = await repoRes.json();
  const defaultBranch = repoData.default_branch;

  const refRes = await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`, {
    headers,
  });
  if (!refRes.ok) throw new Error(`Could not get default branch ref`);
  const refData = await refRes.json();

  const createRes = await fetch(`${API}/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: refData.object.sha,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Failed to create branch: ${err.message}`);
  }
}

export async function upsertFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  base64Content: string,
  token: string,
  message: string
): Promise<void> {
  const headers = githubHeaders(token);

  const getRes = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
    headers,
  });
  const sha = getRes.ok ? (await getRes.json()).sha : undefined;

  const body: Record<string, string> = {
    message,
    content: base64Content,
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(`Failed to upload ${path}: ${err.message}`);
  }
}
