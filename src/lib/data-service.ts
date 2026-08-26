import { supabase } from "../integrations/supabase/client";
import { type Config } from "./config";

export interface HealthData {
  id: string;
  spreadsheet_id: string;
  numero_notificacao: string | null;
  tipo_notificacao: string | null;
  ano_notificacao: string | null;
  id_unidade: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  gestante: string | null;
  cep: string | null;
  rua: string | null;
  bairro: string | null;
  longitude: number;
  latitude: number;
  location_found: boolean;
  geo_source: string | null;
  geo_provider: string | null;
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
    numero_notificacao: item.numero_notificacao,
    tipo_notificacao: item.tipo_notificacao,
    ano_notificacao: item.ano_notificacao,
    id_unidade: item.id_unidade,
    data_nascimento: item.data_nascimento,
    sexo: item.sexo,
    gestante: item.gestante,
    cep: item.cep,
    rua: item.rua,
    bairro: item.bairro,
    longitude: item.longitude,
    latitude: item.latitude,
    location_found: item.location_found ?? (item.latitude !== 0 && item.longitude !== 0),
    geo_source: item.geo_source ?? null,
    geo_provider: item.geo_provider ?? null,
    data: item.event_date,
    evento: item.event_type
  }));
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || (import.meta as any).env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

async function runSyncPipeline(configId: string | undefined, mode: 'enqueue' | 'reset') {
  const headers = await authHeaders();

  // 1. Enqueue (ou reset + enqueue)
  const enqueueResponse = await fetch(`/api/public/hooks/sync-spreadsheets?mode=${mode}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ configId }),
  });
  if (!enqueueResponse.ok) {
    const body = await enqueueResponse.text();
    throw new Error(
      `Falha ao enfileirar a sincronização (HTTP ${enqueueResponse.status}). ${body.slice(0, 300)}`
    );
  }
  const enqueueResult = await enqueueResponse.json().catch(() => null);

  // Lock ativo: outra sincronização da mesma planilha está em andamento
  const blocked = (enqueueResult?.skipped ?? []).find(
    (s: any) => !configId || s.spreadsheet_id === configId
  );
  if (blocked && (enqueueResult?.jobIds ?? []).length === 0) {
    throw new Error(blocked.reason);
  }

  // 2. Process in batches
  let totalProcessed = 0;
  let totalImported = 0;
  let totalDuplicates = 0;

  for (let i = 0; i < 50; i++) {
    const response = await fetch('/api/public/hooks/sync-spreadsheets?mode=process', {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Falha ao processar o lote de registros (HTTP ${response.status}). ${body.slice(0, 300)}`
      );
    }

    const last = await response.json().catch(() => null);
    totalProcessed += (last?.processed ?? 0);
    totalImported += (last?.imported ?? 0);
    totalDuplicates += (last?.duplicates ?? 0);

    if (last?.finished || !last?.processed) break;
  }

  // Se algum job desta planilha falhou, propaga a mensagem detalhada para a tela
  const failedQuery = supabase
    .from("sync_jobs")
    .select("error, spreadsheet_id")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: failedJobs } = configId
    ? await failedQuery.eq("spreadsheet_id", configId)
    : await failedQuery;

  const failure = failedJobs?.[0];
  if (failure?.error && totalImported === 0) {
    throw new Error(failure.error);
  }

  return { success: true, totalProcessed, totalImported, totalDuplicates };
}

export async function triggerManualSync(configId?: string) {
  return runSyncPipeline(configId, 'enqueue');
}

export async function resetSpreadsheet(configId: string) {
  return runSyncPipeline(configId, 'reset');
}

export async function fetchSyncHistory(configId: string) {
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*")
    .eq("spreadsheet_id", configId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data;
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




export interface SpreadsheetValidation {
  ok: boolean;
  name?: string | null;
  url?: string | null;
  accessible: boolean;
  rowCount: number;
  columnCount?: number;
  detectedHeaders: Record<string, string>;
  missingRequired?: string[];
  sampleSize?: number;
  errors: string[];
  warnings: string[];
}

export async function validateSpreadsheet(params: { configId?: string; url?: string; name?: string }): Promise<SpreadsheetValidation> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || (import.meta as any).env['VITE_SUPABASE_PUBLISHABLE_KEY'];

  const response = await fetch('/api/public/hooks/sync-spreadsheets?mode=validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao validar a planilha (HTTP ${response.status}). ${body.slice(0, 300)}`);
  }
  return (await response.json()) as SpreadsheetValidation;
}

export interface ReprocessEventResult {
  success: boolean;
  locationFound: boolean;
  latitude: number | null;
  longitude: number | null;
  geoSource: string | null;
  geoProvider: string | null;
}

export async function reprocessEvent(eventId: string): Promise<ReprocessEventResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || (import.meta as any).env['VITE_SUPABASE_PUBLISHABLE_KEY'];

  const response = await fetch('/api/public/hooks/sync-spreadsheets?mode=reprocess-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ eventId }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new Error(body?.error || `Falha ao reprocessar o registro (HTTP ${response.status}).`);
  }
  return body as ReprocessEventResult;
}

export interface EventGeocodeHistoryEntry {
  id: string;
  event_id: string;
  geo_source: string | null;
  geo_provider: string | null;
  query_payload: any;
  api_response: any;
  found_address: string | null;
  latitude: number | null;
  longitude: number | null;
  location_found: boolean;
  error: string | null;
  created_at: string;
}

export async function fetchEventGeocodeHistory(eventId: string): Promise<EventGeocodeHistoryEntry[]> {
  const { data, error } = await supabase
    .from("event_geocode_history")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as unknown as EventGeocodeHistoryEntry[];
}
