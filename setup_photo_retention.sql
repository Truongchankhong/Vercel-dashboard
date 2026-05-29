-- 1. Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_photos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with creator privileges (bypass RLS to delete files)
AS $$
BEGIN
    -- A. Delete files from storage.objects (this triggers Supabase to delete the actual physical files from storage)
    DELETE FROM storage.objects 
    WHERE bucket_id = 'photos' 
      AND created_at < NOW() - INTERVAL '7 months';

    -- B. Nullify image_url in crosscheck_sample table for records older than 7 months
    UPDATE public.crosscheck_sample 
    SET image_url = NULL 
    WHERE created_at < NOW() - INTERVAL '7 months' 
      AND image_url IS NOT NULL;

    -- C. Nullify image_url in test_lab table for records older than 7 months
    UPDATE public.test_lab 
    SET image_url = NULL 
    WHERE created_at < NOW() - INTERVAL '7 months' 
      AND image_url IS NOT NULL;
END;
$$;

-- 3. Schedule the cron job (runs every day at midnight 00:00 UTC)
-- We unschedule safely only if the job already exists to avoid throwing an error.
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'daily-cleanup-old-photos';

SELECT cron.schedule(
    'daily-cleanup-old-photos',
    '0 0 * * *',
    'SELECT public.cleanup_old_photos();'
);
