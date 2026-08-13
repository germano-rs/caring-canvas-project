-- Create sync_jobs table
CREATE TABLE IF NOT EXISTS public.sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spreadsheet_id UUID REFERENCES public.spreadsheet_configs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, running, completed, failed
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create sync_job_items table for the queue
CREATE TABLE IF NOT EXISTS public.sync_job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.sync_jobs(id) ON DELETE CASCADE,
    spreadsheet_id UUID REFERENCES public.spreadsheet_configs(id) ON DELETE CASCADE,
    row_data JSONB NOT NULL,
    row_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    error TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_jobs TO authenticated;
GRANT ALL ON public.sync_jobs TO service_role;
GRANT SELECT ON public.sync_jobs TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_job_items TO authenticated;
GRANT ALL ON public.sync_job_items TO service_role;
GRANT SELECT ON public.sync_job_items TO anon;

-- RLS
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_job_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to be safe)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public read for sync_jobs" ON public.sync_jobs;
    DROP POLICY IF EXISTS "Service role full access for sync_jobs" ON public.sync_jobs;
    DROP POLICY IF EXISTS "Public read for sync_job_items" ON public.sync_job_items;
    DROP POLICY IF EXISTS "Service role full access for sync_job_items" ON public.sync_job_items;
END
$$;

CREATE POLICY "Public read for sync_jobs" ON public.sync_jobs FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access for sync_jobs" ON public.sync_jobs FOR ALL TO service_role USING (true);

CREATE POLICY "Public read for sync_job_items" ON public.sync_job_items FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access for sync_job_items" ON public.sync_job_items FOR ALL TO service_role USING (true);
