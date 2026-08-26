CREATE TABLE public.event_geocode_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.health_events(id) ON DELETE CASCADE,
  geo_source text,
  geo_provider text,
  query_payload jsonb,
  api_response jsonb,
  found_address text,
  latitude double precision,
  longitude double precision,
  location_found boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_geocode_history_event ON public.event_geocode_history (event_id, created_at DESC);

GRANT SELECT, INSERT ON public.event_geocode_history TO anon;
GRANT SELECT, INSERT ON public.event_geocode_history TO authenticated;
GRANT ALL ON public.event_geocode_history TO service_role;

ALTER TABLE public.event_geocode_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read geocode history"
ON public.event_geocode_history FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert geocode history"
ON public.event_geocode_history FOR INSERT TO anon, authenticated WITH CHECK (true);