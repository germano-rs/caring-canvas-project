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

const TIME_BUDGET_MS = 45000;

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
    console.error("Geocoding error:", error);
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

// Server-side route for syncing spreadsheets
export const Route = createFileRoute('/api/public/hooks/sync-spreadsheets')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        const supabaseUrl = process.env['VITE_SUPABASE_URL']!;
        const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || token || process.env['VITE_SUPABASE_ANON_KEY']!;

        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: configs, error: configError } = await supabase
          .from('spreadsheet_configs')
          .select('*');

        if (configError) {
          return new Response(JSON.stringify({ error: configError.message }), { status: 500 });
        }

        // In-memory geocoding cache for this run
        const cepCache = new Map<string, GeocodingResult | null>();

        const results: any[] = [];
        let pendingGlobal = 0;

        for (const config of configs ?? []) {
          try {
            if (!config.url || config.url.trim() === '') {
              results.push({ name: config.name, status: 'skipped', reason: 'URL is empty' });
              continue;
            }

            let url = config.url;
            if (url.includes("docs.google.com/spreadsheets") && !url.includes("export=csv")) {
              const match = url.match(/\/d\/([^\/]+)/);
              if (match) {
                url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
              }
            }

            const csvResponse = await fetch(url);
            const csvText = await csvResponse.text();

            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            const rows = parsed.data as any[];
            const mapping = config.column_mapping as any;

            // Load already-imported row hashes so re-runs resume instead of restarting
            const existing = new Set<string>();
            for (let from = 0; ; from += 1000) {
              const { data: page } = await supabase
                .from('health_events')
                .select('row_hash')
                .eq('spreadsheet_id', config.id)
                .range(from, from + 999);
              if (!page || page.length === 0) break;
              page.forEach((r: any) => existing.add(r.row_hash));
              if (page.length < 1000) break;
            }

            let addedCount = 0;
            let pending = 0;
            let timedOut = false;

            for (const row of rows) {
              const rowHash = createHash('md5').update(JSON.stringify(row)).digest('hex');
              if (existing.has(rowHash)) continue;

              if (Date.now() - startedAt > TIME_BUDGET_MS) {
                timedOut = true;
                pending++;
                continue;
              }

              let lat = parseFloat(row[mapping.latitude]);
              let lon = parseFloat(row[mapping.longitude]);
              const cep = row[mapping.cep];
              const cleanCEP = cep ? String(cep).replace(/\D/g, '') : '';

              if (config.auto_geocode && (isNaN(lat) || isNaN(lon))) {
                let geo: GeocodingResult | null = null;

                if (cleanCEP.length === 8) {
                  if (cepCache.has(cleanCEP)) {
                    geo = cepCache.get(cleanCEP)!;
                  } else {
                    const { data: cached } = await supabase
                      .from('geocoding_cache')
                      .select('latitude, longitude')
                      .eq('cep', cleanCEP)
                      .maybeSingle();

                    if (cached) {
                      geo = { latitude: cached.latitude, longitude: cached.longitude };
                    } else {
                      geo = await serverGeocodeByCEP(cleanCEP);
                      if (geo) {
                        await supabase.from('geocoding_cache').upsert({
                          cep: cleanCEP,
                          latitude: geo.latitude,
                          longitude: geo.longitude,
                          bairro: geo.bairro ?? null,
                          rua: geo.rua ?? null
                        }, { onConflict: 'cep' });
                      }
                    }
                    cepCache.set(cleanCEP, geo);
                  }
                }

                if (!geo) {
                  geo = await geocodeByAddress(row[mapping.rua], row[mapping.bairro], "Curvelo", "MG");
                }

                if (geo) {
                  lat = geo.latitude;
                  lon = geo.longitude;
                }
              }

              const { error: insertError } = await supabase
                .from('health_events')
                .upsert({
                  spreadsheet_id: config.id,
                  cep: row[mapping.cep],
                  rua: row[mapping.rua],
                  bairro: row[mapping.bairro],
                  latitude: isNaN(lat) ? 0 : lat,
                  longitude: isNaN(lon) ? 0 : lon,
                  event_date: parseEventDate(row[mapping.data]),
                  event_type: mapping.evento ? row[mapping.evento] : null,
                  raw_data: row,
                  row_hash: rowHash
                }, { onConflict: 'spreadsheet_id,row_hash' });

              if (!insertError) {
                addedCount++;
                existing.add(rowHash);
              } else {
                console.error('Insert error:', insertError);
              }
            }

            await supabase
              .from('spreadsheet_configs')
              .update({ last_sync_at: new Date().toISOString() })
              .eq('id', config.id);

            pendingGlobal += pending;
            results.push({
              name: config.name,
              totalRows: rows.length,
              added: addedCount,
              pending,
              incomplete: timedOut
            });
          } catch (e) {
            console.error(`Error processing spreadsheet ${config.name}:`, e);
            results.push({ name: config.name, error: String(e) });
          }
        }

        return new Response(JSON.stringify({ success: true, pending: pendingGlobal, results }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
});
