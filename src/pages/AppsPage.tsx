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
import { getApps, upsertApp, deleteApp } from "../lib/db";
import type { FdroidApp } from "../lib/types";

interface Props {
  configId: string;
}

const EMPTY_APP: Omit<FdroidApp, "id" | "config_id" | "created_at" | "updated_at"> = {
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

export default function AppsPage({ configId }: Props) {
  const [apps, setApps] = useState<FdroidApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<FdroidApp[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Partial<FdroidApp>>(EMPTY_APP);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    if (!editingApp.package_name?.trim() || !editingApp.name?.trim() || !editingApp.apk_url?.trim()) {
      setFormError("Package name, app name, and APK URL are required.");
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

  return (
    <>
      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Table
        loading={loading}
        loadingText="Loading apps..."
        items={apps}
        selectedItems={selectedItems}
        onSelectionChange={(e) => setSelectedItems(e.detail.selectedItems)}
        selectionType="multi"
        trackBy="id"
        empty={
          <Box textAlign="center" color="inherit">
            <Box variant="strong" textAlign="center" color="inherit">
              No apps added yet
            </Box>
            <Box variant="p" padding={{ bottom: "s" }} color="inherit">
              Add your first app to get started.
            </Box>
            <Button onClick={openAdd}>Add app</Button>
          </Box>
        }
        header={
          <Header
            variant="h2"
            counter={`(${apps.length})`}
            description="Apps included in your F-Droid repository."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
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
            id: "name",
            header: "App name",
            cell: (item) => <Box fontWeight="bold">{item.name}</Box>,
            sortingField: "name",
          },
          {
            id: "package_name",
            header: "Package name",
            cell: (item) => <Box variant="code">{item.package_name}</Box>,
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
          },
          {
            id: "license",
            header: "License",
            cell: (item) => item.license,
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
              constraintText="Required"
            >
              <Input
                value={editingApp.package_name ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, package_name: e.detail.value }))
                }
                placeholder="com.example.myapp"
              />
            </FormField>
            <FormField
              label="App name"
              constraintText="Required"
            >
              <Input
                value={editingApp.name ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, name: e.detail.value }))
                }
                placeholder="My Application"
              />
            </FormField>
            <FormField
              label="Short description (summary)"
            >
              <Input
                value={editingApp.summary ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, summary: e.detail.value }))
                }
                placeholder="A great app"
              />
            </FormField>
            <FormField
              label="Full description"
            >
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
            <FormField
              label="Icon URL"
              description="URL to the app icon PNG file."
            >
              <Input
                value={editingApp.icon_url ?? ""}
                onChange={(e) =>
                  setEditingApp((p) => ({ ...p, icon_url: e.detail.value }))
                }
                placeholder="https://example.com/icon.png"
              />
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
              <Button
                variant="primary"
                onClick={handleDelete}
                loading={deleting}
              >
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
            <strong>
              {selectedItems.map((a) => a.name).join(", ")}
            </strong>
            ? This cannot be undone.
          </Box>
        )}
      </Modal>
    </>
  );
}
