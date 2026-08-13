CREATE TABLE public.geocoding_cache (
  cep TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  bairro TEXT,
  rua TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.geocoding_cache TO authenticated;
GRANT ALL ON public.geocoding_cache TO service_role;

ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated to read cache" ON public.geocoding_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert into cache" ON public.geocoding_cache
  FOR INSERT TO authenticated WITH CHECK (true);
