import { useState, useEffect, useCallback } from "react";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Alert from "@cloudscape-design/components/alert";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import ProgressBar from "@cloudscape-design/components/progress-bar";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Spinner from "@cloudscape-design/components/spinner";
import { QRCodeSVG } from "qrcode.react";
import { getApps } from "../lib/db";
import { buildIndexV1, prepareRepo } from "../lib/fdroidIndex";
import { bytesToBase64, getOrCreateBranch, githubHeaders, textToBase64, upsertFile } from "../lib/github";
import { escapeHtml } from "../lib/validation";
import type { FdroidConfig, FdroidApp } from "../lib/types";

interface Props {
  config: FdroidConfig;
}

interface DeployStep {
  label: string;
  status: "pending" | "in-progress" | "success" | "error";
  message?: string;
}

interface DeployHistoryEntry {
  timestamp: string;
  status: "success" | "error";
  message: string;
  commitSha?: string;
  repoUrl: string;
}

interface ConnectionTestResult {
  status: "success" | "error" | "pending";
  message: string;
}

export default function DeployPage({ config }: Props) {
  const [apps, setApps] = useState<FdroidApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [steps, setSteps] = useState<DeployStep[]>([]);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [preview, setPreview] = useState("");
  const [history, setHistory] = useState<DeployHistoryEntry[]>([]);
  const [connTest, setConnTest] = useState<ConnectionTestResult | null>(null);
  const [testingConn, setTestingConn] = useState(false);

  const updateStep = useCallback(
    (index: number, status: DeployStep["status"], message?: string) => {
      setSteps((prev) =>
        prev.map((s, i) => (i === index ? { ...s, status, message } : s))
      );
    },
    []
  );

  const repoUrl = `https://${config.github_owner}.github.io/${config.github_repo}/fdroid/repo`;

  useEffect(() => {
    getApps(config.id)
      .then((data) => {
        setApps(data);
        const index = buildIndexV1(config, data);
        setPreview(JSON.stringify(index, null, 2));
      })
      .catch((e) => setDeployError(e.message))
      .finally(() => setLoading(false));

    const stored = localStorage.getItem(`deploy_history_${config.id}`);
    if (stored) {
      try { setHistory(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [config]);

  function saveHistory(entry: DeployHistoryEntry) {
    const updated = [entry, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem(`deploy_history_${config.id}`, JSON.stringify(updated));
  }

  async function handleTestConnection() {
    const token = localStorage.getItem(`gh_token_${config.id}`);
    if (!token) {
      setConnTest({ status: "error", message: "No GitHub token found. Add one in Repository Setup." });
      return;
    }
    setTestingConn(true);
    setConnTest({ status: "pending", message: "Testing..." });
    try {
      const res = await fetch(`https://api.github.com/repos/${config.github_owner}/${config.github_repo}`, {
        headers: githubHeaders(token),
      });
      if (!res.ok) {
        const err = await res.json();
        setConnTest({ status: "error", message: `Repository check failed: ${err.message}` });
        return;
      }
      const data = await res.json();

      const scopesRes = await fetch(`https://api.github.com/user`, {
        headers: githubHeaders(token),
      });
      if (!scopesRes.ok) {
        setConnTest({ status: "error", message: "Token verification failed. Check your token permissions." });
        return;
      }

      const branchRes = await fetch(
        `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/branches/${config.github_branch}`,
        { headers: githubHeaders(token) }
      );
      const branchExists = branchRes.ok;

      let pagesStatus = "unknown";
      const pagesRes = await fetch(
        `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/pages`,
        { headers: githubHeaders(token) }
      );
      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        pagesStatus = pagesData.status ?? "unknown";
      }

      setConnTest({
        status: "success",
        message: `Repository: ${data.full_name} | Branch "${config.github_branch}": ${branchExists ? "exists" : "will be created"} | GitHub Pages: ${pagesStatus === "unknown" ? "not configured (optional)" : pagesStatus}`,
      });
    } catch (e: unknown) {
      setConnTest({
        status: "error",
        message: e instanceof Error ? e.message : "Connection test failed.",
      });
    } finally {
      setTestingConn(false);
    }
  }

  async function handleDeploy() {
    const token = localStorage.getItem(`gh_token_${config.id}`);
    if (!token) {
      setDeployError("No GitHub Personal Access Token found. Please save one in the Setup page first.");
      return;
    }

    setDeployError(null);
    setDeploySuccess(false);
    setDeploying(true);

    const initialSteps: DeployStep[] = [
      { label: "Connecting to GitHub repository", status: "pending" },
      { label: "Creating / verifying branch", status: "pending" },
      { label: "Downloading apps and calculating checksums", status: "pending" },
      { label: "Uploading icons and graphics", status: "pending" },
      { label: "Uploading F-Droid index (index-v1.json)", status: "pending" },
      { label: "Uploading index redirect page", status: "pending" },
    ];
    setSteps(initialSteps);

    const { github_owner: owner, github_repo: repo, github_branch: branch } = config;

    try {
      updateStep(0, "in-progress");
      const verifyRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: githubHeaders(token),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(`GitHub API error: ${err.message}`);
      }
      updateStep(0, "success");

      updateStep(1, "in-progress");
      await getOrCreateBranch(owner, repo, branch, token);
      updateStep(1, "success");

      updateStep(2, "in-progress");
      const prepared = await prepareRepo(config, apps);
      updateStep(2, "success");

      updateStep(3, "in-progress");
      for (const file of prepared.files) {
        await upsertFile(
          owner, repo, branch,
          `fdroid/repo/${file.path}`,
          bytesToBase64(file.bytes),
          token,
          `Update F-Droid asset ${file.path}`
        );
      }
      updateStep(3, "success");

      updateStep(4, "in-progress");
      const indexJson = JSON.stringify(
        buildIndexV1(config, apps, prepared.apps, prepared.repoIconName),
        null, 2
      );
      const indexRes = await upsertFile(
        owner, repo, branch,
        "fdroid/repo/index-v1.json",
        textToBase64(indexJson),
        token,
        `Update F-Droid index [${new Date().toISOString()}]`
      );
      void indexRes;
      setPreview(indexJson);
      updateStep(4, "success");

      updateStep(5, "in-progress");
      const safeName = escapeHtml(config.repo_name);
      const safeDesc = escapeHtml(config.repo_description);
      const safeOwner = escapeHtml(owner);
      const safeRepo = escapeHtml(repo);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>F-Droid Repository</title></head><body>
<h1>${safeName}</h1>
<p>${safeDesc}</p>
<p>Add this repository to F-Droid: <code>https://${safeOwner}.github.io/${safeRepo}/fdroid/repo</code></p>
</body></html>`;
      await upsertFile(
        owner, repo, branch,
        "fdroid/index.html",
        textToBase64(html),
        token,
        "Update F-Droid landing page"
      );
      updateStep(5, "success");

      setDeploySuccess(true);
      saveHistory({
        timestamp: new Date().toISOString(),
        status: "success",
        message: `Deployed ${apps.length} app(s)`,
        repoUrl,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Deploy failed.";
      setDeployError(msg);
      setSteps((prev) =>
        prev.map((s) => (s.status === "in-progress" ? { ...s, status: "error", message: msg } : s))
      );
      saveHistory({ timestamp: new Date().toISOString(), status: "error", message: msg, repoUrl });
    } finally {
      setDeploying(false);
    }
  }

  const completedSteps = steps.filter((s) => s.status === "success").length;
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  return (
    <SpaceBetween size="l">
      {!loading && apps.length === 0 && (
        <Alert type="warning">
          You have no apps added yet. Go to the Apps page to add apps before deploying.
        </Alert>
      )}

      <ColumnLayout columns={2} minColumnWidth={300}>
        <Container
          header={
            <Header
              variant="h2"
              description="Push your F-Droid repository index to GitHub."
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={handleTestConnection} loading={testingConn}>
                    Test connection
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleDeploy}
                    loading={deploying}
                    disabled={loading || apps.length === 0}
                    iconName="upload"
                  >
                    Deploy to GitHub
                  </Button>
                </SpaceBetween>
              }
            >
              Deploy
            </Header>
          }
        >
          <SpaceBetween size="m">
            <Box>
              <Box variant="awsui-key-label">Target repository</Box>
              <Box variant="code">
                {config.github_owner}/{config.github_repo} ({config.github_branch})
              </Box>
            </Box>
            <Box>
              <Box variant="awsui-key-label">F-Droid repo URL</Box>
              <SpaceBetween direction="horizontal" size="xs">
                <Box variant="code">{repoUrl}</Box>
                <CopyToClipboard
                  copyButtonText="Copy"
                  copySuccessText="Copied"
                  copyErrorText="Failed"
                  textToCopy={repoUrl}
                />
              </SpaceBetween>
            </Box>
            <Box>
              <Box variant="awsui-key-label">Apps in repo</Box>
              <Box>{apps.length}</Box>
            </Box>
            {connTest && (
              <Box>
                <Box variant="awsui-key-label">Connection test</Box>
                {connTest.status === "pending" ? (
                  <Spinner />
                ) : connTest.status === "success" ? (
                  <StatusIndicator type="success">{connTest.message}</StatusIndicator>
                ) : (
                  <StatusIndicator type="error">{connTest.message}</StatusIndicator>
                )}
              </Box>
            )}
          </SpaceBetween>
        </Container>

        <Container
          header={
            <Header
              variant="h2"
              description="Scan with your phone's camera to add this repo in F-Droid."
            >
              QR Code
            </Header>
          }
        >
          <Box textAlign="center" padding="l">
            <div style={{ display: "inline-block", padding: 16, borderRadius: 16, background: "#ffffff" }}>
              <QRCodeSVG value={repoUrl} size={200} level="M" includeMargin={false} />
            </div>
            <Box variant="p" color="text-body-secondary" padding={{ top: "s" }}>
              Point your phone camera at this code, then tap the link to open it in F-Droid.
            </Box>
          </Box>
        </Container>
      </ColumnLayout>

      {deployError && (
        <Alert type="error" dismissible onDismiss={() => setDeployError(null)}>
          {deployError}
        </Alert>
      )}

      {deploySuccess && (
        <Alert
          type="success"
          dismissible
          onDismiss={() => setDeploySuccess(false)}
          header="Deployment successful!"
        >
          Your F-Droid repository has been published. It may take a few minutes for GitHub Pages to update.
          Add this URL to F-Droid: <strong>{repoUrl}</strong>
        </Alert>
      )}

      {steps.length > 0 && (
        <Container header={<Header variant="h2">Deployment progress</Header>}>
          <SpaceBetween size="m">
            <ProgressBar
              value={progress}
              label="Overall progress"
              status={deployError ? "error" : deploySuccess ? "success" : "in-progress"}
            />
            <SpaceBetween size="s">
              {steps.map((step, i) => (
                <Box key={i}>
                  <SpaceBetween direction="horizontal" size="s">
                    {step.status === "pending" && (
                      <StatusIndicator type="pending">{step.label}</StatusIndicator>
                    )}
                    {step.status === "in-progress" && (
                      <StatusIndicator type="in-progress">{step.label}</StatusIndicator>
                    )}
                    {step.status === "success" && (
                      <StatusIndicator type="success">{step.label}</StatusIndicator>
                    )}
                    {step.status === "error" && (
                      <StatusIndicator type="error">
                        {step.label}{step.message ? ` — ${step.message}` : ""}
                      </StatusIndicator>
                    )}
                  </SpaceBetween>
                </Box>
              ))}
            </SpaceBetween>
          </SpaceBetween>
        </Container>
      )}

      {history.length > 0 && (
        <Container header={<Header variant="h2" description="Recent deployment attempts.">Deployment history</Header>}>
          <SpaceBetween size="s">
            {history.map((entry, i) => (
              <Box key={i}>
                <SpaceBetween direction="horizontal" size="s">
                  <StatusIndicator type={entry.status === "success" ? "success" : "error"}>
                    {entry.message}
                  </StatusIndicator>
                  <Box variant="code" fontSize="body-s">
                    {new Date(entry.timestamp).toLocaleString()}
                  </Box>
                </SpaceBetween>
              </Box>
            ))}
          </SpaceBetween>
        </Container>
      )}

      {preview && (
        <Container
          header={
            <Header
              variant="h2"
              description="The F-Droid index JSON that will be uploaded to GitHub."
              actions={
                <CopyToClipboard
                  copyButtonText="Copy JSON"
                  copySuccessText="Copied"
                  copyErrorText="Failed"
                  textToCopy={preview}
                />
              }
            >
              Index Preview
            </Header>
          }
        >
          <ExpandableSection headerText="Show index-v1.json" defaultExpanded={false}>
            <Box>
              <pre style={{ overflow: "auto", maxHeight: 400, fontSize: 12, margin: 0 }}>
                {preview}
              </pre>
            </Box>
          </ExpandableSection>
        </Container>
      )}
    </SpaceBetween>
  );
}
