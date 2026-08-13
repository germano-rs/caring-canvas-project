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

              // Filter out already imported rows before enqueuing to save space
              const { data: importedHashes } = await supabase
                .from('health_events')
                .select('row_hash')
                .eq('spreadsheet_id', config.id);
              
              const existingSet = new Set((importedHashes ?? []).map(r => r.row_hash));

              const itemsToEnqueue = rows.map(row => ({
                job_id: job.id,
                spreadsheet_id: config.id,
                row_data: row,
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
                error: String(err),
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
          const mapping = config.column_mapping;
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
              const row = item.row_data;
              let lat = parseFloat(row[mapping.latitude]);
              let lon = parseFloat(row[mapping.longitude]);
              const cep = row[mapping.cep];
              const cleanCEP = cep ? String(cep).replace(/\D/g, '') : '';

              try {
                if (config.auto_geocode && (isNaN(lat) || isNaN(lon))) {
                   // Reuse geocoding logic (simplified for brevity here but keeping the structure)
                   let geo = null;
                   if (cleanCEP.length === 8) {
                      const { data: cached } = await supabase.from('geocoding_cache').select('*').eq('cep', cleanCEP).maybeSingle();
                      if (cached) geo = cached;
                      else {
                        geo = await serverGeocodeByCEP(cleanCEP);
                        if (geo) await supabase.from('geocoding_cache').upsert({ cep: cleanCEP, ...geo });
                      }
                   }
                   if (!geo) geo = await geocodeByAddress(row[mapping.rua], row[mapping.bairro]);
                   if (geo) { lat = geo.latitude; lon = geo.longitude; }
                }

                await supabase.from('health_events').upsert({
                  spreadsheet_id: config.id,
                  cep: row[mapping.cep],
                  rua: row[mapping.rua],
                  bairro: row[mapping.bairro],
                  latitude: isNaN(lat) ? 0 : lat,
                  longitude: isNaN(lon) ? 0 : lon,
                  event_date: parseEventDate(row[mapping.data]),
                  event_type: mapping.evento ? row[mapping.evento] : null,
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
            
            // Cleanup: optionally delete items
            // await supabase.from('sync_job_items').delete().eq('job_id', job.id);
          }

          return new Response(JSON.stringify({ success: true, processed, imported, failed, finished: !remaining || remaining.length === 0 }));
        }

        return new Response('Invalid mode', { status: 400 });
      }
    }
  }
});
