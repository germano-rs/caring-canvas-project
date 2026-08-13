import { supabase } from "@/integrations/supabase/client";

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  bairro?: string | null;
  rua?: string | null;
}

// Helper to query Nominatim
export async function queryNominatim(queryString: string): Promise<any> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString)}&limit=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'HealthHeatmapApp/1.0' }
  });
  return await response.json();
}

export async function geocodeByAddress(rua?: string, bairro?: string, cidade: string = "Curvelo", uf: string = "MG"): Promise<GeocodingResult | null> {
  const tryQueries = [];
  
  if (rua && bairro) tryQueries.push(`${rua}, ${bairro}, ${cidade} - ${uf}, Brazil`);
  if (rua) tryQueries.push(`${rua}, ${cidade} - ${uf}, Brazil`);
  if (bairro) tryQueries.push(`${bairro}, ${cidade} - ${uf}, Brazil`);
  tryQueries.push(`${cidade} - ${uf}, Brazil`);

  for (const query of tryQueries) {
    const data = await queryNominatim(query);
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
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${cleanCEP}&country=Brazil&limit=1`;
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: { 'User-Agent': 'HealthHeatmapApp/1.0' }
      });
      const fallbackData = await fallbackResponse.json();

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
