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
  const tryQueries = [];
  
  if (rua && bairro) tryQueries.push(`${rua}, ${bairro}, ${cidade} - ${uf}, Brazil`);
  if (rua) tryQueries.push(`${rua}, ${cidade} - ${uf}, Brazil`);
  if (bairro) tryQueries.push(`${bairro}, ${cidade} - ${uf}, Brazil`);
  tryQueries.push(`${cidade} - ${uf}, Brazil`);

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


// Server-side route for syncing spreadsheets
export const Route = createFileRoute('/api/public/hooks/sync-spreadsheets')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        console.log('SYNC ENDPOINT CALLED');
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        // Use service role key if available for system sync, otherwise fallback to provided token or anon key
        const supabaseUrl = process.env['VITE_SUPABASE_URL']!;
        const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || token || process.env['VITE_SUPABASE_ANON_KEY']!;

        const supabase = createClient(
          supabaseUrl,
          supabaseKey,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        );

        // 1. Fetch all spreadsheet configs
        const { data: configs, error: configError } = await supabase
          .from('spreadsheet_configs')
          .select('*');

        if (configError) {
          console.error('Error fetching configs:', configError);
          return new Response(JSON.stringify({ error: configError.message }), { status: 500 });
        }

        const results = [];

        for (const config of configs) {
          try {
            if (!config.url || config.url.trim() === '') {
              results.push({ name: config.name, status: 'skipped', reason: 'URL is empty' });
              continue;
            }

            // Convert Google Sheets URL to CSV
            let url = config.url;
            if (url.includes("docs.google.com/spreadsheets") && !url.includes("export=csv")) {
              const match = url.match(/\/d\/([^\/]+)/);
              if (match) {
                url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
              }
            }

            // Fetch CSV
            const csvResponse = await fetch(url);
            const csvText = await csvResponse.text();

            const parsed = Papa.parse(csvText, {
              header: true,
              skipEmptyLines: true,
            });

            const mapping = config.column_mapping;
            console.log(`Syncing ${config.name} with mapping:`, mapping);
            let addedCount = 0;

            for (const row of parsed.data as any[]) {
              // Create a hash of the row to avoid duplicates
              const rowString = JSON.stringify(row);
              const rowHash = createHash('md5').update(rowString).digest('hex');

              let lat = parseFloat(row[mapping.latitude]);
              let lon = parseFloat(row[mapping.longitude]);
              const cep = row[mapping.cep];
              console.log(`Row:`, row, `CEP from mapping '${mapping.cep}':`, cep);

              // Auto-geocode if missing
              if (config.auto_geocode && (isNaN(lat) || isNaN(lon)) && cep) {
                const geo = await serverGeocodeByCEP(cep);
                if (geo) {
                  lat = geo.latitude;
                  lon = geo.longitude;
                } else {
                  // Final fallback: try geocoding by street/neighborhood names directly from the spreadsheet row if CEP failed
                  const fallbackGeo = await geocodeByAddress(
                    row[mapping.rua],
                    row[mapping.bairro],
                    "Curvelo", // Default city
                    "MG"      // Default UF
                  );
                  if (fallbackGeo) {
                    lat = fallbackGeo.latitude;
                    lon = fallbackGeo.longitude;
                  }
                }
              }

              if (!isNaN(lat) && !isNaN(lon)) {
                console.log(`Upserting row with lat: ${lat}, lon: ${lon}`);
                const { error: insertError } = await supabase
                  .from('health_events')
                  .upsert({
                    spreadsheet_id: config.id,
                    cep: row[mapping.cep],
                    rua: row[mapping.rua],
                    bairro: row[mapping.bairro],
                    latitude: lat,
                    longitude: lon,
                    event_date: new Date(row[mapping.data]).toISOString(),
                    event_type: mapping.evento ? row[mapping.evento] : null,
                    raw_data: row,
                    row_hash: rowHash
                  }, {
                    onConflict: 'spreadsheet_id,row_hash'
                  });

                if (!insertError) addedCount++;
              }
            }

            await supabase
              .from('spreadsheet_configs')
              .update({ last_sync_at: new Date().toISOString() })
              .eq('id', config.id);

            results.push({ name: config.name, added: addedCount });
          } catch (e) {
            console.error(`Error processing spreadsheet ${config.name}:`, e);
            results.push({ name: config.name, error: String(e) });
          }
        }

        return new Response(JSON.stringify({ success: true, results }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
});
