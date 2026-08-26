CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'default',
  geocoding_provider text NOT NULL DEFAULT 'osm',
  map_provider text NOT NULL DEFAULT 'leaflet',
  google_maps_api_key text,
  google_geocoding_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO anon;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert app settings" ON public.app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update app settings" ON public.app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;