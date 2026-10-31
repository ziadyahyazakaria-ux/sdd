import type { FdroidApp, FdroidConfig } from "./types";

export interface RepoFile {
  path: string;
  bytes: Uint8Array;
}

export interface PreparedApp {
  apkSize: number;
  apkSha256: string;
  iconName?: string;
  featureGraphicPath?: string;
  screenshotPaths: string[];
}

export interface PreparedRepo {
  files: RepoFile[];
  apps: Record<string, PreparedApp>;
  repoIconName?: string;
}

async function fetchBytes(url: string, label: string): Promise<Uint8Array<ArrayBuffer>> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(
      `Could not download ${label} from ${url}. The link must be public and allow downloads from a browser.`
    );
  }
  if (!res.ok) throw new Error(`Could not download ${label} (HTTP ${res.status}).`);
  const buffer: ArrayBuffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function imageExt(url: string): string {
  const match = url.split("?")[0].match(/\.(png|jpe?g)$/i);
  if (!match) return "png";
  const ext = match[1].toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

export async function prepareRepo(config: FdroidConfig, apps: FdroidApp[]): Promise<PreparedRepo> {
  const files: RepoFile[] = [];
  let repoIconName: string | undefined;

  if (config.repo_icon) {
    files.push({
      path: "icon.png",
      bytes: await fetchBytes(config.repo_icon, "repository icon"),
    });
    repoIconName = "icon.png";
  }

  const prepared: Record<string, PreparedApp> = {};
  for (const app of apps) {
    const apk = await fetchBytes(app.apk_url, `APK for ${app.name}`);
    const entry: PreparedApp = {
      apkSize: apk.length,
      apkSha256: await sha256Hex(apk),
      screenshotPaths: [],
    };
    const folder = `${app.package_name}/en-US`;

    if (app.icon_url) {
      const name = `${app.package_name}.${app.version_code}.png`;
      files.push({
        path: `icons/${name}`,
        bytes: await fetchBytes(app.icon_url, `icon for ${app.name}`),
      });
      entry.iconName = name;
    }

    if (app.feature_graphic_url) {
      const path = `${folder}/featureGraphic.${imageExt(app.feature_graphic_url)}`;
      files.push({
        path,
        bytes: await fetchBytes(app.feature_graphic_url, `feature graphic for ${app.name}`),
      });
      entry.featureGraphicPath = `/${path}`;
    }

    for (const [i, url] of app.screenshots.entries()) {
      const path = `${folder}/phoneScreenshots/${i + 1}.${imageExt(url)}`;
      files.push({
        path,
        bytes: await fetchBytes(url, `screenshot ${i + 1} for ${app.name}`),
      });
      entry.screenshotPaths.push(`/${path}`);
    }

    prepared[app.package_name] = entry;
  }

  return { files, apps: prepared, repoIconName };
}

export function buildIndexV1(
  config: FdroidConfig,
  apps: FdroidApp[],
  prepared: Record<string, PreparedApp> = {},
  repoIconName?: string
): object {
  const now = Math.floor(Date.now() / 1000);
  return {
    repo: {
      timestamp: now,
      version: 20002,
      maxage: 14,
      name: config.repo_name,
      icon: repoIconName ?? "icon.png",
      address: `https://${config.github_owner}.github.io/${config.github_repo}/fdroid/repo`,
      description: config.repo_description,
    },
    requests: { install: [], uninstall: [] },
    apps: apps.map((app) => {
      const p = prepared[app.package_name];
      return {
        packageName: app.package_name,
        name: app.name,
        summary: app.summary,
        description: app.description,
        icon: p?.iconName ?? "",
        license: app.license,
        sourceCode: app.source_url || undefined,
        authorName: app.author_name || undefined,
        webSite: app.website_url || undefined,
        issueTracker: app.issue_tracker_url || undefined,
        changelog: app.changelog_url || undefined,
        donate: app.donate_url ? [app.donate_url] : undefined,
        antiFeatures: app.anti_features.length ? app.anti_features : undefined,
        categories: app.categories,
        added: Math.floor(new Date(app.created_at).getTime() / 1000),
        lastUpdated: Math.floor(new Date(app.updated_at).getTime() / 1000),
        suggestedVersionCode: app.version_code,
        suggestedVersionName: app.version_name,
        localized: {
          "en-US": {
            icon: p?.iconName ? `/icons/${p.iconName}` : undefined,
            featureGraphic: p?.featureGraphicPath,
            phoneScreenshots: p?.screenshotPaths.length ? p.screenshotPaths : undefined,
          },
        },
      };
    }),
    packages: Object.fromEntries(
      apps.map((app) => {
        const p = prepared[app.package_name];
        return [
          app.package_name,
          [
            {
              packageName: app.package_name,
              versionName: app.version_name,
              versionCode: app.version_code,
              added: Math.floor(new Date(app.updated_at).getTime() / 1000),
              apkName: `${app.package_name}_${app.version_code}.apk`,
              download: app.apk_url,
              minSdkVersion: app.min_sdk,
              targetSdkVersion: app.min_sdk,
              size: p?.apkSize ?? 0,
              hash: p?.apkSha256 ?? "",
              hashType: "sha256",
              sig: "",
              signer: "",
              permissions: [],
              nativecode: [],
              whatsNew: app.changelog || undefined,
            },
          ],
        ];
      })
    ),
  };
}
