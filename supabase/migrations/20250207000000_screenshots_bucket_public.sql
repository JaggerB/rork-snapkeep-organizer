-- Make screenshots bucket public so image URLs work in the app
-- Run this in Supabase SQL Editor if migrations aren't applied: Supabase Dashboard → SQL Editor

-- Create bucket if not exists, set to public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screenshots',
  'screenshots',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read (anyone can view images via URL)
DROP POLICY IF EXISTS "Public read screenshots" ON storage.objects;
CREATE POLICY "Public read screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "Users upload own screenshots" ON storage.objects;
CREATE POLICY "Users upload own screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
