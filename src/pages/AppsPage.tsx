import { useState, useEffect, useCallback } from "react";
import Table from "@cloudscape-design/components/table";
import Header from "@cloudscape-design/components/header";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Alert from "@cloudscape-design/components/alert";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Badge from "@cloudscape-design/components/badge";
import Spinner from "@cloudscape-design/components/spinner";
import Multiselect from "@cloudscape-design/components/multiselect";
import Select from "@cloudscape-design/components/select";
import TextFilter from "@cloudscape-design/components/text-filter";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { getApps, upsertApp, deleteApp, bulkInsertApps } from "../lib/db";
import { getLatestRelease, parseVersionFromTag, findApkAsset, type GitHubRelease } from "../lib/githubReleases";
import { isValidUrl, isValidPackageName, isValidVersionCode, isValidSdk, validateAppUrls } from "../lib/validation";
import type { FdroidApp } from "../lib/types";

interface Props {
  configId: string;
}

const EMPTY_APP: Omit<FdroidApp, "id" | "config_id" | "user_id" | "created_at" | "updated_at"> = {
  package_name: "",
  name: "",
  summary: "",
  description: "",
  icon_url: "",
  apk_url: "",
  version_name: "1.0.0",
  version_code: 1,
  min_sdk: 21,
  categories: [],
  license: "Unknown",
  source_url: "",
  changelog: "",
  author_name: "",
  website_url: "",
  issue_tracker_url: "",
  changelog_url: "",
  donate_url: "",
  feature_graphic_url: "",
  anti_features: [],
  screenshots: [],
};

const ANTI_FEATURE_OPTIONS = [
  { label: "Ads", value: "Ads" },
  { label: "Tracking", value: "Tracking" },
  { label: "NonFreeNet", value: "NonFreeNet" },
  { label: "NonFreeAdd", value: "NonFreeAdd" },
  { label: "NonFreeAssets", value: "NonFreeAssets" },
  { label: "NonFreeDep", value: "NonFreeDep" },
  { label: "UpstreamNonFree", value: "UpstreamNonFree" },
  { label: "KnownVuln", value: "KnownVuln" },
  { label: "NoSourceSince", value: "NoSourceSince" },
  { label: "DisabledAlgorithm", value: "DisabledAlgorithm" },
];

const CATEGORY_OPTIONS = [
  { label: "System", value: "System" },
  { label: "Internet", value: "Internet" },
  { label: "Development", value: "Development" },
  { label: "Graphics", value: "Graphics" },
  { label: "Multimedia", value: "Multimedia" },
  { label: "Games", value: "Games" },
  { label: "Navigation", value: "Navigation" },
  { label: "Science & Education", value: "Science & Education" },
  { label: "Security", value: "Security" },
  { label: "Phone & SMS", value: "Phone & SMS" },
  { label: "Reading", value: "Reading" },
  { label: "Utility", value: "Utility" },
  { label: "Writing", value: "Writing" },
  { label: "Money", value: "Money" },
  { label: "Sports & Health", value: "Sports & Health" },
];

export default function AppsPage({ configId }: Props) {
  const [apps, setApps] = useState<FdroidApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Partial<FdroidApp>>(EMPTY_APP);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const [ghReleaseModalOpen, setGhReleaseModalOpen] = useState(false);
  const [ghOwner, setGhOwner] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghRelease, setGhRelease] = useState<GitHubRelease | null>(null);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);

  const { items, actions, collectionProps, filterProps, paginationProps } = useCollection(apps, {
    filtering: {
      empty: (
        <Box textAlign="center" color="inherit">
          <Box variant="strong" textAlign="center" color="inherit">
            No apps found
          </Box>
          <Box variant="p" padding={{ bottom: "s" }} color="inherit">
            Try adjusting your search or add a new app.
          </Box>
          <Button onClick={openAdd}>Add app</Button>
        </Box>
      ),
    },
    pagination: { pageSize: 10 },
    sorting: {},
    selection: {},
  });

  const [selectedItems, setSelectedItems] = useState<FdroidApp[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApps(configId);
      setApps(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load apps.");
    } finally {
      setLoading(false);
    }
  }, [configId]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditingApp({ ...EMPTY_APP, config_id: configId });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(app: FdroidApp) {
    setEditingApp({ ...app });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    const errs: string[] = [];
    if (!editingApp.package_name?.trim() || !editingApp.name?.trim() || !editingApp.apk_url?.trim()) {
      errs.push("Package name, app name, and APK URL are required.");
    }
    if (editingApp.package_name && !isValidPackageName(editingApp.package_name)) {
      errs.push("Package name must be a valid Android package name (e.g. com.example.app).");
    }
    if (editingApp.version_code && !isValidVersionCode(editingApp.version_code)) {
      errs.push("Version code must be a positive integer.");
    }
    if (editingApp.min_sdk && !isValidSdk(editingApp.min_sdk)) {
      errs.push("Min SDK must be between 1 and 99.");
    }
    const urlErrors = validateAppUrls({
      apk_url: editingApp.apk_url ?? "",
      icon_url: editingApp.icon_url ?? "",
      source_url: editingApp.source_url ?? "",
      website_url: editingApp.website_url ?? "",
      issue_tracker_url: editingApp.issue_tracker_url ?? "",
      changelog_url: editingApp.changelog_url ?? "",
      donate_url: editingApp.donate_url ?? "",
      feature_graphic_url: editingApp.feature_graphic_url ?? "",
      screenshots: editingApp.screenshots ?? [],
    });
    errs.push(...urlErrors);

    const dup = apps.find(
      (a) =>
        a.package_name === editingApp.package_name?.trim() &&
        a.id !== editingApp.id
    );
    if (dup) {
      errs.push(`An app with package name "${editingApp.package_name}" already exists.`);
    }

    if (errs.length > 0) {
      setFormError(errs.join(" "));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await upsertApp({
        ...editingApp,
        config_id: configId,
        screenshots: (editingApp.screenshots ?? []).filter(Boolean),
      } as FdroidApp & { config_id: string });
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to save app.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await Promise.all(selectedItems.map((a) => deleteApp(a.id)));
      setSelectedItems([]);
      setDeleteModalOpen(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete app.");
    } finally {
      setDeleting(false);
    }
  }

  function handleExport() {
    const json = JSON.stringify(apps, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fdroid-apps-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    try {
      const parsed = JSON.parse(importText) as Array<Partial<FdroidApp>>;
      if (!Array.isArray(parsed)) throw new Error("Import data must be a JSON array of apps.");
      const toInsert = parsed.map((a) => ({
        ...EMPTY_APP,
        ...a,
        id: undefined,
        config_id: configId,
        screenshots: (a.screenshots ?? []).filter(Boolean),
      })) as Array<Partial<FdroidApp> & { config_id: string }>;
      const dups = toInsert.filter(
        (a, i) => a.package_name && toImport.findIndex((b) => b.package_name === a.package_name) !== i
      );
      if (dups.length > 0) {
        throw new Error(`Duplicate package names in import data: ${dups.map((d) => d.package_name).join(", ")}`);
      }
      const existingDups = toInsert.filter(
        (a) => apps.some((existing) => existing.package_name === a.package_name)
      );
      if (existingDups.length > 0) {
        throw new Error(`Package names already exist: ${existingDups.map((d) => d.package_name).join(", ")}`);
      }
      await bulkInsertApps(toInsert);
      setImportModalOpen(false);
      setImportText("");
      await load();
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Failed to import apps.");
    } finally {
      setImporting(false);
    }
  }

  async function handleFetchRelease() {
    setGhLoading(true);
    setGhError(null);
    try {
      const release = await getLatestRelease(ghOwner.trim(), ghRepo.trim());
      if (!release) {
        setGhError("No releases found for this repository.");
        return;
      }
      setGhRelease(release);
    } catch (e: unknown) {
      setGhError(e instanceof Error ? e.message : "Failed to fetch release.");
    } finally {
      setGhLoading(false);
    }
  }

  function handleImportFromRelease() {
    if (!ghRelease) return;
    const apk = findApkAsset(ghRelease.assets);
    if (!apk) {
      setGhError("No APK asset found in the latest release.");
      return;
    }
    const ver = parseVersionFromTag(ghRelease.tag_name);
    setEditingApp({
      ...EMPTY_APP,
      config_id: configId,
      name: ghRelease.name || ghRelease.tag_name,
      apk_url: apk.browser_download_url,
      version_name: ver.name,
      version_code: ver.code,
      source_url: `https://github.com/${ghOwner.trim()}/${ghRepo.trim()}`,
      changelog: ghRelease.body || "",
      issue_tracker_url: `https://github.com/${ghOwner.trim()}/${ghRepo.trim()}/issues`,
      changelog_url: ghRelease.html_url,
    });
    setGhReleaseModalOpen(false);
    setGhRelease(null);
    setGhOwner("");
    setGhRepo("");
    setFormError(null);
    setModalOpen(true);
  }

  return (
    <>
      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Table
        {...collectionProps}
        loading={loading}
        loadingText="Loading apps..."
        items={items}
        selectedItems={selectedItems}
        onSelectionChange={(e) => {
          setSelectedItems(e.detail.selectedItems);
          actions.setSelectedItems(e);
        }}
        selectionType="multi"
        trackBy="id"
        filter={
          <TextFilter
            {...filterProps}
            filteringPlaceholder="Search apps by name, package, or license..."
          />
        }
        pagination={
          <Box padding={{ top: "s" }}>
            <Box>
              {/* paginationProps renders Cloudscape pagination */}
            </Box>
          </Box>
        }
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={{ pageSize: 10, visibleContent: ["name", "package_name", "version", "license", "icon", "status"] }}
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 10, label: "10 apps" },
                { value: 20, label: "20 apps" },
                { value: 50, label: "50 apps" },
              ],
            }}
          />
        }
        header={
          <Header
            variant="h2"
            counter={`(${apps.length})`}
            description="Apps included in your F-Droid repository."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setGhReleaseModalOpen(true)} iconName="download">
                  Import from GitHub
                </Button>
                <Button onClick={handleExport} disabled={apps.length === 0}>
                  Export
                </Button>
                <Button onClick={() => setImportModalOpen(true)}>Import JSON</Button>
                <Button
                  disabled={selectedItems.length === 0}
                  onClick={() => setDeleteModalOpen(true)}
                >
                  Delete
                </Button>
                <Button
                  disabled={selectedItems.length !== 1}
                  onClick={() => selectedItems[0] && openEdit(selectedItems[0])}
                >
                  Edit
                </Button>
                <Button variant="primary" onClick={openAdd} iconName="add-plus">
                  Add app
                </Button>
              </SpaceBetween>
            }
          >
            Apps
          </Header>
        }
        columnDefinitions={[
          {
            id: "icon",
            header: "Icon",
            cell: (item) =>
              item.icon_url ? (
                <img
                  src={item.icon_url}
                  alt={item.name}
                  style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }}
                />
              ) : (
                <Box variant="code" fontSize="body-s">--</Box>
              ),
            sortingField: "name",
          },
          {
            id: "name",
            header: "App name",
            cell: (item) => (
              <Box fontWeight="bold">
                {item.icon_url && (
                  <img
                    src={item.icon_url}
                    alt=""
                    style={{ width: 20, height: 20, borderRadius: 4, marginRight: 6, verticalAlign: "middle" }}
                  />
                )}
                {item.name}
              </Box>
            ),
            sortingField: "name",
          },
          {
            id: "package_name",
            header: "Package name",
            cell: (item) => <Box variant="code">{item.package_name}</Box>,
            sortingField: "package_name",
          },
          {
            id: "version",
            header: "Version",
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <span>{item.version_name}</span>
                <Badge color="grey">v{item.version_code}</Badge>
              </SpaceBetween>
            ),
            sortingField: "version_code",
          },
          {
            id: "license",
            header: "License",
            cell: (item) => item.license,
            sortingField: "license",
          },
          {
            id: "categories",
            header: "Categories",
            cell: (item) =>
              item.categories.length > 0 ? (
                <SpaceBetween direction="horizontal" size="xxs">
                  {item.categories.slice(0, 3).map((c) => (
                    <Badge key={c} color="blue">{c}</Badge>
                  ))}
                </SpaceBetween>
              ) : (
                <Box variant="code">--</Box>
              ),
          },
          {
            id: "status",
            header: "APK",
            cell: (item) =>
              item.apk_url ? (
                <StatusIndicator type="success">Configured</StatusIndicator>
              ) : (
                <StatusIndicator type="error">Missing</StatusIndicator>
              ),
          },
        ]}
        visibleColumns={["icon", "name", "package_name", "version", "license", "categories", "status"]}
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={modalOpen}
        onDismiss={() => setModalOpen(false)}
        header={editingApp.id ? "Edit App" : "Add App"}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingApp.id ? "Save changes" : "Add app"}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Form errorText={formError ?? undefined}>
          <SpaceBetween size="m">
            <FormField
              label="Package name"
              description="The Android package identifier (e.g. com.example.myapp)."
              constraintText="Required — must be unique"
            >
              <Input
                value={editingApp.package_name ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, package_name: e.detail.value }))
                }
                placeholder="com.example.myapp"
              />
            </FormField>
            <FormField label="App name" constraintText="Required">
              <Input
                value={editingApp.name ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, name: e.detail.value }))
                }
                placeholder="My Application"
              />
            </FormField>
            <FormField label="Short description (summary)">
              <Input
                value={editingApp.summary ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, summary: e.detail.value }))
                }
                placeholder="A great app"
              />
            </FormField>
            <FormField label="Full description">
              <Textarea
                value={editingApp.description ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, description: e.detail.value }))
                }
                rows={4}
                placeholder="Describe what your app does..."
              />
            </FormField>
            <FormField
              label="APK download URL"
              description="Direct link to download the APK file (GitHub Releases link recommended)."
              constraintText="Required"
            >
              <Input
                value={editingApp.apk_url ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, apk_url: e.detail.value }))
                }
                placeholder="https://github.com/owner/repo/releases/download/v1.0.0/app.apk"
              />
            </FormField>
            <FormField label="Icon URL" description="URL to the app icon PNG file.">
              <Input
                value={editingApp.icon_url ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, icon_url: e.detail.value }))
                }
                placeholder="https://example.com/icon.png"
              />
              {editingApp.icon_url && isValidUrl(editingApp.icon_url) && (
                <Box padding={{ top: "s" }}>
                  <img
                    src={editingApp.icon_url}
                    alt="Icon preview"
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }}
                  />
                </Box>
              )}
            </FormField>
            <SpaceBetween size="m" direction="horizontal">
              <FormField label="Version name">
                <Input
                  value={editingApp.version_name ?? ""}
                  onChange={(e) =>
                    setEditingApp((p) => ({ ...p, version_name: e.detail.value }))
                  }
                  placeholder="1.0.0"
                />
              </FormField>
              <FormField label="Version code">
                <Input
                  value={String(editingApp.version_code ?? 1)}
                  onChange={(e) =>
                    setEditingApp((p) => ({
                      ...p,
                      version_code: parseInt(e.detail.value) || 1,
                    }))
                  }
                  type="number"
                  inputMode="numeric"
                  placeholder="1"
                />
              </FormField>
              <FormField
                label="Min Android SDK"
                description="Minimum API level (21 = Android 5.0)"
              >
                <Input
                  value={String(editingApp.min_sdk ?? 21)}
                  onChange={(e) =>
                    setEditingApp((p) => ({
                      ...p,
                      min_sdk: parseInt(e.detail.value) || 21,
                    }))
                  }
                  type="number"
                  inputMode="numeric"
                  placeholder="21"
                />
              </FormField>
            </SpaceBetween>
            <FormField label="Categories">
              <Multiselect
                selectedOptions={(editingApp.categories ?? []).map((c) => ({ label: c, value: c }))}
                onChange={(e) =>
                  setEditingApp((p) => ({
                    ...p,
                    categories: e.detail.selectedOptions.map((o) => o.value ?? ""),
                  }))
                }
                options={CATEGORY_OPTIONS}
                placeholder="Choose categories"
                filteringType="auto"
              />
            </FormField>
            <FormField
              label="License"
              description="SPDX license identifier (e.g. MIT, Apache-2.0, GPL-3.0-only)."
            >
              <Input
                value={editingApp.license ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, license: e.detail.value }))
                }
                placeholder="Apache-2.0"
              />
            </FormField>
            <FormField label="Source code URL">
              <Input
                value={editingApp.source_url ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, source_url: e.detail.value }))
                }
                placeholder="https://github.com/owner/repo"
              />
            </FormField>
            <FormField label="Author / developer name">
              <Input
                value={editingApp.author_name ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, author_name: e.detail.value }))
                }
                placeholder="Jane Doe"
              />
            </FormField>
            <FormField label="Website URL">
              <Input
                value={editingApp.website_url ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, website_url: e.detail.value }))
                }
                placeholder="https://example.com"
              />
            </FormField>
            <FormField label="Issue tracker URL" description="Where users report bugs.">
              <Input
                value={editingApp.issue_tracker_url ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, issue_tracker_url: e.detail.value }))
                }
                placeholder="https://github.com/owner/repo/issues"
              />
            </FormField>
            <FormField label="Donation URL">
              <Input
                value={editingApp.donate_url ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, donate_url: e.detail.value }))
                }
                placeholder="https://example.com/donate"
              />
            </FormField>
            <FormField label="Anti-features" description="Select any that apply to this app.">
              <Multiselect
                selectedOptions={(editingApp.anti_features ?? []).map((f) => ({
                  label: f,
                  value: f,
                }))}
                onChange={(e) =>
                  setEditingApp((p) => ({
                    ...p,
                    anti_features: e.detail.selectedOptions.map((o) => o.value ?? ""),
                  }))
                }
                options={ANTI_FEATURE_OPTIONS}
                placeholder="Choose anti-features"
                filteringType="auto"
              />
            </FormField>
            <FormField label="Changelog URL" description="Link to a full changelog page.">
              <Input
                value={editingApp.changelog_url ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, changelog_url: e.detail.value }))
                }
                placeholder="https://github.com/owner/repo/releases"
              />
            </FormField>
            <FormField label="Feature graphic URL" description="Wide banner image (PNG or JPG).">
              <Input
                value={editingApp.feature_graphic_url ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, feature_graphic_url: e.detail.value }))
                }
                placeholder="https://example.com/banner.png"
              />
            </FormField>
            <FormField label="Screenshot URLs" description="One image URL per line.">
              <Textarea
                value={(editingApp.screenshots ?? []).join("\n")}
                onChange={(e) =>
                  setEditingApp((p) => ({
                    ...p,
                    screenshots: e.detail.value.split("\n").map((s) => s.trim()),
                  }))
                }
                rows={3}
                placeholder="https://example.com/screen1.png"
              />
            </FormField>
            <FormField label="What's new (changelog)">
              <Textarea
                value={editingApp.changelog ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, changelog: e.detail.value }))
                }
                rows={3}
                placeholder="Changes in this version..."
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalOpen}
        onDismiss={() => setDeleteModalOpen(false)}
        header={`Delete ${selectedItems.length} app${selectedItems.length !== 1 ? "s" : ""}?`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDelete} loading={deleting}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {deleting ? (
          <Spinner />
        ) : (
          <Box>
            Are you sure you want to delete{" "}
            <strong>{selectedItems.map((a) => a.name).join(", ")}</strong>? This cannot be undone.
          </Box>
        )}
      </Modal>

      {/* Import JSON Modal */}
      <Modal
        visible={importModalOpen}
        onDismiss={() => setImportModalOpen(false)}
        header="Import apps from JSON"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setImportModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleImport} loading={importing}>
                Import
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Form errorText={importError ?? undefined}>
          <FormField
            label="JSON data"
            description="Paste exported app data as a JSON array. Duplicates will be rejected."
          >
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.detail.value)}
              rows={10}
              placeholder='[{"package_name":"com.example.app","name":"My App",...}]'
            />
          </FormField>
        </Form>
      </Modal>

      {/* GitHub Release Import Modal */}
      <Modal
        visible={ghReleaseModalOpen}
        onDismiss={() => { setGhReleaseModalOpen(false); setGhRelease(null); setGhError(null); }}
        header="Import from GitHub Releases"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => { setGhReleaseModalOpen(false); setGhRelease(null); setGhError(null); }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImportFromRelease}
                disabled={!ghRelease}
              >
                Use this release
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Form errorText={ghError ?? undefined}>
          <SpaceBetween size="m">
            <FormField label="GitHub owner" constraintText="Required">
              <Input
                value={ghOwner}
                onChange={(e) => setGhOwner(e.detail.value)}
                placeholder="owner"
              />
            </FormField>
            <FormField label="Repository name" constraintText="Required">
              <Input
                value={ghRepo}
                onChange={(e) => setGhRepo(e.detail.value)}
                placeholder="repo"
              />
            </FormField>
            <Button onClick={handleFetchRelease} loading={ghLoading}>
              Fetch latest release
            </Button>
            {ghRelease && (
              <Box>
                <Box variant="awsui-key-label">Latest release</Box>
                <SpaceBetween size="s">
                  <Box>
                    <strong>{ghRelease.tag_name}</strong> — {ghRelease.name}
                  </Box>
                  {findApkAsset(ghRelease.assets) ? (
                    <StatusIndicator type="success">
                      APK found: {findApkAsset(ghRelease.assets)!.name} (
                      {Math.round(findApkAsset(ghRelease.assets)!.size / 1024)} KB)
                    </StatusIndicator>
                  ) : (
                    <StatusIndicator type="error">No APK asset found</StatusIndicator>
                  )}
                  <Box variant="p" color="text-body-secondary">
                    Published: {new Date(ghRelease.published_at).toLocaleDateString()}
                  </Box>
                </SpaceBetween>
              </Box>
            )}
          </SpaceBetween>
        </Form>
      </Modal>
    </>
  );
}
