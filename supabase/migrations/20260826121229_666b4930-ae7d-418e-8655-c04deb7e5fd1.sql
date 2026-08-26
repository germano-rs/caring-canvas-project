ALTER TABLE public.spreadsheet_configs
ADD COLUMN IF NOT EXISTS last_row_count integer NOT NULL DEFAULT 0;