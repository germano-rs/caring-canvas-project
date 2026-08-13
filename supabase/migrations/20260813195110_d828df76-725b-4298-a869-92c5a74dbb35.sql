-- Create a table for geocoding by address cache
CREATE TABLE IF NOT EXISTS public.address_geocoding_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rua TEXT,
    bairro TEXT,
    cidade TEXT NOT NULL,
    uf TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Use a unique constraint to avoid duplicates. 
-- We handle NULLs by creating a unique index since UNIQUE(rua, bairro, cidade, uf) treats NULLs as distinct.
CREATE UNIQUE INDEX IF NOT EXISTS idx_address_geocoding_cache_unique 
ON public.address_geocoding_cache (
    COALESCE(rua, ''), 
    COALESCE(bairro, ''), 
    cidade, 
    uf
);

-- Grant access
GRANT SELECT, INSERT ON public.address_geocoding_cache TO authenticated;
GRANT ALL ON public.address_geocoding_cache TO service_role;

-- Enable RLS
ALTER TABLE public.address_geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable select for authenticated users" ON public.address_geocoding_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.address_geocoding_cache FOR INSERT TO authenticated WITH CHECK (true);