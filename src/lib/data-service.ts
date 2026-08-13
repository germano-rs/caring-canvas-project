import Papa from "papaparse";
import { getConfig } from "./config";

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
      complete: (results) => {
        const mapping = config.columnMapping;
        const data = results.data.map((row: any) => ({
          cep: row[mapping.cep],
          rua: row[mapping.rua],
          bairro: row[mapping.bairro],
          longitude: parseFloat(row[mapping.longitude]),
          latitude: parseFloat(row[mapping.latitude]),
          data: row[mapping.data],
          evento: mapping.evento ? row[mapping.evento] : undefined,
          ...row,
        })).filter(item => !isNaN(item.latitude) && !isNaN(item.longitude));
        
        resolve(data);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
