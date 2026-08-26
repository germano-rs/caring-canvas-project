REVOKE EXECUTE ON FUNCTION public.acquire_sync_lock(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.renew_sync_lock(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_sync_lock(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_job_progress(uuid, integer, integer, integer) FROM anon, authenticated;
ALTER FUNCTION public.increment_job_progress(uuid, integer, integer, integer) SET search_path = public;