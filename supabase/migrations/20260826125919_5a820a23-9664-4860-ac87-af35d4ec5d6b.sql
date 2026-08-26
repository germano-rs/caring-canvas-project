ALTER TABLE public.health_events
  ADD COLUMN IF NOT EXISTS geo_source text,
  ADD COLUMN IF NOT EXISTS geo_provider text;

ALTER TABLE public.geocoding_cache ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.address_geocoding_cache ADD COLUMN IF NOT EXISTS provider text;