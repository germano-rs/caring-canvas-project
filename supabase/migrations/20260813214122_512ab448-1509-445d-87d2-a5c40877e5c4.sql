-- Tabela de Painéis (Dashboards Salvos)
CREATE TABLE public.saved_panels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    config_id UUID REFERENCES public.spreadsheet_configs(id) ON DELETE SET NULL,
    is_comparison BOOLEAN DEFAULT FALSE,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissões
GRANT ALL ON public.saved_panels TO authenticated;
GRANT ALL ON public.saved_panels TO service_role;
GRANT ALL ON public.saved_panels TO anon;

-- RLS
ALTER TABLE public.saved_panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to saved_panels" 
ON public.saved_panels 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);
