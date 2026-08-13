# Plan: Multi-spreadsheet Dashboard with Hourly Sync and Heatmap Comparison

This plan refactors the application to support multiple Google Sheets, persistent storage in Lovable Cloud (Supabase), hourly synchronization via a background job, and a comparison view for heatmaps.

## User Review Required

> [!IMPORTANT]
> - **Backend Required**: I will enable Lovable Cloud to store spreadsheet configurations and processed health event data.
> - **Job Security**: The hourly job will be a TanStack server route called by `pg_cron`. It will be authenticated using the Supabase anon key.
> - **Data Persistence**: Instead of parsing CSV on every page load, the job will fetch CSVs, geocode missing coordinates (via ViaCEP + Nominatim), and save records to the database.

## Technical Details

### 1. Database Schema
Create tables for:
- `spreadsheet_configs`: `id`, `name`, `url`, `column_mapping` (JSON), `last_sync_at`.
- `health_events`: `id`, `spreadsheet_id`, `cep`, `rua`, `bairro`, `latitude`, `longitude`, `event_date`, `event_type`, `raw_data` (JSON).

### 2. Hourly Sync Job
Create a server route `src/routes/api/public/hooks/sync-spreadsheets.ts`:
- Loops through all `spreadsheet_configs`.
- Fetches and parses each CSV.
- Geocodes records missing coordinates.
- Upserts records into `health_events` (using a unique hash of the row data to avoid duplicates).

### 3. Updated UI
- **Config Page**: Manage multiple spreadsheet URLs instead of just one.
- **Dashboard**: 
  - Select one or two spreadsheets/periods to visualize.
  - "Comparison Mode": Display two Leaflet maps side-by-side.
  - Fetch data from the database using server functions instead of direct CSV parsing.

### 4. Geocoding
- Move the geocoding logic to a server-safe utility (it already is, but ensure it works within the server route).
