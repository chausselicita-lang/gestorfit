-- ============================================================
-- GESTORFIT — CORREÇÃO DE POLÍTICAS RLS
-- Cole este arquivo no Supabase SQL Editor e clique em Run
-- ============================================================

-- Recriar políticas com WITH CHECK explícito para suportar INSERT/UPDATE
-- (sem WITH CHECK, INSERT falha mesmo com USING correto)

DROP POLICY IF EXISTS "academia_owner"          ON academias;
DROP POLICY IF EXISTS "alunos_por_academia"     ON alunos;
DROP POLICY IF EXISTS "pagamentos_por_academia" ON pagamentos;
DROP POLICY IF EXISTS "planos_por_academia"     ON planos_academia;
DROP POLICY IF EXISTS "notificacoes_por_academia" ON notificacoes;
DROP POLICY IF EXISTS "frequencias_por_academia"  ON frequencias;

CREATE POLICY "academia_owner" ON academias
  FOR ALL
  USING     (usuario_id = auth.uid())
  WITH CHECK(usuario_id = auth.uid());

CREATE POLICY "alunos_por_academia" ON alunos
  FOR ALL
  USING     (academia_id = get_my_academia_id())
  WITH CHECK(academia_id = get_my_academia_id());

CREATE POLICY "pagamentos_por_academia" ON pagamentos
  FOR ALL
  USING     (academia_id = get_my_academia_id())
  WITH CHECK(academia_id = get_my_academia_id());

CREATE POLICY "pagamentos_verificacao_publica" ON pagamentos
  FOR SELECT TO anon
  USING (codigo_verificacao IS NOT NULL);

CREATE POLICY "planos_por_academia" ON planos_academia
  FOR ALL
  USING     (academia_id = get_my_academia_id())
  WITH CHECK(academia_id = get_my_academia_id());

CREATE POLICY "notificacoes_por_academia" ON notificacoes
  FOR ALL
  USING     (academia_id = get_my_academia_id())
  WITH CHECK(academia_id = get_my_academia_id());

CREATE POLICY "frequencias_por_academia" ON frequencias
  FOR ALL
  USING     (academia_id = get_my_academia_id())
  WITH CHECK(academia_id = get_my_academia_id());

-- Recarregar o schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificar se o usuario_id da academia está correto
SELECT id, nome, usuario_id FROM academias LIMIT 5;
