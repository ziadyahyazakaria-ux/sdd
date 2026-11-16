import { useState } from "react";
import AppLayout from "@cloudscape-design/components/app-layout";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Box from "@cloudscape-design/components/box";
import Alert from "@cloudscape-design/components/alert";
import Spinner from "@cloudscape-design/components/spinner";
import { AuthProvider, useAuth } from "./lib/auth";
import AuthPage from "./pages/AuthPage";
import SetupPage from "./pages/SetupPage";
import AppsPage from "./pages/AppsPage";
import DeployPage from "./pages/DeployPage";
import DashboardPage from "./pages/DashboardPage";
import type { FdroidConfig } from "./lib/types";

type PageId = "dashboard" | "setup" | "apps" | "deploy";

const NAV_ITEMS = [
  { type: "link" as const, text: "Dashboard", href: "#dashboard" },
  { type: "link" as const, text: "Repository Setup", href: "#setup" },
  { type: "link" as const, text: "Apps", href: "#apps" },
  { type: "link" as const, text: "Deploy", href: "#deploy" },
];

const BREADCRUMB_MAP: Record<PageId, string> = {
  dashboard: "Dashboard",
  setup: "Repository Setup",
  apps: "Apps",
  deploy: "Deploy",
};

const LOGO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 32' fill='none'%3E%3Crect width='40' height='32' rx='6' fill='%231b6ac9'/%3E%3Ctext x='20' y='21' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='14' font-weight='700' fill='white'%3EFDB%3C/text%3E%3C/svg%3E";

function MainApp() {
  const { user, loading, signOut } = useAuth();
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [config, setConfig] = useState<FdroidConfig | null>(null);

  function handleNavClick(href: string) {
    const page = href.replace("#", "") as PageId;
    setActivePage(page);
  }

  if (loading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  function renderPage() {
    if (activePage === "dashboard") {
      return (
        <DashboardPage
          config={config}
          onNavigate={(page) => setActivePage(page as PageId)}
        />
      );
    }
    if (activePage === "setup") {
      return <SetupPage onConfigSaved={(cfg) => setConfig(cfg)} />;
    }
    if (activePage === "apps") {
      if (!config) {
        return (
          <Alert type="warning">
            Please complete the Repository Setup first before managing apps.
          </Alert>
        );
      }
      return <AppsPage configId={config.id} />;
    }
    if (activePage === "deploy") {
      if (!config) {
        return (
          <Alert type="warning">
            Please complete the Repository Setup first before deploying.
          </Alert>
        );
      }
      return <DeployPage config={config} />;
    }
    return null;
  }

  return (
    <>
      <div id="top-nav">
        <TopNavigation
          identity={{
            href: "#dashboard",
            title: "F-Droid Repo Builder",
            logo: { src: LOGO, alt: "FDB" },
          }}
          utilities={[
            {
              type: "menu-dropdown",
              text: user.email ?? "Account",
              iconName: "user-profile",
              onItemClick: (e) => {
                if (e.detail.id === "signout") signOut();
              },
              items: [
                { id: "signout", text: "Sign out", iconName: "undo" },
              ],
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#top-nav"
        breadcrumbs={
          <BreadcrumbGroup
            items={[
              { text: "F-Droid Repo Builder", href: "#" },
              { text: BREADCRUMB_MAP[activePage], href: `#${activePage}` },
            ]}
          />
        }
        navigation={
          <SideNavigation
            header={{ text: "Navigation", href: "#" }}
            activeHref={`#${activePage}`}
            onFollow={(e) => {
              e.preventDefault();
              handleNavClick(e.detail.href);
            }}
            items={NAV_ITEMS}
          />
        }
        content={
          <Box padding="l">{renderPage()}</Box>
        }
        toolsHide
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
