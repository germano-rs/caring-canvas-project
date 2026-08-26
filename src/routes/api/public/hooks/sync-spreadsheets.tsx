import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { createHash } from 'crypto';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  bairro?: string | null;
  rua?: string | null;
}

const TIME_BUDGET_MS = 40000; // Leave some buffer
const BATCH_SIZE = 20;

// Estrutura fixa da planilha de notificações (posições de coluna, 0-indexed)
// A=0 NÚMERO DA NOTIFICAÇÃO, B=1 TIPO, D=3 DATA, F=5 ANO, J=9 ID UNIDADE,
// N=13 DATA DE NASCIMENTO, R=17 SEXO, S=18 GESTANTE, AC=28 BAIRRO, AE=30 LOGRADOURO, AK=36 CEP
const COLUMN_POSITIONS = {
  numeroNotificacao: 0,  // A
  tipoNotificacao: 1,    // B
  dataNotificacao: 3,    // D
  anoNotificacao: 5,     // F
  idUnidade: 9,          // J
  dataNascimento: 13,    // N
  sexo: 17,              // R
  gestante: 18,          // S
  bairro: 28,            // AC
  logradouro: 30,        // AE
  cep: 36,               // AK
} as const;

// Aceita tanto os títulos descritivos quanto os códigos do SINAN (NU_NOTIFIC, TP_NOT, ...)
const EXPECTED_HEADERS: Record<keyof typeof COLUMN_POSITIONS, string[]> = {
  numeroNotificacao: ['numero da notificacao', 'número da notificação', 'num notificacao', 'nu_notific'],
  tipoNotificacao: ['tipo da notificacao', 'tipo da notificação', 'tipo', 'tp_not'],
  dataNotificacao: ['data da notificacao', 'data da notificação', 'data notificacao', 'dt_notific'],
  anoNotificacao: ['ano da notificacao', 'ano da notificação', 'ano', 'nu_ano'],
  idUnidade: ['id da unidade', 'id unidade', 'unidade', 'id_unidade'],
  dataNascimento: ['data de nascimento', 'data nascimento', 'nascimento', 'dt_nasc'],
  sexo: ['sexo', 'cs_sexo'],
  gestante: ['gestante', 'cs_gestant'],
  bairro: ['nome do bairro', 'bairro', 'nm_bairro'],
  logradouro: ['nome do logradouro', 'logradouro', 'nm_logrado'],
  cep: ['cep', 'nu_cep'],
};


function normalizeHeader(value: any): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// Lê a primeira linha (cabeçalho) e valida as posições esperadas
function readHeaders(headerRow: any[]): { headers: Record<string, string>; errors: string[] } {
  const headers: Record<string, string> = {};
  const errors: string[] = [];

  for (const [key, idx] of Object.entries(COLUMN_POSITIONS) as [keyof typeof COLUMN_POSITIONS, number][]) {
    const rawHeader = headerRow?.[idx];
    const header = rawHeader != null && String(rawHeader).trim() !== '' ? String(rawHeader).trim() : null;
    if (!header) {
      errors.push(`Coluna ${indexToExcelLetter(idx)} (posição ${idx + 1}) está vazia no cabeçalho`);
      continue;
    }
    headers[key] = header;

    // Validação flexível: avisa se o cabeçalho não corresponde ao esperado
    const normalized = normalizeHeader(header);
    const expected = EXPECTED_HEADERS[key].map(normalizeHeader);
    if (!expected.some(e => normalized.includes(e) || e.includes(normalized))) {
      errors.push(`Coluna ${indexToExcelLetter(idx)}: esperado algo como "${EXPECTED_HEADERS[key][0]}", encontrado "${header}"`);
    }
  }

  return { headers, errors };
}

function indexToExcelLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function queryNominatim(queryString: string): Promise<any> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString)}&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'HealthHeatmapApp/1.0' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
}

async function queryPhoton(queryString: string): Promise<any> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(queryString)}&limit=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.features && data.features.length > 0) {
      const feat = data.features[0];
      return [{
        lat: feat.geometry.coordinates[1],
        lon: feat.geometry.coordinates[0]
      }];
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function geocodeByAddress(rua?: string, bairro?: string, cidade: string = "Curvelo", uf: string = "MG"): Promise<GeocodingResult | null> {
  const tryQueries: string[] = [];
  if (rua && bairro) tryQueries.push(`${rua}, ${bairro}, ${cidade} - ${uf}, Brazil`);
  if (rua) tryQueries.push(`${rua}, ${cidade} - ${uf}, Brazil`);
  if (bairro) tryQueries.push(`${bairro}, ${cidade} - ${uf}, Brazil`);

  for (const query of tryQueries) {
    let data = await queryNominatim(query);
    if (!data || data.length === 0) {
      data = await queryPhoton(query);
    }
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        bairro: bairro || null,
        rua: rua || null
      };
    }
  }
  return null;
}

async function serverGeocodeByCEP(cep: string): Promise<GeocodingResult | null> {
  const cleanCEP = cep.replace(/\D/g, "");
  if (cleanCEP.length !== 8) return null;
  try {
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    const viaCepData = await viaCepResponse.json();
    if (!viaCepData || viaCepData.erro) return null;
    const { logradouro, bairro, localidade, uf } = viaCepData;
    let result = await geocodeByAddress(logradouro, bairro, localidade, uf);
    if (!result) {
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${cleanCEP}&country=Brazil&limit=1`;
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: { 'User-Agent': 'HealthHeatmapApp/1.0' }
      });
      let fallbackData = await fallbackResponse.json();
      if (!fallbackData || fallbackData.length === 0) {
        fallbackData = await queryPhoton(cleanCEP);
      }
      if (fallbackData && fallbackData.length > 0) {
        result = {
          latitude: parseFloat(fallbackData[0].lat),
          longitude: parseFloat(fallbackData[0].lon),
          bairro: bairro || null,
          rua: logradouro || null
        };
      }
    }
    return result;
  } catch (error) {
    return null;
  }
}

function parseEventDate(value: any): string {
  if (!value) return new Date().toISOString();
  const str = String(value).trim();
  const br = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (br) {
    const d = new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function cell(row: any, header: string | undefined): string | null {
  if (!header) return null;
  const v = row[header];
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export const Route = createFileRoute('/api/public/hooks/sync-spreadsheets')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');
        const supabaseUrl = process.env['VITE_SUPABASE_URL']!;
        const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || token || process.env['VITE_SUPABASE_ANON_KEY']!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const urlParams = new URL(request.url).searchParams;
        const mode = urlParams.get('mode') || 'enqueue'; // enqueue or process

        if (mode === 'enqueue') {
          // 1. Find all active spreadsheets
          const { data: configs } = await supabase.from('spreadsheet_configs').select('*');
          const jobIds: string[] = [];

          for (const config of configs ?? []) {
            if (!config.url) continue;

            // Check if there is already a running job for this spreadsheet
            const { data: existingJob } = await supabase
              .from('sync_jobs')
              .select('id')
              .eq('spreadsheet_id', config.id)
              .in('status', ['queued', 'running'])
              .maybeSingle();

            if (existingJob) continue;

            // Create new job
            const { data: job } = await supabase
              .from('sync_jobs')
              .insert({
                spreadsheet_id: config.id,
                status: 'queued'
              })
              .select()
              .single();

            if (!job) continue;
            jobIds.push(job.id);

            // Fetch CSV and enqueue items
            try {
              let url = config.url;
              if (url.includes("docs.google.com/spreadsheets") && !url.includes("export=csv")) {
                const match = url.match(/\/d\/([^\/]+)/);
                if (match) url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
              }
              const csvResponse = await fetch(url);
              const csvText = await csvResponse.text();
              const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
              const rows = parsed.data as any[];
              const headerRow = (parsed.meta.fields ?? []) as string[];

              if (rows.length === 0 || headerRow.length === 0) {
                throw new Error('Planilha vazia ou sem cabeçalho.');
              }

              // Lê e valida o cabeçalho nas posições fixas (A, B, D, F, J, N, R, S, AC, AE, AK)
              const { headers, errors } = readHeaders(headerRow);
              const missingRequired = ['numeroNotificacao', 'dataNotificacao', 'bairro', 'logradouro', 'cep']
                .filter(k => !headers[k]);
              if (missingRequired.length > 0 || errors.length > 0) {
                throw new Error(
                  'Estrutura da planilha inválida. ' +
                  (errors.length > 0 ? errors.join('; ') : `Colunas obrigatórias ausentes: ${missingRequired.join(', ')}`)
                );
              }

              // Guarda os cabeçalhos detectados para a etapa de processamento
              await supabase.from('sync_jobs').update({
                error: null,
                total_rows: 0
              }).eq('id', job.id);

              // Filter out already imported rows before enqueuing to save space
              const { data: importedHashes } = await supabase
                .from('health_events')
                .select('row_hash')
                .eq('spreadsheet_id', config.id);

              const existingSet = new Set((importedHashes ?? []).map(r => r.row_hash));

              const itemsToEnqueue = rows.map(row => ({
                job_id: job.id,
                spreadsheet_id: config.id,
                row_data: { __headers: headers, row },
                row_hash: createHash('md5').update(JSON.stringify(row)).digest('hex'),
                status: 'pending'
              })).filter(item => !existingSet.has(item.row_hash));

              if (itemsToEnqueue.length > 0) {
                // Insert in batches of 500
                for (let i = 0; i < itemsToEnqueue.length; i += 500) {
                  await supabase.from('sync_job_items').insert(itemsToEnqueue.slice(i, i + 500));
                }
              }

              await supabase.from('sync_jobs').update({
                total_rows: itemsToEnqueue.length,
                status: itemsToEnqueue.length > 0 ? 'queued' : 'completed',
                finished_at: itemsToEnqueue.length > 0 ? null : new Date().toISOString()
              }).eq('id', job.id);

            } catch (err) {
              await supabase.from('sync_jobs').update({
                status: 'failed',
                error: String(err instanceof Error ? err.message : err),
                finished_at: new Date().toISOString()
              }).eq('id', job.id);
            }
          }
          return new Response(JSON.stringify({ success: true, jobIds }));
        }

        if (mode === 'process') {
          // 2. Process pending items
          const { data: job } = await supabase
            .from('sync_jobs')
            .select('*, spreadsheet_configs(*)')
            .in('status', ['queued', 'running'])
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (!job) return new Response(JSON.stringify({ success: true, message: 'No jobs to process' }));

          // Mark job as running
          if (job.status === 'queued') {
            await supabase.from('sync_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id);
          }

          const config = job.spreadsheet_configs;
          let processed = 0;
          let imported = 0;
          let failed = 0;

          while (Date.now() - startedAt < TIME_BUDGET_MS) {
            const { data: items } = await supabase
              .from('sync_job_items')
              .select('*')
              .eq('job_id', job.id)
              .eq('status', 'pending')
              .limit(BATCH_SIZE);

            if (!items || items.length === 0) break;

            for (const item of items) {
              const headers = item.row_data?.__headers ?? {};
              const row = item.row_data?.row ?? item.row_data;

              const numeroNotificacao = cell(row, headers.numeroNotificacao);
              const tipoNotificacao = cell(row, headers.tipoNotificacao);
              const dataNotificacao = cell(row, headers.dataNotificacao);
              const anoNotificacao = cell(row, headers.anoNotificacao);
              const idUnidade = cell(row, headers.idUnidade);
              const dataNascimento = cell(row, headers.dataNascimento);
              const sexo = cell(row, headers.sexo);
              const gestante = cell(row, headers.gestante);
              const bairro = cell(row, headers.bairro);
              const logradouro = cell(row, headers.logradouro);
              const cep = cell(row, headers.cep);
              const cleanCEP = cep ? cep.replace(/\D/g, '') : '';

              let lat = NaN;
              let lon = NaN;

              try {
                if (config.auto_geocode) {
                  let geo = null;
                  if (cleanCEP.length === 8) {
                    const { data: cached } = await supabase.from('geocoding_cache').select('*').eq('cep', cleanCEP).maybeSingle();
                    if (cached) geo = cached;
                    else {
                      geo = await serverGeocodeByCEP(cleanCEP);
                      if (geo) await supabase.from('geocoding_cache').upsert({ cep: cleanCEP, ...geo });
                    }
                  }
                  if (!geo) geo = await geocodeByAddress(logradouro ?? undefined, bairro ?? undefined);
                  if (geo) { lat = geo.latitude; lon = geo.longitude; }
                }

                const locationFound = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;

                await supabase.from('health_events').upsert({
                  spreadsheet_id: config.id,
                  numero_notificacao: numeroNotificacao,
                  tipo_notificacao: tipoNotificacao,
                  ano_notificacao: anoNotificacao,
                  id_unidade: idUnidade,
                  data_nascimento: dataNascimento,
                  sexo: sexo,
                  gestante: gestante,
                  logradouro: logradouro,
                  cep: cep,
                  rua: logradouro,
                  bairro: bairro,
                  latitude: locationFound ? lat : 0,
                  longitude: locationFound ? lon : 0,
                  location_found: locationFound,
                  event_date: parseEventDate(dataNotificacao),
                  event_type: tipoNotificacao,
                  raw_data: row,
                  row_hash: item.row_hash
                });

                await supabase.from('sync_job_items').update({ status: 'completed' }).eq('id', item.id);
                imported++;
              } catch (err) {
                await supabase.from('sync_job_items').update({ status: 'failed', error: String(err) }).eq('id', item.id);
                failed++;
              }
              processed++;
            }
          }

          // Update job progress
          await supabase.rpc('increment_job_progress', {
            job_id: job.id,
            p_inc: processed,
            i_inc: imported,
            f_inc: failed
          });

          // Check if finished
          const { data: remaining } = await supabase.from('sync_job_items').select('id').eq('job_id', job.id).eq('status', 'pending').limit(1);
          if (!remaining || remaining.length === 0) {
            await supabase.from('sync_jobs').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('id', job.id);
          }

          return new Response(JSON.stringify({ success: true, processed, imported, failed, finished: !remaining || remaining.length === 0 }));
        }

        return new Response('Invalid mode', { status: 400 });
      }
    }
  }
});
