const ALLOWED_URL_PROTOCOLS = ["https:", "http:"];

const PACKAGE_NAME_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;

export function isValidUrl(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const u = new URL(url.trim());
    return ALLOWED_URL_PROTOCOLS.includes(u.protocol);
  } catch {
    return false;
  }
}

export function isValidPackageName(pkg: string): boolean {
  return PACKAGE_NAME_RE.test(pkg.trim());
}

export function isValidVersionCode(code: number): boolean {
  return Number.isInteger(code) && code >= 1;
}

export function isValidSdk(sdk: number): boolean {
  return Number.isInteger(sdk) && sdk >= 1 && sdk <= 99;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function validateAppUrls(app: {
  apk_url: string;
  icon_url: string;
  source_url: string;
  website_url: string;
  issue_tracker_url: string;
  changelog_url: string;
  donate_url: string;
  feature_graphic_url: string;
  screenshots: string[];
}): string[] {
  const errors: string[] = [];
  const checks: Array<[string, string]> = [
    ["APK URL", app.apk_url],
    ["Icon URL", app.icon_url],
    ["Source URL", app.source_url],
    ["Website URL", app.website_url],
    ["Issue tracker URL", app.issue_tracker_url],
    ["Changelog URL", app.changelog_url],
    ["Donate URL", app.donate_url],
    ["Feature graphic URL", app.feature_graphic_url],
  ];
  for (const [label, url] of checks) {
    if (url.trim() && !isValidUrl(url)) {
      errors.push(`${label} is not a valid URL.`);
    }
  }
  for (const [i, url] of app.screenshots.entries()) {
    if (url.trim() && !isValidUrl(url)) {
      errors.push(`Screenshot ${i + 1} URL is not a valid URL.`);
    }
  }
  return errors;
}
