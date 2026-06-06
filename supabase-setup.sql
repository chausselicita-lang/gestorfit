-- ============================================================
-- GESTORFIT — SCRIPT DE CONFIGURAÇÃO COMPLETO
-- Execute no Supabase SQL Editor (em ordem)
-- ============================================================

-- ============================================================
-- PASSO 1: ANTES DE RODAR ESTE SCRIPT
-- Crie o usuário em: Authentication → Users → Add user
-- Copie o UUID gerado e substitua abaixo
-- ============================================================

-- ⚠️  SUBSTITUA ESTES DOIS VALORES:
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Substitua as variáveis no bloco abaixo!';
  RAISE NOTICE '================================================';
END $$;

-- ============================================================
-- PASSO 2: ADICIONAR usuario_id NA TABELA ACADEMIAS
-- ============================================================

ALTER TABLE academias
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users(id);

-- ============================================================
-- PASSO 3: INSERIR SUA ACADEMIA
-- Substitua os valores e o UUID do usuário
-- ============================================================

INSERT INTO academias (nome, telefone, email, usuario_id)
VALUES (
  'Nome da Sua Academia',                  -- ← troque pelo nome real
  '(77) 99999-9999',                       -- ← troque pelo telefone
  'seu@email.com',                         -- ← troque pelo e-mail
  'UUID_DO_USUARIO_AQUI'                   -- ← cole o UUID do Auth → Users
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASSO 4: INSERIR PLANOS PADRÃO
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
WHERE a.usuario_id = 'UUID_DO_USUARIO_AQUI'  -- ← mesmo UUID acima
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASSO 5: FUNÇÃO AUXILIAR — retorna o academia_id do usuário logado
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
-- PASSO 6: REMOVER POLÍTICAS RLS ANTIGAS (genéricas)
-- ============================================================

DROP POLICY IF EXISTS "Acesso total autenticado" ON academias;
DROP POLICY IF EXISTS "Acesso total autenticado" ON alunos;
DROP POLICY IF EXISTS "Acesso total autenticado" ON pagamentos;
DROP POLICY IF EXISTS "Acesso total autenticado" ON planos_academia;
DROP POLICY IF EXISTS "Acesso total autenticado" ON notificacoes;

-- ============================================================
-- PASSO 7: POLÍTICAS RLS POR ACADEMIA (multi-tenant seguro)
-- ============================================================

-- ACADEMIAS: cada usuário acessa só a sua
CREATE POLICY "academia_owner" ON academias
  FOR ALL
  USING (usuario_id = auth.uid());

-- ALUNOS: acesso apenas à academia do usuário logado
CREATE POLICY "alunos_por_academia" ON alunos
  FOR ALL
  USING (academia_id = get_my_academia_id());

-- PAGAMENTOS: acesso apenas à academia do usuário logado
CREATE POLICY "pagamentos_por_academia" ON pagamentos
  FOR ALL
  USING (academia_id = get_my_academia_id());

-- PAGAMENTOS: leitura pública por código de verificação (página verificar.html)
CREATE POLICY "pagamentos_verificacao_publica" ON pagamentos
  FOR SELECT
  TO anon
  USING (codigo_verificacao IS NOT NULL);

-- PLANOS: acesso apenas à academia do usuário logado
CREATE POLICY "planos_por_academia" ON planos_academia
  FOR ALL
  USING (academia_id = get_my_academia_id());

-- NOTIFICAÇÕES: acesso apenas à academia do usuário logado
CREATE POLICY "notificacoes_por_academia" ON notificacoes
  FOR ALL
  USING (academia_id = get_my_academia_id());

-- ============================================================
-- PASSO 8: VERIFICAR SE TUDO FOI CRIADO CORRETAMENTE
-- ============================================================

SELECT
  'academias'       AS tabela, COUNT(*) AS registros FROM academias
UNION ALL SELECT 'planos_academia', COUNT(*) FROM planos_academia
UNION ALL SELECT 'alunos',          COUNT(*) FROM alunos
UNION ALL SELECT 'pagamentos',      COUNT(*) FROM pagamentos;
