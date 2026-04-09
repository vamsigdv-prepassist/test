-- Initialize the Supabase Storage Bucket for User Raw Notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('cloud_vault', 'cloud_vault', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to all notes
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'cloud_vault');

-- Allow authenticated users to upload files
CREATE POLICY "Auth Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cloud_vault' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Auth Delete Access"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cloud_vault' 
  AND auth.role() = 'authenticated'
);
