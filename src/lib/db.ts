import { supabase } from "./supabase";
import type { FdroidConfig, FdroidApp } from "./types";

export async function getConfig(): Promise<FdroidConfig | null> {
  const { data, error } = await supabase
    .from("fdroid_config")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertConfig(
  config: Partial<FdroidConfig> & { id?: string }
): Promise<FdroidConfig> {
  if (config.id) {
    const { data, error } = await supabase
      .from("fdroid_config")
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq("id", config.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  } else {
    const { data, error } = await supabase
      .from("fdroid_config")
      .insert(config)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function deleteConfig(id: string): Promise<void> {
  const { error } = await supabase.from("fdroid_config").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getApps(configId: string): Promise<FdroidApp[]> {
  const { data, error } = await supabase
    .from("fdroid_apps")
    .select("*")
    .eq("config_id", configId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertApp(
  app: Partial<FdroidApp> & { config_id: string }
): Promise<FdroidApp> {
  if (app.id) {
    const { data, error } = await supabase
      .from("fdroid_apps")
      .update({ ...app, updated_at: new Date().toISOString() })
      .eq("id", app.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  } else {
    const { data, error } = await supabase
      .from("fdroid_apps")
      .insert(app)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function deleteApp(id: string): Promise<void> {
  const { error } = await supabase.from("fdroid_apps").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function bulkInsertApps(
  apps: Array<Partial<FdroidApp> & { config_id: string }>
): Promise<void> {
  const { error } = await supabase.from("fdroid_apps").insert(apps);
  if (error) throw new Error(error.message);
}
