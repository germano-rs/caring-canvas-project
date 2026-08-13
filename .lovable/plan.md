# Plan: Add CEP Geocoding via ViaCEP API

This plan adds a script/helper to automatically fetch latitude and longitude based on a CEP (postal code) using the public ViaCEP API for address details, combined with a geocoding strategy.

## User Review Required

> [!IMPORTANT]
> The ViaCEP API provides the address (street, neighborhood, city) but **does not provide latitude and longitude coordinates**. To get coordinates from a CEP, we typically need a geocoding service like Nominatim (OpenStreetMap) or Google Maps. I will implement a solution that first gets the address from ViaCEP and then geocodes it using Nominatim (free).

- **API Choice**: ViaCEP for address details + Nominatim for coordinates.
- **Workflow**: A new helper function will be added to `src/lib/data-service.ts` or a new `src/lib/geocoding.ts`.

## Technical Details

### 1. New Geocoding Service
Create `src/lib/geocoding.ts` to handle:
- Fetching address from `https://viacep.com.br/ws/{cep}/json/`.
- Fetching coordinates from Nominatim `https://nominatim.openstreetmap.org/search?format=json&q={address}`.

### 2. Update Configuration
- Add a toggle in `src/routes/config.tsx` to "Enable Auto-Geocoding by CEP" if coordinates are missing in the spreadsheet.

### 3. Data Processing Integration
- Update `fetchSpreadsheetData` in `src/lib/data-service.ts` to optionally fill missing latitude/longitude using the new geocoding service.

### 4. UI Feedback
- Add a button in the Config page to "Test CEP Geocoding".
