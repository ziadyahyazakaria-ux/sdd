import { useState, useEffect } from "react";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Spinner from "@cloudscape-design/components/spinner";
import Alert from "@cloudscape-design/components/alert";
import Link from "@cloudscape-design/components/link";
import { getConfig, getApps } from "../lib/db";
import type { FdroidConfig, FdroidApp } from "../lib/types";

interface Props {
  config: FdroidConfig | null;
  onNavigate: (page: string) => void;
}

export default function DashboardPage({ config: initialConfig, onNavigate }: Props) {
  const [config, setConfig] = useState<FdroidConfig | null>(initialConfig);
  const [apps, setApps] = useState<FdroidApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const cfg = await getConfig();
        setConfig(cfg);
        if (cfg) {
          const appData = await getApps(cfg.id);
          setApps(appData);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    if (!config) load();
    else {
      getApps(config.id)
        .then(setApps)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, []);

  if (loading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error) {
    return <Alert type="error">{error}</Alert>;
  }

  const totalApps = apps.length;
  const missingApk = apps.filter((a) => !a.apk_url).length;
  const missingIcon = apps.filter((a) => !a.icon_url).length;
  const uniqueLicenses = new Set(apps.map((a) => a.license)).size;
  const latestApp = apps.length > 0
    ? apps.reduce((latest, a) => new Date(a.updated_at) > new Date(latest.updated_at) ? a : latest)
    : null;
  const repoUrl = config
    ? `https://${config.github_owner}.github.io/${config.github_repo}/fdroid/repo`
    : "";

  const stats = [
    { label: "Total applications", value: String(totalApps), status: totalApps > 0 ? "success" : "pending" },
    { label: "Repository configured", value: config ? "Yes" : "No", status: config ? "success" : "pending" },
    { label: "Missing APK URLs", value: String(missingApk), status: missingApk === 0 ? "success" : "error" },
    { label: "Missing icons", value: String(missingIcon), status: missingIcon === 0 ? "success" : "pending" },
    { label: "Unique licenses", value: String(uniqueLicenses), status: "success" },
    { label: "Validation issues", value: String(missingApk + missingIcon), status: missingApk + missingIcon === 0 ? "success" : "error" },
  ];

  return (
    <SpaceBetween size="l">
      <Header variant="h1" description="Overview of your F-Droid repository builder.">
        Dashboard
      </Header>

      <ColumnLayout columns={3} minColumnWidth={200}>
        {stats.map((stat) => (
          <Container key={stat.label}>
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">{stat.label}</Box>
              <Box fontSize="display-m" fontWeight="bold">
                {stat.value}
              </Box>
              <StatusIndicator type={stat.status as "success" | "error" | "pending"}>
                {stat.status === "success" ? "OK" : stat.status === "error" ? "Needs attention" : "Pending"}
              </StatusIndicator>
            </SpaceBetween>
          </Container>
        ))}
      </ColumnLayout>

      <ColumnLayout columns={2} minColumnWidth={300}>
        <Container
          header={
            <Header variant="h2" description="Your repository configuration status.">
              Repository Status
            </Header>
          }
        >
          {config ? (
            <SpaceBetween size="m">
              <Box>
                <Box variant="awsui-key-label">Repository name</Box>
                <Box>{config.repo_name}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">GitHub target</Box>
                <Box variant="code">
                  {config.github_owner}/{config.github_repo} ({config.github_branch})
                </Box>
              </Box>
              {repoUrl && (
                <Box>
                  <Box variant="awsui-key-label">Repository URL</Box>
                  <Box variant="code">{repoUrl}</Box>
                </Box>
              )}
              <Box>
                <Box variant="awsui-key-label">Target SDK</Box>
                <Box>{config.target_sdk ?? 34}</Box>
              </Box>
              <StatusIndicator type="success">Configured and ready</StatusIndicator>
            </SpaceBetween>
          ) : (
            <SpaceBetween size="m">
              <StatusIndicator type="pending">Not configured yet</StatusIndicator>
              <Button variant="primary" onClick={() => onNavigate("setup")}>
                Set up repository
              </Button>
            </SpaceBetween>
          )}
        </Container>

        <Container
          header={
            <Header variant="h2" description="Most recently updated application.">
              Recent Activity
            </Header>
          }
        >
          {latestApp ? (
            <SpaceBetween size="m">
              <Box>
                <Box variant="awsui-key-label">Latest updated app</Box>
                <Box fontWeight="bold">{latestApp.name}</Box>
                <Box variant="code">{latestApp.package_name}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">Version</Box>
                <Box>{latestApp.version_name} (v{latestApp.version_code})</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">Last updated</Box>
                <Box>{new Date(latestApp.updated_at).toLocaleDateString()}</Box>
              </Box>
              <Link onFollow={() => onNavigate("apps")}>View all apps</Link>
            </SpaceBetween>
          ) : (
            <SpaceBetween size="m">
              <StatusIndicator type="pending">No apps yet</StatusIndicator>
              <Button variant="primary" onClick={() => onNavigate("apps")}>
                Add your first app
              </Button>
            </SpaceBetween>
          )}
        </Container>
      </ColumnLayout>

      <Container
        header={<Header variant="h2" description="Common actions.">Quick Actions</Header>}
      >
        <SpaceBetween direction="horizontal" size="m">
          <Button onClick={() => onNavigate("setup")}>Repository Setup</Button>
          <Button onClick={() => onNavigate("apps")} disabled={!config}>Manage Apps</Button>
          <Button onClick={() => onNavigate("deploy")} disabled={!config}>Deploy</Button>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}
