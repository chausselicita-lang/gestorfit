CREATE TABLE IF NOT EXISTS notificacoes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academia_id UUID NOT NULL,
  titulo      TEXT NOT NULL,
  mensagem    TEXT,
  tipo        TEXT DEFAULT 'info',
  lida        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frequencias (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academia_id UUID NOT NULL,
  aluno_id    UUID NOT NULL,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  hora        TIME,
  observacao  TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(aluno_id, data)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'frequencias_academia_id_fkey') THEN
    ALTER TABLE frequencias ADD CONSTRAINT frequencias_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'frequencias_aluno_id_fkey') THEN
    ALTER TABLE frequencias ADD CONSTRAINT frequencias_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notificacoes_academia_id_fkey') THEN
    ALTER TABLE notificacoes ADD CONSTRAINT notificacoes_academia_id_fkey FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE frequencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_academia_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM academias WHERE usuario_id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS "academia_owner" ON academias;
DROP POLICY IF EXISTS "alunos_por_academia" ON alunos;
DROP POLICY IF EXISTS "pagamentos_por_academia" ON pagamentos;
DROP POLICY IF EXISTS "pagamentos_verificacao_publica" ON pagamentos;
DROP POLICY IF EXISTS "planos_por_academia" ON planos_academia;
DROP POLICY IF EXISTS "notificacoes_por_academia" ON notificacoes;
DROP POLICY IF EXISTS "frequencias_por_academia" ON frequencias;
DROP POLICY IF EXISTS "Acesso total autenticado" ON academias;
DROP POLICY IF EXISTS "Acesso total autenticado" ON alunos;
DROP POLICY IF EXISTS "Acesso total autenticado" ON pagamentos;
DROP POLICY IF EXISTS "Acesso total autenticado" ON planos_academia;
DROP POLICY IF EXISTS "Acesso total autenticado" ON notificacoes;

CREATE POLICY "academia_owner" ON academias FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "alunos_por_academia" ON alunos FOR ALL USING (academia_id = get_my_academia_id()) WITH CHECK (academia_id = get_my_academia_id());

CREATE POLICY "pagamentos_por_academia" ON pagamentos FOR ALL USING (academia_id = get_my_academia_id()) WITH CHECK (academia_id = get_my_academia_id());

CREATE POLICY "pagamentos_verificacao_publica" ON pagamentos FOR SELECT TO anon USING (codigo_verificacao IS NOT NULL);

CREATE POLICY "planos_por_academia" ON planos_academia FOR ALL USING (academia_id = get_my_academia_id()) WITH CHECK (academia_id = get_my_academia_id());

CREATE POLICY "notificacoes_por_academia" ON notificacoes FOR ALL USING (academia_id = get_my_academia_id()) WITH CHECK (academia_id = get_my_academia_id());

CREATE POLICY "frequencias_por_academia" ON frequencias FOR ALL USING (academia_id = get_my_academia_id()) WITH CHECK (academia_id = get_my_academia_id());

NOTIFY pgrst, 'reload schema';

SELECT 'academias' AS tabela, COUNT(*) AS registros FROM academias
UNION ALL SELECT 'alunos', COUNT(*) FROM alunos
UNION ALL SELECT 'pagamentos', COUNT(*) FROM pagamentos
UNION ALL SELECT 'planos_academia', COUNT(*) FROM planos_academia
UNION ALL SELECT 'frequencias', COUNT(*) FROM frequencias
UNION ALL SELECT 'notificacoes', COUNT(*) FROM notificacoes;
