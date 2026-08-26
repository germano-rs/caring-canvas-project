import { supabase } from "@/integrations/supabase/client";
import { fetchAppSettings } from "@/lib/settings";

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  bairro?: string | null;
  rua?: string | null;
}

// Helper for exponential backoff sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to query Nominatim with rate limiting and exponential backoff
export async function queryNominatim(queryString: string, retries = 3, backoff = 1000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString)}&limit=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'HealthHeatmapApp/1.0' }
      });
      
      if (response.status === 429) { // Rate limit hit
        console.warn(`Nominatim rate limit hit, retrying in ${backoff}ms...`);
        await sleep(backoff);
        backoff *= 2;
        continue;
      }

      if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Nominatim query failed (attempt ${i + 1}):`, error);
      if (i === retries - 1) return null;
      await sleep(backoff);
      backoff *= 2;
    }
  }
  return null;
}

// Helper to query Photon with rate limiting and exponential backoff
export async function queryPhoton(queryString: string, retries = 3, backoff = 1000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(queryString)}&limit=1`;
      const response = await fetch(url);
      
      if (response.status === 429) { // Rate limit hit
        console.warn(`Photon rate limit hit, retrying in ${backoff}ms...`);
        await sleep(backoff);
        backoff *= 2;
        continue;
      }

      if (!response.ok) throw new Error(`Photon error: ${response.status}`);
      const data = await response.json();
      if (data && data.features && data.features.length > 0) {
        const feat = data.features[0];
        return [{
          lat: feat.geometry.coordinates[1],
          lon: feat.geometry.coordinates[0]
        }];
      }
      return null;
    } catch (error) {
      console.error(`Photon query failed (attempt ${i + 1}):`, error);
      if (i === retries - 1) return null;
      await sleep(backoff);
      backoff *= 2;
    }
  }
  return null;
}


// Google Geocoding API (usado quando selecionado na área de Administrador)
export async function queryGoogleGeocoding(queryString: string, apiKey: string): Promise<any> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryString)}&region=br&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.length) {
      if (data.status && data.status !== 'ZERO_RESULTS') {
        console.warn(`Google Geocoding: ${data.status} ${data.error_message ?? ''}`);
      }
      return null;
    }
    const loc = data.results[0].geometry.location;
    return [{ lat: loc.lat, lon: loc.lng }];
  } catch (error) {
    console.error('Google Geocoding query failed:', error);
    return null;
  }
}

// Resolve a consulta usando o provedor configurado, com fallback para o outro provedor
export async function runGeocodingQuery(queryString: string): Promise<any> {
  let provider = 'osm';
  let googleKey: string | null = null;
  try {
    const settings = await fetchAppSettings();
    provider = settings.geocoding_provider;
    googleKey = settings.google_geocoding_api_key || settings.google_maps_api_key || null;
  } catch (e) {
    // segue com o provedor padrão
  }

  if (provider === 'google' && googleKey) {
    const data = await queryGoogleGeocoding(queryString, googleKey);
    if (data && data.length > 0) return data;
  }

  let data = await queryNominatim(queryString);
  if (!data || data.length === 0) data = await queryPhoton(queryString);
  return data;
}

// CEPs genéricos (cidade inteira): ignorar e buscar por logradouro
export const GENERIC_CEPS = new Set(["35790000"]);

export async function geocodeByAddress(rua?: string, bairro?: string, _cidade?: string, _uf?: string): Promise<GeocodingResult | null> {
  // Sempre buscar dentro de Curvelo - MG
  const cidade = "Curvelo";
  const uf = "MG";
  const cleanRua = rua?.trim() || null;
  const cleanBairro = bairro?.trim() || null;

  try {
    // 1. Check cache first
    const { data: cached } = await supabase
      .from('address_geocoding_cache')
      .select('*')
      .eq('cidade', cidade)
      .eq('uf', uf)
      .filter('rua', cleanRua === null ? 'is' : 'eq', cleanRua)
      .filter('bairro', cleanBairro === null ? 'is' : 'eq', cleanBairro)
      .maybeSingle();

    if (cached) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        bairro: cached.bairro,
        rua: cached.rua
      };
    }

    const tryQueries = [];
    if (rua && bairro) tryQueries.push(`${rua}, ${bairro}, ${cidade} - ${uf}, Brazil`);
    if (rua) tryQueries.push(`${rua}, ${cidade} - ${uf}, Brazil`);
    if (bairro) tryQueries.push(`${bairro}, ${cidade} - ${uf}, Brazil`);
    tryQueries.push(`${cidade} - ${uf}, Brazil`);

    let result: GeocodingResult | null = null;

    for (const query of tryQueries) {
      const data = await runGeocodingQuery(query);

      if (data && data.length > 0) {
        result = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          bairro: cleanBairro,
          rua: cleanRua
        };
        break;
      }
    }

    // 2. Save to cache if found
    if (result) {
      await supabase.from('address_geocoding_cache').upsert({
        rua: cleanRua,
        bairro: cleanBairro,
        cidade: cidade,
        uf: uf,
        latitude: result.latitude,
        longitude: result.longitude
      }, {
        onConflict: 'rua,bairro,cidade,uf'
      });
    }

    return result;
  } catch (error) {
    console.error("Geocoding by address error:", error);
    return null;
  }
}

export async function geocodeByCEP(cep: string): Promise<GeocodingResult | null> {
  const cleanCEP = cep.replace(/\D/g, "");
  if (cleanCEP.length !== 8) return null;

  try {
    // 1. Check cache first
    const { data: cached } = await supabase
      .from('geocoding_cache')
      .select('*')
      .eq('cep', cleanCEP)
      .maybeSingle();

    if (cached) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        bairro: cached.bairro,
        rua: cached.rua
      };
    }

    // 2. Get address from ViaCEP
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    const viaCepData = await viaCepResponse.json();

    if (!viaCepData || viaCepData.erro) return null;

    const { logradouro, bairro, localidade, uf } = viaCepData;
    
    let result = await geocodeByAddress(logradouro, bairro, localidade, uf);

    // Fallback: search just by CEP if address search failed
    if (!result) {
      // Try Nominatim by postalcode
      const fallbackData = await runGeocodingQuery(`${cleanCEP}, Brazil`);

      if (fallbackData && fallbackData.length > 0) {
        result = {
          latitude: parseFloat(fallbackData[0].lat),
          longitude: parseFloat(fallbackData[0].lon),
          bairro: (bairro as string) || null,
          rua: (logradouro as string) || null
        };
      }
    }

    // 3. Save to cache if found
    if (result) {
      await supabase.from('geocoding_cache').upsert({
        cep: cleanCEP,
        latitude: result.latitude,
        longitude: result.longitude,
        bairro: result.bairro ?? null,
        rua: result.rua ?? null
      });
    }

    return result;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}
