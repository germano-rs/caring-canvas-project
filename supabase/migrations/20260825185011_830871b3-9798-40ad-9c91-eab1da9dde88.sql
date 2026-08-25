TRUNCATE public.health_events;
TRUNCATE public.sync_job_items;

ALTER TABLE public.health_events
  ADD COLUMN IF NOT EXISTS numero_notificacao text,
  ADD COLUMN IF NOT EXISTS tipo_notificacao text,
  ADD COLUMN IF NOT EXISTS ano_notificacao text,
  ADD COLUMN IF NOT EXISTS id_unidade text,
  ADD COLUMN IF NOT EXISTS data_nascimento text,
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS gestante text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS location_found boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_health_events_location_found ON public.health_events(location_found);