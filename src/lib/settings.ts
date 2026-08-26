import { supabase } from "@/integrations/supabase/client";

export type GeocodingProvider = "osm" | "google";
export type MapProvider = "leaflet" | "google";

export interface AppSettings {
  id: string;
  geocoding_provider: GeocodingProvider;
  map_provider: MapProvider;
  google_maps_api_key: string | null;
  google_geocoding_api_key: string | null;
  updated_at?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: "default",
  geocoding_provider: "osm",
  map_provider: "leaflet",
  google_maps_api_key: null,
  google_geocoding_api_key: null,
};

let cache: AppSettings | null = null;

export async function fetchAppSettings(force = false): Promise<AppSettings> {
  if (cache && !force) return cache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();

  if (error) throw error;
  cache = (data as AppSettings | null) ?? DEFAULT_SETTINGS;
  return cache;
}

export async function saveAppSettings(values: Partial<AppSettings>): Promise<AppSettings> {
  const payload = {
    id: "default",
    geocoding_provider: values.geocoding_provider ?? DEFAULT_SETTINGS.geocoding_provider,
    map_provider: values.map_provider ?? DEFAULT_SETTINGS.map_provider,
    google_maps_api_key: values.google_maps_api_key?.trim() || null,
    google_geocoding_api_key: values.google_geocoding_api_key?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("app_settings")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  cache = data as AppSettings;
  return cache;
}

export function invalidateSettingsCache() {
  cache = null;
}
