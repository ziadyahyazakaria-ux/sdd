import { useState, useEffect } from "react";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Spinner from "@cloudscape-design/components/spinner";
import Box from "@cloudscape-design/components/box";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { getConfig, upsertConfig } from "../lib/db";
import type { FdroidConfig } from "../lib/types";

interface Props {
  onConfigSaved: (config: FdroidConfig) => void;
}

export default function SetupPage({ onConfigSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [configId, setConfigId] = useState<string | undefined>();

  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("gh-pages");
  const [githubToken, setGithubToken] = useState("");
  const [repoName, setRepoName] = useState("");
  const [repoDescription, setRepoDescription] = useState("");
  const [repoIcon, setRepoIcon] = useState("");

  useEffect(() => {
    getConfig()
      .then((cfg) => {
        if (cfg) {
          setConfigId(cfg.id);
          setGithubOwner(cfg.github_owner);
          setGithubRepo(cfg.github_repo);
          setGithubBranch(cfg.github_branch);
          setRepoName(cfg.repo_name);
          setRepoDescription(cfg.repo_description);
          setRepoIcon(cfg.repo_icon);
          const stored = localStorage.getItem(`gh_token_${cfg.id}`);
          if (stored) setGithubToken(stored);
          onConfigSaved(cfg);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!githubOwner.trim() || !githubRepo.trim() || !repoName.trim()) {
      setError("GitHub owner, repository name, and repo display name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const cfg = await upsertConfig({
        id: configId,
        github_owner: githubOwner.trim(),
        github_repo: githubRepo.trim(),
        github_branch: githubBranch.trim() || "gh-pages",
        repo_name: repoName.trim(),
        repo_description: repoDescription.trim(),
        repo_icon: repoIcon.trim(),
      });
      setConfigId(cfg.id);
      if (githubToken.trim()) {
        localStorage.setItem(`gh_token_${cfg.id}`, githubToken.trim());
      }
      setSuccess(true);
      onConfigSaved(cfg);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h2"
            description="Connect your GitHub repository where the F-Droid repo will be published."
          >
            GitHub Repository Settings
          </Header>
        }
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={handleSave}
                loading={saving}
              >
                Save Settings
              </Button>
            </SpaceBetween>
          }
          errorText={error ?? undefined}
        >
          <SpaceBetween size="l">
            {success && (
              <Alert type="success" dismissible onDismiss={() => setSuccess(false)}>
                Settings saved successfully.
              </Alert>
            )}
            <SpaceBetween size="m">
              <FormField
                label="GitHub Username / Organization"
                description="Your GitHub username or organization name (e.g. myusername)."
                constraintText="Required"
              >
                <Input
                  value={githubOwner}
                  onChange={(e) => setGithubOwner(e.detail.value)}
                  placeholder="myusername"
                />
              </FormField>
              <FormField
                label="GitHub Repository Name"
                description="The name of the GitHub repository to publish to (e.g. fdroid-repo)."
                constraintText="Required"
              >
                <Input
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.detail.value)}
                  placeholder="fdroid-repo"
                />
              </FormField>
              <FormField
                label="Branch"
                description="The branch to publish the F-Droid index to. Use gh-pages for GitHub Pages."
              >
                <Input
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.detail.value)}
                  placeholder="gh-pages"
                />
              </FormField>
              <FormField
                label="Personal Access Token (PAT)"
                description="A GitHub Personal Access Token with repo write permissions. Stored locally in your browser, never sent to our servers."
              >
                <Input
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.detail.value)}
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                />
              </FormField>
            </SpaceBetween>
          </SpaceBetween>
        </Form>
      </Container>

      <Container
        header={
          <Header
            variant="h2"
            description="Public information shown inside your F-Droid repository."
          >
            Repository Information
          </Header>
        }
      >
        <Form
          actions={
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save Settings
            </Button>
          }
          errorText={error ?? undefined}
        >
          <SpaceBetween size="m">
            <FormField
              label="Repository Display Name"
              description="The name shown to users who add this repo to F-Droid."
              constraintText="Required"
            >
              <Input
                value={repoName}
                onChange={(e) => setRepoName(e.detail.value)}
                placeholder="My Private Apps"
              />
            </FormField>
            <FormField
              label="Repository Description"
              description="A short description of what apps are in this repository."
            >
              <Input
                value={repoDescription}
                onChange={(e) => setRepoDescription(e.detail.value)}
                placeholder="Private F-Droid repository for my apps"
              />
            </FormField>
            <FormField
              label="Repository Icon URL"
              description="URL to a PNG icon for this repository (optional)."
            >
              <Input
                value={repoIcon}
                onChange={(e) => setRepoIcon(e.detail.value)}
                placeholder="https://example.com/icon.png"
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </Container>

      {configId && (
        <Container
          header={<Header variant="h2">Repository URL</Header>}
        >
          <SpaceBetween size="s">
            <Box>
              <StatusIndicator type="success">
                Repository configured
              </StatusIndicator>
            </Box>
            <Box variant="p">
              Your F-Droid repository URL will be:
            </Box>
            <Box variant="code">
              {`https://${githubOwner}.github.io/${githubRepo}/fdroid/repo`}
            </Box>
            <Box variant="p" color="text-body-secondary">
              Add this URL in the F-Droid app under Settings → Repositories.
            </Box>
          </SpaceBetween>
        </Container>
      )}
    </SpaceBetween>
  );
}
