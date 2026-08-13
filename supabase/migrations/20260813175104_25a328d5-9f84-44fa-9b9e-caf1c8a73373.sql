
-- Create spreadsheet_configs table
CREATE TABLE public.spreadsheet_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    column_mapping JSONB NOT NULL DEFAULT '{
        "cep": "cep",
        "rua": "rua",
        "bairro": "bairro",
        "longitude": "longitude",
        "latitude": "latitude",
        "data": "data",
        "evento": "evento"
    }'::jsonb,
    auto_geocode BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create health_events table
CREATE TABLE public.health_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spreadsheet_id UUID REFERENCES public.spreadsheet_configs(id) ON DELETE CASCADE NOT NULL,
    cep TEXT,
    rua TEXT,
    bairro TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    event_type TEXT,
    raw_data JSONB NOT NULL,
    row_hash TEXT NOT NULL, -- To avoid duplicates from the same spreadsheet
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(spreadsheet_id, row_hash)
);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spreadsheet_configs TO authenticated;
GRANT ALL ON public.spreadsheet_configs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_events TO authenticated;
GRANT ALL ON public.health_events TO service_role;

-- Enable RLS
ALTER TABLE public.spreadsheet_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;

-- Policies (Allow all authenticated users for now, can be restricted later)
CREATE POLICY "Allow authenticated select on configs" ON public.spreadsheet_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on configs" ON public.spreadsheet_configs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on configs" ON public.spreadsheet_configs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on configs" ON public.spreadsheet_configs FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated select on events" ON public.health_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on events" ON public.health_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on events" ON public.health_events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on events" ON public.health_events FOR DELETE TO authenticated USING (true);
