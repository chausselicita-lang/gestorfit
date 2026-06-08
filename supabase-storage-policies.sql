-- ============================================================
-- GESTORFIT — Storage Policies para bucket 'avatars'
-- Cole no Supabase SQL Editor e clique em Run (uma única vez)
-- O bucket 'avatars' já foi criado automaticamente.
-- ============================================================

-- Leitura pública (qualquer pessoa pode ver avatars)
DROP POLICY IF EXISTS "avatars_public_read"  ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Upload: usuário autenticado só pode subir na própria pasta
DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
CREATE POLICY "avatars_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Atualização da própria foto
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Exclusão da própria foto
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;
CREATE POLICY "avatars_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

NOTIFY pgrst, 'reload schema';
