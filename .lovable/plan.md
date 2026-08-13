---
title: Health Heatmap Dashboard Development
description: Create a health event heatmap dashboard for Curvelo/MG connected to Google Sheets.
---

# Plan - Health Heatmap Dashboard

Build a dashboard that visualizes health event notifications in Curvelo/MG using data from a Google Spreadsheet.

## User Review Required

> [!IMPORTANT]
> The application will require a publicly shared Google Spreadsheet link (CSV format) to function. Users must ensure their spreadsheet has the following columns: `cep`, `rua`, `bairro`, `longitude`, `latitude`, `data`, and optionally `evento`.

## Proposed Changes

### Configuration & Setup
- Add `leaflet`, `react-leaflet`, and `lucide-react` for maps and icons.
- Create a configuration store (using `localStorage` for now, or Lovable Cloud if persistence is needed later) to save the Spreadsheet URL and column mappings.

### Routes & Navigation
- **`/` (Dashboard)**: The main heatmap visualization for Curvelo/MG.
- **`/config`**: Configuration screen to input the Google Sheets URL and define field mappings.

### Components
- **Map View**: Heatmap implementation using Leaflet.
- **Data Fetching**: Service to fetch and parse CSV data from Google Sheets.
- **Field Mapper**: UI to associate spreadsheet columns with required application fields.

### Security & Compliance
- Basic validation for required fields (`cep`, `rua`, `bairro`, `longitude`, `latitude`, `data`).

## Technical Details

### Dependencies
- `leaflet`, `react-leaflet` (Map visualization)
- `papaparse` (CSV parsing)
- `zod` (Data validation)
- `lucide-react` (UI icons)

### Implementation Steps
1. **Initialize Layout**: Setup a basic navigation sidebar/header in `__root.tsx`.
2. **Config Page**: Build the form to accept Google Sheets URL and test the connection.
3. **Data Layer**: Implement a hook to fetch and cache spreadsheet data.
4. **Heatmap Component**: Integrate Leaflet with a heatmap plugin or density markers.
5. **Dashboard**: Assemble the map and key metrics (total cases, most affected neighborhoods).
