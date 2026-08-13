
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
    const address = `${logradouro}, ${bairro}, ${localidade} - ${uf}, Brazil`;

    // 2. Get coordinates from Nominatim (OpenStreetMap)
    // We add a delay to respect Nominatim's usage policy if called in a loop, 
    // but for single calls it's fine.
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'HealthHeatmapApp/1.0'
      }
    });
    const nominatimData = await nominatimResponse.json();

    if (nominatimData && nominatimData.length > 0) {
      return {
        latitude: parseFloat(nominatimData[0].lat),
        longitude: parseFloat(nominatimData[0].lon),
        bairro,
        rua: logradouro
      };
    }

    // Fallback: search just by CEP if full address fails
    const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${cleanCEP}&country=Brazil&limit=1`;
    const fallbackResponse = await fetch(fallbackUrl, {
      headers: {
        'User-Agent': 'HealthHeatmapApp/1.0'
      }
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
