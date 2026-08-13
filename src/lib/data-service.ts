import Papa from "papaparse";
import { getConfig } from "./config";
import { geocodeByCEP } from "./geocoding";

export interface HealthData {
  cep: string;
  rua: string;
  bairro: string;
  longitude: number;
  latitude: number;
  data: string;
  evento?: string;
  [key: string]: any;
}

export async function fetchSpreadsheetData(): Promise<HealthData[]> {
  const config = getConfig();
  if (!config.spreadsheetUrl) {
    return [];
  }

  // Convert Google Sheets URL to export=csv if it's a share link
  let url = config.spreadsheetUrl;
  if (url.includes("docs.google.com/spreadsheets") && !url.includes("export=csv")) {
    const match = url.match(/\/d\/([^\/]+)/);
    if (match) {
      url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    }
  }

  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const mapping = config.columnMapping;
        const rawData = results.data;
        
        const processedData = await Promise.all(
          rawData.map(async (row: any) => {
            let lat = parseFloat(row[mapping.latitude]);
            let lon = parseFloat(row[mapping.longitude]);
            const cep = row[mapping.cep];

            // Auto-geocode if coordinates are missing and feature is enabled
            if (config.autoGeocode && (isNaN(lat) || isNaN(lon)) && cep) {
              const geo = await geocodeByCEP(cep);
              if (geo) {
                lat = geo.latitude;
                lon = geo.longitude;
              }
            }

            return {
              cep: row[mapping.cep],
              rua: row[mapping.rua],
              bairro: row[mapping.bairro],
              longitude: lon,
              latitude: lat,
              data: row[mapping.data],
              evento: mapping.evento ? row[mapping.evento] : undefined,
              ...row,
            };
          })
        );

        const data = processedData.filter(
          (item: any) => !isNaN(item.latitude) && !isNaN(item.longitude)
        );
        
        resolve(data as HealthData[]);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
