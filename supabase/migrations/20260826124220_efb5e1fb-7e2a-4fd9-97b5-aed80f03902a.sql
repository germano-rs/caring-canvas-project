-- 1. Remove duplicatas existentes mantendo o registro mais antigo
DELETE FROM public.health_events he
USING public.health_events dup
WHERE he.spreadsheet_id = dup.spreadsheet_id
  AND he.row_hash = dup.row_hash
  AND he.ctid > dup.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS health_events_spreadsheet_row_hash_key
  ON public.health_events (spreadsheet_id, row_hash);

-- 2. Colunas de lock
ALTER TABLE public.spreadsheet_configs
  ADD COLUMN IF NOT EXISTS sync_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_lock_owner text;

-- 3. Funções de lock atômico (expira em 10 minutos)
CREATE OR REPLACE FUNCTION public.acquire_sync_lock(p_config_id uuid, p_owner text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.spreadsheet_configs
  SET sync_locked_at = now(), sync_lock_owner = p_owner
  WHERE id = p_config_id
    AND (sync_locked_at IS NULL OR sync_locked_at < now() - interval '10 minutes');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_sync_lock(p_config_id uuid, p_owner text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.spreadsheet_configs
  SET sync_locked_at = now()
  WHERE id = p_config_id AND sync_lock_owner = p_owner;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_sync_lock(p_config_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.spreadsheet_configs
  SET sync_locked_at = NULL, sync_lock_owner = NULL
  WHERE id = p_config_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_sync_lock(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.renew_sync_lock(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_sync_lock(uuid) TO anon, authenticated, service_role;