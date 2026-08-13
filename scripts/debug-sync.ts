import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { createHash } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSync() {
  const { data: configs } = await supabase.from('spreadsheet_configs').select('*');
  console.log('Configs:', configs.map(c => ({ id: c.id, name: c.name, mapping: c.column_mapping })));
  
  for (const config of configs) {
    if (!config.url) continue;
    console.log(`Syncing ${config.name}...`);
    
    let url = config.url;
    if (url.includes("docs.google.com/spreadsheets") && !url.includes("export=csv")) {
      const match = url.match(/\/d\/([^\/]+)/);
      if (match) url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    }

    const res = await fetch(url);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    
    console.log('CSV Headers:', Object.keys(parsed.data[0]));
    console.log('Mapping:', config.column_mapping);
    
    const mapping = config.column_mapping;
    let added = 0;
    
    for (const row of parsed.data) {
      const cep = row[mapping.cep];
      const date = row[mapping.data];
      console.log(`Row CEP: ${cep}, Date: ${date} (using mapping cep: ${mapping.cep}, data: ${mapping.data})`);
      
      // We won't actually insert here, just testing logic
    }
  }
}

runSync();
