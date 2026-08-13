import { supabase } from "@/integrations/supabase/client";
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
  
  return data.map(item => ({
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
  const token = session?.access_token || (import.meta.env as any)['VITE_SUPABASE_PUBLISHABLE_KEY'];

  // The sync runs in time-boxed batches; keep calling until nothing is pending.
  let last: any = null;
  let totalAdded = 0;

  for (let i = 0; i < 20; i++) {
    const response = await fetch('/api/public/hooks/sync-spreadsheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    last = await response.json();
    totalAdded += (last?.results ?? []).reduce((sum: number, r: any) => sum + (r.added ?? 0), 0);

    if (!last?.pending) break;
  }

  return { ...last, totalAdded };
}

