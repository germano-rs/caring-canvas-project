CREATE OR REPLACE FUNCTION public.increment_job_progress(job_id UUID, p_inc INTEGER, i_inc INTEGER, f_inc INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.sync_jobs
  SET 
    processed_rows = processed_rows + p_inc,
    imported_rows = imported_rows + i_inc,
    failed_rows = failed_rows + f_inc
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
