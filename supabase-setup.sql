-- ============================================================
-- GESTORFIT — SCRIPT DE CONFIGURAÇÃO COMPLETO
-- Cole este arquivo no Supabase SQL Editor e clique em Run
-- ✅ Todos os valores já estão preenchidos automaticamente
-- ============================================================

-- ============================================================
-- 1. ADICIONAR usuario_id NA TABELA ACADEMIAS
-- ============================================================

ALTER TABLE academias
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users(id);

-- ============================================================
-- 2. INSERIR ACADEMIA
-- ============================================================

INSERT INTO academias (nome, telefone, email, usuario_id)
VALUES (
  'GestorFit Academia',
  '(77) 99999-9999',
  'chausselicita@gmail.com',
  '32b5f22d-3f42-480b-82d2-a0918ba1dbbc'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. INSERIR PLANOS PADRÃO
-- ============================================================

INSERT INTO planos_academia (academia_id, nome, duracao_dias, valor, descricao)
SELECT
  a.id,
  p.nome,
  p.duracao_dias,
  p.valor,
  p.descricao
FROM academias a
CROSS JOIN (VALUES
  ('Mensal',     30,  89.90,  'Plano mensal renovável'),
  ('Trimestral', 90,  239.90, 'Plano trimestral com desconto'),
  ('Anual',      365, 799.90, 'Plano anual — melhor custo-benefício')
) AS p(nome, duracao_dias, valor, descricao)
WHERE a.usuario_id = '32b5f22d-3f42-480b-82d2-a0918ba1dbbc'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3b. TABELA DE FREQUÊNCIAS (check-in diário)
-- ============================================================

CREATE TABLE IF NOT EXISTS frequencias (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id    UUID REFERENCES alunos(id) ON DELETE CASCADE NOT NULL,
  academia_id UUID REFERENCES academias(id) ON DELETE CASCADE NOT NULL,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(aluno_id, data)
);

ALTER TABLE frequencias ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. FUNÇÃO AUXILIAR — retorna academia_id do usuário logado
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_academia_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM academias WHERE usuario_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 5. REMOVER POLÍTICAS RLS ANTIGAS
-- ============================================================

DROP POLICY IF EXISTS "Acesso total autenticado" ON academias;
DROP POLICY IF EXISTS "Acesso total autenticado" ON alunos;
DROP POLICY IF EXISTS "Acesso total autenticado" ON pagamentos;
DROP POLICY IF EXISTS "Acesso total autenticado" ON planos_academia;
DROP POLICY IF EXISTS "Acesso total autenticado" ON notificacoes;

-- ============================================================
-- 6. POLÍTICAS RLS POR ACADEMIA (multi-tenant seguro)
-- ============================================================

CREATE POLICY "academia_owner" ON academias
  FOR ALL USING (usuario_id = auth.uid());

CREATE POLICY "alunos_por_academia" ON alunos
  FOR ALL USING (academia_id = get_my_academia_id());

CREATE POLICY "pagamentos_por_academia" ON pagamentos
  FOR ALL USING (academia_id = get_my_academia_id());

CREATE POLICY "pagamentos_verificacao_publica" ON pagamentos
  FOR SELECT TO anon
  USING (codigo_verificacao IS NOT NULL);

CREATE POLICY "planos_por_academia" ON planos_academia
  FOR ALL USING (academia_id = get_my_academia_id());

CREATE POLICY "notificacoes_por_academia" ON notificacoes
  FOR ALL USING (academia_id = get_my_academia_id());

CREATE POLICY "frequencias_por_academia" ON frequencias
  FOR ALL USING (academia_id = get_my_academia_id());

-- ============================================================
-- 7. VERIFICAÇÃO FINAL
-- ============================================================

SELECT
  'academias'       AS tabela, COUNT(*) AS registros FROM academias
UNION ALL SELECT 'planos_academia', COUNT(*) FROM planos_academia
UNION ALL SELECT 'alunos',          COUNT(*) FROM alunos
UNION ALL SELECT 'pagamentos',      COUNT(*) FROM pagamentos;
