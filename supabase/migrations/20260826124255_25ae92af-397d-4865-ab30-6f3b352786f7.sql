REVOKE EXECUTE ON FUNCTION public.acquire_sync_lock(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.renew_sync_lock(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_sync_lock(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_job_progress(uuid, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_sync_lock(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_sync_lock(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_sync_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_job_progress(uuid, integer, integer, integer) TO service_role;