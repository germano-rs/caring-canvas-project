
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  bairro?: string;
  rua?: string;
}

export async function geocodeByCEP(cep: string): Promise<GeocodingResult | null> {
  const cleanCEP = cep.replace(/\D/g, "");
  if (cleanCEP.length !== 8) return null;

  try {
    // 1. Get address from ViaCEP
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    const viaCepData = await viaCepResponse.json();

    if (viaCepData.erro) return null;

    const { logradouro, bairro, localidade, uf } = viaCepData;
    
    // Helper to query Nominatim
    const queryNominatim = async (queryString: string) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString)}&limit=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'HealthHeatmapApp/1.0' }
      });
      return await response.json();
    };

    const tryQueries = [
      `${logradouro}, ${bairro}, ${localidade} - ${uf}, Brazil`,
      `${logradouro}, ${localidade} - ${uf}, Brazil`,
      `${bairro}, ${localidade} - ${uf}, Brazil`,
      `${localidade} - ${uf}, Brazil`
    ];

    for (const query of tryQueries) {
      const queryParts = query.split(',');
      if (queryParts.length > 0 && queryParts[0] && !queryParts[0].trim()) continue; // Skip if first part is empty (e.g. empty logradouro)
      
      const data = await queryNominatim(query);
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          bairro,
          rua: logradouro
        };
      }
    }

    // Fallback: search just by CEP if all else fails
    const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${cleanCEP}&country=Brazil&limit=1`;
    const fallbackResponse = await fetch(fallbackUrl, {
      headers: { 'User-Agent': 'HealthHeatmapApp/1.0' }
    });
    const fallbackData = await fallbackResponse.json();

    if (fallbackData && fallbackData.length > 0) {
      return {
        latitude: parseFloat(fallbackData[0].lat),
        longitude: parseFloat(fallbackData[0].lon),
        bairro,
        rua: logradouro
      };
    }

    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}
