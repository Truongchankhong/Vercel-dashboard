-- 1. Add image_url column to crosscheck_sample table if not exists
ALTER TABLE public.crosscheck_sample 
ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Add image_url column to test_lab table if not exists
ALTER TABLE public.test_lab 
ADD COLUMN IF NOT EXISTS image_url text;

-- 3. Create Supabase Storage Bucket 'photos' if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable public row-level security policies for the 'photos' bucket
-- These ensure that anyone (anon) can view, upload, or delete images in the 'photos' bucket.
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'photos');
CREATE POLICY "Public Insert Access" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Public Delete Access" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'photos');
