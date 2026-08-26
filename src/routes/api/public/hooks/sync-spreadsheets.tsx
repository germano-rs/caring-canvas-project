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

// Colunas opcionais de coordenadas GPS presentes na própria planilha.
// Quando existem e são válidas, têm prioridade sobre o geocoding.
const LATITUDE_ALIASES = ['latitude', 'lat', 'nu_latitude', 'nu_lat', 'coordenada latitude', 'gps latitude'];
const LONGITUDE_ALIASES = ['longitude', 'long', 'lon', 'lng', 'nu_longitude', 'nu_long', 'coordenada longitude', 'gps longitude'];

function findCoordinateColumn(headerRow: any[], aliases: string[]): string | null {
  if (!headerRow) return null;
  const normalizedAliases = aliases.map(normalizeHeader);
  for (const raw of headerRow) {
    if (raw == null) continue;
    const h = String(raw).trim();
    const n = normalizeHeader(h);
    if (normalizedAliases.some(a => n === a || n.includes(a))) return h;
  }
  return null;
}

// Converte " -18,7567 " ou "-18.7567" em número; retorna NaN se inválido
function parseCoordinate(value: any): number {
  if (value == null) return NaN;
  const s = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}


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

  // Detecta colunas opcionais de coordenadas GPS (não geram erro se ausentes)
  const latHeader = findCoordinateColumn(headerRow, LATITUDE_ALIASES);
  const lonHeader = findCoordinateColumn(headerRow, LONGITUDE_ALIASES);
  if (latHeader && lonHeader) {
    headers.latitude = latHeader;
    headers.longitude = lonHeader;
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

let geoSettings: { provider: string; key: string | null } = { provider: 'osm', key: null };

async function queryGoogleGeocoding(queryString: string, apiKey: string): Promise<any> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryString)}&region=br&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data: any = await response.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const loc = data.results[0].geometry.location;
    return [{ lat: loc.lat, lon: loc.lng }];
  } catch (e) {
    return null;
  }
}

async function runGeocodingQuery(queryString: string): Promise<{ data: any; provider: string } | null> {
  if (geoSettings.provider === 'google' && geoSettings.key) {
    const google = await queryGoogleGeocoding(queryString, geoSettings.key);
    if (google && google.length > 0) return { data: google, provider: 'google' };
  }
  const nominatim = await queryNominatim(queryString);
  if (nominatim && nominatim.length > 0) return { data: nominatim, provider: 'nominatim' };
  const photon = await queryPhoton(queryString);
  if (photon && photon.length > 0) return { data: photon, provider: 'photon' };
  return null;
}

async function geocodeByAddress(rua?: string, bairro?: string, cidade: string = "Curvelo", uf: string = "MG"): Promise<(GeocodingResult & { provider: string }) | null> {
  const tryQueries: string[] = [];
  if (rua && bairro) tryQueries.push(`${rua}, ${bairro}, ${cidade} - ${uf}, Brazil`);
  if (rua) tryQueries.push(`${rua}, ${cidade} - ${uf}, Brazil`);
  if (bairro) tryQueries.push(`${bairro}, ${cidade} - ${uf}, Brazil`);

  for (const query of tryQueries) {
    const res = await runGeocodingQuery(query);
    if (res) {
      return {
        latitude: parseFloat(res.data[0].lat),
        longitude: parseFloat(res.data[0].lon),
        bairro: bairro || null,
        rua: rua || null,
        provider: res.provider
      };
    }
  }
  return null;
}

async function serverGeocodeByCEP(cep: string): Promise<(GeocodingResult & { provider: string }) | null> {
  const cleanCEP = cep.replace(/\D/g, "");
  if (cleanCEP.length !== 8) return null;
  try {
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    const viaCepData = await viaCepResponse.json();
    if (!viaCepData || viaCepData.erro) return null;
    const { logradouro, bairro, localidade, uf } = viaCepData;
    let result = await geocodeByAddress(logradouro, bairro, localidade, uf);
    if (!result) {
      const fallback = await runGeocodingQuery(`${cleanCEP}, Brazil`);
      if (fallback) {
        result = {
          latitude: parseFloat(fallback.data[0].lat),
          longitude: parseFloat(fallback.data[0].lon),
          bairro: bairro || null,
          rua: logradouro || null,
          provider: fallback.provider
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

        // Carrega o provedor de geolocalização configurado na área de Administrador
        try {
          const { data: settingsRow } = await supabase
            .from('app_settings')
            .select('geocoding_provider, google_geocoding_api_key, google_maps_api_key')
            .eq('id', 'default')
            .maybeSingle();
          if (settingsRow) {
            geoSettings = {
              provider: settingsRow.geocoding_provider ?? 'osm',
              key: settingsRow.google_geocoding_api_key || settingsRow.google_maps_api_key || null,
            };
          }
        } catch (e) {
          geoSettings = { provider: 'osm', key: null };
        }

        const urlParams = new URL(request.url).searchParams;
        const mode = urlParams.get('mode') || 'enqueue'; // enqueue | process | validate

        // ---------- Validação prévia da planilha (antes de sincronizar) ----------
        if (mode === 'validate') {
          let body: any = {};
          try { body = await request.json(); } catch { body = {}; }

          let targetUrl: string | null = body?.url ?? null;
          let name: string | null = body?.name ?? null;

          if (!targetUrl && body?.configId) {
            const { data: cfg } = await supabase
              .from('spreadsheet_configs')
              .select('name, url')
              .eq('id', body.configId)
              .maybeSingle();
            targetUrl = cfg?.url ?? null;
            name = cfg?.name ?? name;
          }

          const report: any = {
            ok: false,
            name,
            url: targetUrl,
            accessible: false,
            rowCount: 0,
            detectedHeaders: {} as Record<string, string>,
            errors: [] as string[],
            warnings: [] as string[],
          };

          if (!targetUrl) {
            report.errors.push('URL da planilha não informada.');
            return Response.json(report, { status: 200 });
          }

          let url = targetUrl;
          if (url.includes('docs.google.com/spreadsheets') && !url.includes('export?format=csv')) {
            const match = url.match(/\/d\/([^\/]+)/);
            if (match) {
              url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
            } else {
              report.errors.push('Link do Google Sheets inválido: não foi possível identificar o ID do documento.');
              return Response.json(report, { status: 200 });
            }
          }

          let csvText = '';
          try {
            const res = await fetch(url, { redirect: 'follow' });
            const contentType = res.headers.get('content-type') || '';
            csvText = await res.text();

            if (!res.ok) {
              report.errors.push(
                res.status === 404
                  ? 'Planilha não encontrada (HTTP 404). Verifique se o link está correto.'
                  : `A planilha não pôde ser acessada (HTTP ${res.status}).`
              );
              return Response.json(report, { status: 200 });
            }

            if (contentType.includes('text/html') || /<html/i.test(csvText.slice(0, 300))) {
              report.errors.push(
                'A planilha não está pública. Compartilhe como "Qualquer pessoa com o link — Leitor" e tente novamente.'
              );
              return Response.json(report, { status: 200 });
            }
            report.accessible = true;
          } catch (e: any) {
            report.errors.push(`Falha de rede ao acessar a planilha: ${e?.message ?? 'erro desconhecido'}`);
            return Response.json(report, { status: 200 });
          }

          const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
          const rows = (parsed.data as any[]) ?? [];
          const headerRow = (parsed.meta.fields ?? []) as string[];
          report.rowCount = rows.length;
          report.columnCount = headerRow.length;

          if (headerRow.length === 0) {
            report.errors.push('A planilha não possui linha de cabeçalho.');
            return Response.json(report, { status: 200 });
          }
          if (rows.length === 0) {
            report.errors.push('A planilha está vazia (nenhuma linha de dados após o cabeçalho).');
          }

          const maxIndex = Math.max(...Object.values(COLUMN_POSITIONS));
          if (headerRow.length <= maxIndex) {
            report.errors.push(
              `A planilha tem apenas ${headerRow.length} colunas, mas o formato oficial exige pelo menos ${maxIndex + 1} (até a coluna ${indexToExcelLetter(maxIndex)}).`
            );
          }

          const { headers, errors } = readHeaders(headerRow);
          report.detectedHeaders = headers;

          const REQUIRED: (keyof typeof COLUMN_POSITIONS)[] = [
            'numeroNotificacao', 'dataNotificacao', 'bairro', 'logradouro', 'cep',
          ];
          const missingRequired = REQUIRED.filter(k => !headers[k]);
          if (missingRequired.length > 0) {
            report.errors.push(
              `Colunas obrigatórias ausentes ou vazias no cabeçalho: ${missingRequired
                .map(k => `${k} (${indexToExcelLetter(COLUMN_POSITIONS[k])})`)
                .join(', ')}.`
            );
          }
          report.missingRequired = missingRequired;

          // Divergências de nome de cabeçalho: bloqueia se for coluna obrigatória, avisa nas demais
          for (const msg of errors) {
            const isRequiredIssue = REQUIRED.some(k => msg.startsWith(`Coluna ${indexToExcelLetter(COLUMN_POSITIONS[k])}:`));
            if (isRequiredIssue) report.errors.push(msg);
            else report.warnings.push(msg);
          }

          // Amostragem de qualidade dos dados (primeiras 100 linhas)
          if (rows.length > 0 && missingRequired.length === 0) {
            const sample = rows.slice(0, 100);
            const counters = { cep: 0, logradouro: 0, bairro: 0, data: 0, dataInvalida: 0 };
            for (const row of sample) {
              if (!cell(row, headers['cep'])) counters.cep++;
              if (!cell(row, headers['logradouro'])) counters.logradouro++;
              if (!cell(row, headers['bairro'])) counters.bairro++;
              const dataRaw = cell(row, headers['dataNotificacao']);
              if (!dataRaw) counters.data++;
              else if (!/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(dataRaw) && isNaN(new Date(dataRaw).getTime())) {
                counters.dataInvalida++;
              }
            }
            report.sampleSize = sample.length;
            report.sampleIssues = counters;
            if (counters.cep > 0) report.warnings.push(`${counters.cep} de ${sample.length} linhas analisadas estão sem CEP (serão geolocalizadas por rua/bairro).`);
            if (counters.logradouro > 0) report.warnings.push(`${counters.logradouro} de ${sample.length} linhas analisadas estão sem logradouro.`);
            if (counters.bairro > 0) report.warnings.push(`${counters.bairro} de ${sample.length} linhas analisadas estão sem bairro.`);
            if (counters.data > 0) report.warnings.push(`${counters.data} de ${sample.length} linhas analisadas estão sem data da notificação.`);
            if (counters.dataInvalida > 0) report.warnings.push(`${counters.dataInvalida} de ${sample.length} linhas analisadas têm data em formato não reconhecido (use dd/mm/aaaa).`);
            if (counters.cep === sample.length && counters.logradouro === sample.length) {
              report.errors.push('Nenhuma linha analisada possui CEP nem logradouro: não será possível gerar o mapa de calor.');
            }
          }

          report.ok = report.accessible && report.errors.length === 0;
          return Response.json(report, { status: 200 });
        }


        if (mode === 'enqueue' || mode === 'reset') {
          let body: any = {};
          try { body = await request.json(); } catch { body = {}; }
          const targetConfigId: string | null = body?.configId ?? null;
          const isReset = mode === 'reset';

          if (isReset && !targetConfigId) {
            return Response.json({ error: 'É necessário informar a planilha para reprocessar do zero.' }, { status: 400 });
          }

          let configsQuery = supabase.from('spreadsheet_configs').select('*');
          if (targetConfigId) configsQuery = configsQuery.eq('id', targetConfigId);
          const { data: configs } = await configsQuery;

          const jobIds: string[] = [];
          const skipped: { spreadsheet_id: string; reason: string }[] = [];

          for (const config of configs ?? []) {
            if (!config.url) continue;

            // ---- Lock: impede duas sincronizações simultâneas da mesma planilha ----
            const lockOwner = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            const { data: gotLock } = await supabase.rpc('acquire_sync_lock', {
              p_config_id: config.id,
              p_owner: lockOwner,
            });

            if (!gotLock) {
              skipped.push({
                spreadsheet_id: config.id,
                reason: 'Já existe uma sincronização em andamento para esta planilha. Aguarde a conclusão antes de iniciar outra.',
              });
              continue;
            }

            // Segurança extra: job ativo pendente para a mesma planilha
            const { data: existingJob } = await supabase
              .from('sync_jobs')
              .select('id')
              .eq('spreadsheet_id', config.id)
              .in('status', ['queued', 'running'])
              .limit(1)
              .maybeSingle();

            if (existingJob && !isReset) {
              await supabase.rpc('release_sync_lock', { p_config_id: config.id });
              skipped.push({
                spreadsheet_id: config.id,
                reason: 'Já existe um job de sincronização na fila para esta planilha.',
              });
              continue;
            }

            const { data: job } = await supabase
              .from('sync_jobs')
              .insert({ spreadsheet_id: config.id, status: 'queued' })
              .select()
              .single();

            if (!job) {
              await supabase.rpc('release_sync_lock', { p_config_id: config.id });
              continue;
            }
            jobIds.push(job.id);

            try {
              if (isReset) {
                // Reprocessa do zero: limpa dados importados e a posição de leitura
                await supabase.from('sync_job_items').delete().eq('spreadsheet_id', config.id).eq('status', 'pending');
                await supabase.from('health_events').delete().eq('spreadsheet_id', config.id);
                await supabase.from('spreadsheet_configs').update({ last_row_count: 0 }).eq('id', config.id);
                await supabase
                  .from('sync_jobs')
                  .update({ status: 'completed', finished_at: new Date().toISOString(), error: 'Cancelado: substituído pelo reprocessamento total.' })
                  .eq('spreadsheet_id', config.id)
                  .in('status', ['queued', 'running'])
                  .neq('id', job.id);
              }

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

              await supabase.from('sync_jobs').update({ error: null, total_rows: 0 }).eq('id', job.id);

              // Registros já lidos são imutáveis: só considera as linhas além da última posição lida
              const lastRowCount = isReset ? 0 : Number(config.last_row_count ?? 0);

              if (lastRowCount > rows.length) {
                throw new Error(
                  `A planilha tem ${rows.length} registros, menos que os ${lastRowCount} já lidos anteriormente. ` +
                  'Registros já importados são imutáveis — verifique se a planilha correta foi informada ou se linhas foram removidas.'
                );
              }

              const newRows = rows.slice(lastRowCount);

              // Deduplicação: chave estável por planilha + número da notificação + posição da linha
              const { data: importedHashes } = await supabase
                .from('health_events')
                .select('row_hash')
                .eq('spreadsheet_id', config.id);

              const existingSet = new Set((importedHashes ?? []).map(r => r.row_hash));
              const seen = new Set<string>();

              const itemsToEnqueue = newRows.map((row, i) => {
                const absoluteIndex = lastRowCount + i;
                const notif = cell(row, headers['numeroNotificacao']) ?? '';
                const key = `${config.id}|${notif}|${absoluteIndex}`;
                return {
                  job_id: job.id,
                  spreadsheet_id: config.id,
                  row_data: { __headers: headers, row },
                  row_hash: createHash('md5').update(key).digest('hex'),
                  status: 'pending'
                };
              }).filter(item => {
                if (existingSet.has(item.row_hash) || seen.has(item.row_hash)) return false;
                seen.add(item.row_hash);
                return true;
              });

              if (itemsToEnqueue.length > 0) {
                for (let i = 0; i < itemsToEnqueue.length; i += 500) {
                  await supabase.from('sync_job_items').insert(itemsToEnqueue.slice(i, i + 500));
                }
              }

              await supabase.from('spreadsheet_configs')
                .update({ last_row_count: rows.length })
                .eq('id', config.id);

              const finished = itemsToEnqueue.length === 0;
              await supabase.from('sync_jobs').update({
                total_rows: itemsToEnqueue.length,
                status: finished ? 'completed' : 'queued',
                finished_at: finished ? new Date().toISOString() : null
              }).eq('id', job.id);

              // Quando não há nada a processar, o lock é liberado imediatamente
              if (finished) {
                await supabase.rpc('release_sync_lock', { p_config_id: config.id });
              }
            } catch (err) {
              await supabase.from('sync_jobs').update({
                status: 'failed',
                error: String(err instanceof Error ? err.message : err),
                finished_at: new Date().toISOString(),
                imported_rows: 0,
                failed_rows: 0
              }).eq('id', job.id);
              await supabase.rpc('release_sync_lock', { p_config_id: config.id });
            }
          }
          return Response.json({ success: true, jobIds, skipped });
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

          if (!job) return Response.json({ success: true, message: 'No jobs to process' });

          // Mark job as running
          if (job.status === 'queued') {
            await supabase.from('sync_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id);
          }

          const config = job.spreadsheet_configs;
          const lockOwner: string | null = config?.sync_lock_owner ?? null;
          let processed = 0;
          let imported = 0;
          let duplicates = 0;
          let failed = 0;
          let fatalError: string | null = null;

          try {
            while (Date.now() - startedAt < TIME_BUDGET_MS) {
              const { data: items } = await supabase
                .from('sync_job_items')
                .select('*')
                .eq('job_id', job.id)
                .eq('status', 'pending')
                .limit(BATCH_SIZE);

              if (!items || items.length === 0) break;

              // Renova o lock a cada lote para não expirar durante o processamento
              if (lockOwner) {
                await supabase.rpc('renew_sync_lock', { p_config_id: config.id, p_owner: lockOwner });
              }

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
                  // Deduplicação: se a chave já existe, não reimporta
                  const { data: already } = await supabase
                    .from('health_events')
                    .select('id')
                    .eq('spreadsheet_id', config.id)
                    .eq('row_hash', item.row_hash)
                    .maybeSingle();

                  if (already) {
                    await supabase.from('sync_job_items').update({ status: 'completed' }).eq('id', item.id);
                    duplicates++;
                    processed++;
                    continue;
                  }

                  let geoSource: string | null = null;
                  let geoProvider: string | null = null;

                  if (config.auto_geocode) {
                    let geo: any = null;
                    if (cleanCEP.length === 8) {
                      const { data: cached } = await supabase.from('geocoding_cache').select('*').eq('cep', cleanCEP).maybeSingle();
                      if (cached) {
                        geo = cached;
                        geoSource = 'cep';
                        geoProvider = (cached as any).provider ?? 'cache';
                      } else {
                        const fresh = await serverGeocodeByCEP(cleanCEP);
                        if (fresh) {
                          geo = fresh;
                          geoSource = 'cep';
                          geoProvider = fresh.provider;
                          await supabase.from('geocoding_cache').upsert({
                            cep: cleanCEP,
                            latitude: fresh.latitude,
                            longitude: fresh.longitude,
                            bairro: fresh.bairro,
                            rua: fresh.rua,
                            provider: fresh.provider
                          });
                        }
                      }
                    }
                    if (!geo) {
                      const byAddress = await geocodeByAddress(logradouro ?? undefined, bairro ?? undefined);
                      if (byAddress) {
                        geo = byAddress;
                        geoSource = 'endereco';
                        geoProvider = byAddress.provider;
                      }
                    }
                    if (geo) { lat = geo.latitude; lon = geo.longitude; }
                  }

                  const locationFound = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;

                  const { error: upsertError } = await supabase.from('health_events').upsert({
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
                    geo_source: locationFound ? geoSource : null,
                    geo_provider: locationFound ? geoProvider : null,

                    event_date: parseEventDate(dataNotificacao),
                    event_type: tipoNotificacao,
                    raw_data: row,
                    row_hash: item.row_hash
                  }, { onConflict: 'spreadsheet_id,row_hash', ignoreDuplicates: true });

                  if (upsertError) throw new Error(upsertError.message);

                  await supabase.from('sync_job_items').update({ status: 'completed' }).eq('id', item.id);
                  imported++;
                } catch (err) {
                  await supabase.from('sync_job_items').update({
                    status: 'failed',
                    error: String(err instanceof Error ? err.message : err)
                  }).eq('id', item.id);
                  failed++;
                }
                processed++;
              }
            }
          } catch (err) {
            fatalError = String(err instanceof Error ? err.message : err);
          }

          // Update job progress
          await supabase.rpc('increment_job_progress', {
            job_id: job.id,
            p_inc: processed,
            i_inc: imported,
            f_inc: failed
          });

          if (fatalError) {
            await supabase.from('sync_jobs').update({
              status: 'failed',
              error: fatalError,
              finished_at: new Date().toISOString()
            }).eq('id', job.id);
            await supabase.rpc('release_sync_lock', { p_config_id: config.id });
            return Response.json({ success: false, error: fatalError, processed, imported, failed, finished: true });
          }

          // Check if finished
          const { data: remaining } = await supabase.from('sync_job_items').select('id').eq('job_id', job.id).eq('status', 'pending').limit(1);
          const finished = !remaining || remaining.length === 0;

          if (finished) {
            const { data: failedItems } = await supabase
              .from('sync_job_items')
              .select('error')
              .eq('job_id', job.id)
              .eq('status', 'failed')
              .limit(1);

            await supabase.from('sync_jobs').update({
              status: 'completed',
              finished_at: new Date().toISOString(),
              error: failedItems?.[0]?.error
                ? `Concluído com falhas em alguns registros. Primeiro erro: ${failedItems[0].error}`
                : null
            }).eq('id', job.id);

            await supabase.rpc('release_sync_lock', { p_config_id: config.id });
          }

          return Response.json({ success: true, processed, imported, duplicates, failed, finished });
        }


        return new Response('Invalid mode', { status: 400 });
      }
    }
  }
});
