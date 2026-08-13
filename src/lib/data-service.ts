import { supabase } from "../integrations/supabase/client";
import { type Config } from "./config";

export interface HealthData {
  id: string;
  spreadsheet_id: string;
  cep: string | null;
  rua: string | null;
  bairro: string | null;
  longitude: number;
  latitude: number;
  data: string;
  evento: string | null;
}

export async function fetchSpreadsheetConfigs() {
  const { data, error } = await supabase
    .from("spreadsheet_configs")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function saveSpreadsheetConfig(config: Partial<any>) {
  const { data, error } = await supabase
    .from("spreadsheet_configs")
    .upsert(config)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteSpreadsheetConfig(id: string) {
  const { error } = await supabase
    .from("spreadsheet_configs")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
}

export async function fetchEventsFromDb(spreadsheetId?: string, startDate?: string, endDate?: string, mapOnly: boolean = false): Promise<HealthData[]> {
  let query = supabase
    .from("health_events")
    .select("*");
  
  if (mapOnly) {
    query = query.or("latitude.neq.0,longitude.neq.0");
  }
  
  if (spreadsheetId) {
    query = query.eq("spreadsheet_id", spreadsheetId);
  }
  
  if (startDate) {
    query = query.gte("event_date", startDate);
  }
  
  if (endDate) {
    query = query.lte("event_date", endDate);
  }
  
  const { data, error } = await query.order("event_date", { ascending: false });
  
  if (error) throw error;
  
  return data.map((item: any) => ({
    id: item.id,
    spreadsheet_id: item.spreadsheet_id,
    cep: item.cep,
    rua: item.rua,
    bairro: item.bairro,
    longitude: item.longitude,
    latitude: item.latitude,
    data: item.event_date,
    evento: item.event_type
  }));
}

export async function triggerManualSync(configId?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || (import.meta as any).env['VITE_SUPABASE_PUBLISHABLE_KEY'];

  // 1. Enqueue
  const enqueueResponse = await fetch('/api/public/hooks/sync-spreadsheets?mode=enqueue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  const enqueueResult = await enqueueResponse.json();

  // 2. Process in batches
  let totalProcessed = 0;
  let totalImported = 0;

  for (let i = 0; i < 50; i++) {
    const response = await fetch('/api/public/hooks/sync-spreadsheets?mode=process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const last = await response.json();
    totalProcessed += (last?.processed ?? 0);
    totalImported += (last?.imported ?? 0);

    if (last?.finished || !last?.processed) break;
  }

  return { success: true, totalProcessed, totalImported };
}

export async function fetchActiveJobs() {
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*, spreadsheet_configs(name)")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function fetchJobHistory() {
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*, spreadsheet_configs(name)")
    .order("created_at", { ascending: false })
    .limit(10);
  
  if (error) throw error;
  return data;
}

export async function fetchSavedPanels() {
  const { data, error } = await supabase
    .from("saved_panels")
    .select("*, spreadsheet_configs(name)")
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function fetchSavedPanelById(id: string) {
  const { data, error } = await supabase
    .from("saved_panels")
    .select("*, spreadsheet_configs(name)")
    .eq("id", id)
    .single();
  
  if (error) throw error;
  return data;
}

export async function savePanel(panel: any) {
  const { data, error } = await supabase
    .from("saved_panels")
    .upsert(panel)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deletePanel(id: string) {
  const { error } = await supabase
    .from("saved_panels")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
}



