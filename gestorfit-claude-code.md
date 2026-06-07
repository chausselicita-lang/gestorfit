# GestorFit — Sistema de Gestão para Academias
## Documento Técnico Completo para Claude Code

---

## 🎯 Visão Geral do Projeto

**GestorFit** é um SaaS PWA para gestão completa de academias pequenas e médias.
Permite controle de alunos, pagamentos mensais, inadimplência e relatórios financeiros.

**Stack:**
- Frontend: HTML + CSS + JS (PWA) → GitHub Pages
- Backend: Supabase (PostgreSQL + Auth + Realtime)
- Pagamentos: PIX + Mercado Pago
- PDF: jsPDF
- Notificações: WhatsApp API (Evolution API ou Z-API)

---

## 🗄️ Banco de Dados — Supabase

### Executar no SQL Editor do Supabase:

```sql
-- =============================================
-- GESTORFIT — SCHEMA COMPLETO
-- =============================================

-- Tabela de academias (multi-tenant)
CREATE TABLE academias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cnpj VARCHAR(18),
  telefone VARCHAR(20),
  email VARCHAR(100),
  endereco TEXT,
  logo_url TEXT,
  plano VARCHAR(20) DEFAULT 'basic', -- basic, pro, premium
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de planos oferecidos pela academia
CREATE TABLE planos_academia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academia_id UUID REFERENCES academias(id) ON DELETE CASCADE,
  nome VARCHAR(50) NOT NULL,        -- Ex: Mensal, Trimestral, Anual
  duracao_dias INTEGER NOT NULL,    -- 30, 90, 365
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de alunos
CREATE TABLE alunos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academia_id UUID REFERENCES academias(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  cpf VARCHAR(14),
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(100),
  data_nascimento DATE,
  foto_url TEXT,
  plano_id UUID REFERENCES planos_academia(id),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'ativo', -- ativo, inativo, inadimplente, cancelado
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pagamentos
CREATE TABLE pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID REFERENCES alunos(id) ON DELETE CASCADE,
  academia_id UUID REFERENCES academias(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  forma_pagamento VARCHAR(30) NOT NULL, -- pix, dinheiro, cartao_credito, cartao_debito
  status VARCHAR(20) DEFAULT 'pago',   -- pago, pendente, cancelado
  referencia_mes VARCHAR(7),            -- Ex: 2025-06
  codigo_verificacao VARCHAR(20) UNIQUE, -- Para validação do recibo
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de notificações enviadas
CREATE TABLE notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID REFERENCES alunos(id) ON DELETE CASCADE,
  academia_id UUID REFERENCES academias(id) ON DELETE CASCADE,
  tipo VARCHAR(30),   -- vencimento_proximo, inadimplente, boas_vindas
  canal VARCHAR(20),  -- whatsapp, email, sms
  status VARCHAR(20), -- enviado, falhou, pendente
  mensagem TEXT,
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- FUNÇÕES E TRIGGERS
-- =============================================

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_alunos_updated_at
  BEFORE UPDATE ON alunos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função para gerar código de verificação único
CREATE OR REPLACE FUNCTION gerar_codigo_verificacao()
RETURNS VARCHAR AS $$
DECLARE
  codigo VARCHAR(20);
  existe BOOLEAN;
BEGIN
  LOOP
    codigo := 'GF-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
    SELECT EXISTS(SELECT 1 FROM pagamentos WHERE codigo_verificacao = codigo) INTO existe;
    EXIT WHEN NOT existe;
  END LOOP;
  RETURN codigo;
END;
$$ LANGUAGE plpgsql;

-- Aplicar código automático nos pagamentos
CREATE OR REPLACE FUNCTION set_codigo_verificacao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_verificacao IS NULL THEN
    NEW.codigo_verificacao := gerar_codigo_verificacao();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_codigo
  BEFORE INSERT ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION set_codigo_verificacao();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE academias ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_academia ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar conforme autenticação)
CREATE POLICY "Acesso total autenticado" ON academias
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Acesso total autenticado" ON alunos
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Acesso total autenticado" ON pagamentos
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Acesso total autenticado" ON planos_academia
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- DADOS INICIAIS DE EXEMPLO
-- =============================================

-- Inserir academia de exemplo (substituir pelos dados reais)
INSERT INTO academias (nome, telefone, email) VALUES
('Academia Exemplo', '(77) 99999-9999', 'contato@academia.com');

-- Inserir planos padrão (usar o id da academia acima)
-- INSERT INTO planos_academia (academia_id, nome, duracao_dias, valor) VALUES
-- ('SEU-UUID-AQUI', 'Mensal', 30, 89.90),
-- ('SEU-UUID-AQUI', 'Trimestral', 90, 239.90),
-- ('SEU-UUID-AQUI', 'Anual', 365, 799.90);
```

---

## 📁 Estrutura de Arquivos do Projeto

```
gestorfit/
├── index.html              ← Dashboard principal
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service Worker
├── css/
│   ├── main.css            ← Estilos globais
│   ├── dashboard.css       ← Dashboard
│   └── components.css      ← Componentes reutilizáveis
├── js/
│   ├── config.js           ← Configurações (Supabase keys)
│   ├── auth.js             ← Autenticação
│   ├── supabase.js         ← Cliente Supabase
│   ├── alunos.js           ← CRUD de alunos
│   ├── pagamentos.js       ← CRUD de pagamentos
│   ├── dashboard.js        ← Métricas e gráficos
│   ├── relatorios.js       ← Geração de PDF
│   ├── notificacoes.js     ← WhatsApp alerts
│   └── utils.js            ← Funções auxiliares
├── pages/
│   ├── alunos.html         ← Lista e cadastro de alunos
│   ├── pagamentos.html     ← Controle de pagamentos
│   ├── relatorios.html     ← Relatórios e exportações
│   ├── configuracoes.html  ← Config da academia
│   └── verificar.html      ← Verificação pública de recibos
└── assets/
    ├── icons/              ← Ícones PWA
    └── logo.png
```

---

## 🎨 Design System — Paleta e Tipografia

```css
/* css/main.css — Design System GestorFit */

@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

:root {
  /* Cores principais */
  --preto: #0A0A0F;
  --grafite: #1A1A2E;
  --cinza-escuro: #16213E;
  --verde-neon: #00FF87;
  --verde-medio: #00C96B;
  --azul-eletrico: #0066FF;
  --vermelho-alerta: #FF3B5C;
  --amarelo-aviso: #FFD600;
  --branco: #F8F9FC;
  --cinza-texto: #8892A4;

  /* Superfícies */
  --card-bg: rgba(255,255,255,0.04);
  --card-border: rgba(255,255,255,0.08);
  --card-hover: rgba(0,255,135,0.06);

  /* Tipografia */
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;

  /* Espaçamentos */
  --gap-xs: 8px;
  --gap-sm: 16px;
  --gap-md: 24px;
  --gap-lg: 40px;
  --gap-xl: 64px;

  /* Bordas */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;

  /* Sombras */
  --shadow-verde: 0 0 30px rgba(0,255,135,0.15);
  --shadow-card: 0 4px 24px rgba(0,0,0,0.4);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--preto);
  color: var(--branco);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  min-height: 100vh;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.2;
}
```

---

## 🏠 index.html — Dashboard Principal

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GestorFit — Painel da Academia</title>
  <link rel="manifest" href="manifest.json">
  <link rel="stylesheet" href="css/main.css">
  <link rel="stylesheet" href="css/dashboard.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
</head>
<body>

  <!-- Sidebar -->
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <span class="logo-icon">💪</span>
      <span class="logo-text">GestorFit</span>
    </div>

    <ul class="nav-menu">
      <li class="nav-item active" data-page="dashboard">
        <span class="nav-icon">📊</span>
        <span>Dashboard</span>
      </li>
      <li class="nav-item" data-page="alunos">
        <span class="nav-icon">👥</span>
        <span>Alunos</span>
      </li>
      <li class="nav-item" data-page="pagamentos">
        <span class="nav-icon">💰</span>
        <span>Pagamentos</span>
      </li>
      <li class="nav-item" data-page="relatorios">
        <span class="nav-icon">📄</span>
        <span>Relatórios</span>
      </li>
      <li class="nav-item" data-page="configuracoes">
        <span class="nav-icon">⚙️</span>
        <span>Configurações</span>
      </li>
    </ul>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar" id="userAvatar">A</div>
        <div class="user-details">
          <span class="user-name" id="userName">Academia</span>
          <span class="user-plan">Plano Pro</span>
        </div>
      </div>
      <button class="btn-logout" id="btnLogout">Sair</button>
    </div>
  </nav>

  <!-- Conteúdo principal -->
  <main class="main-content">

    <!-- Header -->
    <header class="top-header">
      <button class="btn-menu-mobile" id="btnMenuMobile">☰</button>
      <div class="header-title">
        <h1 id="pageTitle">Dashboard</h1>
        <span id="pageDate" class="page-date"></span>
      </div>
      <div class="header-actions">
        <button class="btn-primary" id="btnNovoAluno">+ Novo Aluno</button>
        <button class="btn-icon" id="btnNotificacoes">🔔 <span class="badge" id="badgeVencimentos">0</span></button>
      </div>
    </header>

    <!-- Cards de métricas -->
    <section class="metrics-grid" id="metricsGrid">
      <div class="metric-card verde">
        <div class="metric-icon">👥</div>
        <div class="metric-info">
          <span class="metric-label">Alunos Ativos</span>
          <span class="metric-value" id="totalAtivos">--</span>
        </div>
        <div class="metric-trend" id="trendAtivos"></div>
      </div>

      <div class="metric-card azul">
        <div class="metric-icon">💰</div>
        <div class="metric-info">
          <span class="metric-label">Receita do Mês</span>
          <span class="metric-value" id="receitaMes">--</span>
        </div>
        <div class="metric-trend" id="trendReceita"></div>
      </div>

      <div class="metric-card vermelho">
        <div class="metric-icon">⚠️</div>
        <div class="metric-info">
          <span class="metric-label">Inadimplentes</span>
          <span class="metric-value" id="totalInadimplentes">--</span>
        </div>
        <div class="metric-sub" id="valorInadimplente"></div>
      </div>

      <div class="metric-card amarelo">
        <div class="metric-icon">📅</div>
        <div class="metric-info">
          <span class="metric-label">Vencem Hoje</span>
          <span class="metric-value" id="vencemHoje">--</span>
        </div>
        <div class="metric-sub" id="vencemSemana"></div>
      </div>
    </section>

    <!-- Tabelas principais -->
    <section class="tables-grid">

      <!-- Vencimentos próximos -->
      <div class="table-card">
        <div class="table-header">
          <h3>⚡ Vencimentos Próximos</h3>
          <span class="table-period">Próximos 7 dias</span>
        </div>
        <div class="table-body" id="tabelaVencimentos">
          <div class="loading-state">Carregando...</div>
        </div>
      </div>

      <!-- Últimos pagamentos -->
      <div class="table-card">
        <div class="table-header">
          <h3>✅ Últimos Pagamentos</h3>
          <a href="pages/pagamentos.html" class="link-ver-todos">Ver todos</a>
        </div>
        <div class="table-body" id="tabelaUltimosPagamentos">
          <div class="loading-state">Carregando...</div>
        </div>
      </div>

    </section>

  </main>

  <!-- Modal Novo Aluno -->
  <div class="modal-overlay" id="modalNovoAluno">
    <div class="modal">
      <div class="modal-header">
        <h2>Novo Aluno</h2>
        <button class="btn-close" id="fecharModal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group full">
            <label>Nome completo *</label>
            <input type="text" id="alunoNome" placeholder="Nome do aluno" required>
          </div>
          <div class="form-group">
            <label>CPF</label>
            <input type="text" id="alunoCpf" placeholder="000.000.000-00">
          </div>
          <div class="form-group">
            <label>WhatsApp *</label>
            <input type="tel" id="alunoWhatsapp" placeholder="(77) 99999-9999" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="alunoEmail" placeholder="email@exemplo.com">
          </div>
          <div class="form-group">
            <label>Data de Nascimento</label>
            <input type="date" id="alunoNascimento">
          </div>
          <div class="form-group">
            <label>Plano *</label>
            <select id="alunoPlano" required>
              <option value="">Selecione o plano</option>
            </select>
          </div>
          <div class="form-group">
            <label>Data de Início</label>
            <input type="date" id="alunoInicio">
          </div>
          <div class="form-group">
            <label>Observações</label>
            <textarea id="alunoObs" rows="2" placeholder="Observações opcionais"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="cancelarModal">Cancelar</button>
        <button class="btn-primary" id="salvarAluno">Salvar Aluno</button>
      </div>
    </div>
  </div>

  <!-- Modal Registrar Pagamento -->
  <div class="modal-overlay" id="modalPagamento">
    <div class="modal">
      <div class="modal-header">
        <h2>Registrar Pagamento</h2>
        <button class="btn-close" id="fecharModalPag">✕</button>
      </div>
      <div class="modal-body">
        <div class="aluno-info-pagamento" id="alunoInfoPagamento"></div>
        <div class="form-grid">
          <div class="form-group">
            <label>Valor *</label>
            <input type="number" id="pagValor" step="0.01" placeholder="0,00" required>
          </div>
          <div class="form-group">
            <label>Data do Pagamento *</label>
            <input type="date" id="pagData" required>
          </div>
          <div class="form-group">
            <label>Forma de Pagamento *</label>
            <select id="pagForma" required>
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao_credito">Cartão Crédito</option>
              <option value="cartao_debito">Cartão Débito</option>
            </select>
          </div>
          <div class="form-group">
            <label>Referência (mês/ano)</label>
            <input type="month" id="pagReferencia">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="cancelarModalPag">Cancelar</button>
        <button class="btn-primary" id="confirmarPagamento">✅ Confirmar Pagamento</button>
      </div>
    </div>
  </div>

  <script src="js/config.js"></script>
  <script src="js/supabase.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/alunos.js"></script>
  <script src="js/pagamentos.js"></script>
  <script src="js/dashboard.js"></script>
</body>
</html>
```

---

## ⚙️ js/config.js

```javascript
// js/config.js — Configurações do GestorFit

const CONFIG = {
  SUPABASE_URL: 'https://SEU_PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY_AQUI',

  // ID da academia logada (buscar após auth)
  ACADEMIA_ID: null,

  // WhatsApp API (Z-API ou Evolution API)
  WHATSAPP_INSTANCE: 'SUA_INSTANCIA',
  WHATSAPP_TOKEN: 'SEU_TOKEN',

  // Configurações de alertas
  DIAS_AVISO_VENCIMENTO: 3,  // Avisar X dias antes
};
```

---

## 🔌 js/supabase.js

```javascript
// js/supabase.js — Cliente Supabase

const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// =====================================
// ALUNOS
// =====================================

async function buscarAlunos(filtros = {}) {
  let query = db.from('alunos')
    .select(`*, planos_academia(nome, valor, duracao_dias)`)
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .order('nome');

  if (filtros.status) query = query.eq('status', filtros.status);
  if (filtros.nome) query = query.ilike('nome', `%${filtros.nome}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function salvarAluno(dadosAluno) {
  const { data, error } = await db.from('alunos')
    .insert({ ...dadosAluno, academia_id: CONFIG.ACADEMIA_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function atualizarAluno(id, dados) {
  const { data, error } = await db.from('alunos')
    .update(dados)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function buscarVencimentosProximos(dias = 7) {
  const hoje = new Date().toISOString().split('T')[0];
  const limite = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0];

  const { data, error } = await db.from('alunos')
    .select(`*, planos_academia(nome, valor)`)
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .eq('status', 'ativo')
    .gte('data_vencimento', hoje)
    .lte('data_vencimento', limite)
    .order('data_vencimento');

  if (error) throw error;
  return data;
}

async function buscarInadimplentes() {
  const hoje = new Date().toISOString().split('T')[0];

  const { data, error } = await db.from('alunos')
    .select(`*, planos_academia(nome, valor)`)
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .in('status', ['ativo', 'inadimplente'])
    .lt('data_vencimento', hoje)
    .order('data_vencimento');

  if (error) throw error;
  return data;
}

// =====================================
// PAGAMENTOS
// =====================================

async function registrarPagamento(dados) {
  const referencia = dados.referencia_mes ||
    new Date().toISOString().slice(0, 7);

  const { data, error } = await db.from('pagamentos')
    .insert({
      ...dados,
      academia_id: CONFIG.ACADEMIA_ID,
      referencia_mes: referencia
    })
    .select()
    .single();

  if (error) throw error;

  // Atualizar vencimento do aluno
  const novoVencimento = calcularProximoVencimento(dados.plano_duracao_dias);
  await atualizarAluno(dados.aluno_id, {
    data_vencimento: novoVencimento,
    status: 'ativo'
  });

  return data;
}

async function buscarPagamentos(filtros = {}) {
  let query = db.from('pagamentos')
    .select(`*, alunos(nome, whatsapp)`)
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .order('created_at', { ascending: false });

  if (filtros.mes) query = query.eq('referencia_mes', filtros.mes);
  if (filtros.aluno_id) query = query.eq('aluno_id', filtros.aluno_id);

  const { data, error } = await query.limit(filtros.limit || 50);
  if (error) throw error;
  return data;
}

async function buscarMetricasMes() {
  const mesAtual = new Date().toISOString().slice(0, 7);

  const [ativos, inadimplentes, pagamentos, planosData] = await Promise.all([
    db.from('alunos').select('id', { count: 'exact' })
      .eq('academia_id', CONFIG.ACADEMIA_ID)
      .eq('status', 'ativo'),
    buscarInadimplentes(),
    db.from('pagamentos').select('valor')
      .eq('academia_id', CONFIG.ACADEMIA_ID)
      .eq('referencia_mes', mesAtual)
      .eq('status', 'pago'),
    db.from('planos_academia').select('*')
      .eq('academia_id', CONFIG.ACADEMIA_ID)
      .eq('ativo', true)
  ]);

  const receitaMes = pagamentos.data?.reduce((sum, p) => sum + parseFloat(p.valor), 0) || 0;
  const valorInadimplente = inadimplentes.reduce((sum, a) =>
    sum + parseFloat(a.planos_academia?.valor || 0), 0);

  return {
    totalAtivos: ativos.count || 0,
    totalInadimplentes: inadimplentes.length,
    receitaMes,
    valorInadimplente,
    planos: planosData.data || []
  };
}

// =====================================
// RELATÓRIOS
// =====================================

async function buscarDadosRelatorio(mes) {
  const { data, error } = await db.from('pagamentos')
    .select(`*, alunos(nome, cpf, whatsapp, planos_academia(nome))`)
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .eq('referencia_mes', mes)
    .eq('status', 'pago')
    .order('data_pagamento');

  if (error) throw error;
  return data;
}

async function verificarRecibo(codigo) {
  const { data, error } = await db.from('pagamentos')
    .select(`*, alunos(nome, cpf)`)
    .eq('codigo_verificacao', codigo)
    .single();

  if (error) return null;
  return data;
}
```

---

## 🛠️ js/utils.js

```javascript
// js/utils.js — Funções auxiliares

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
}

function formatarData(data) {
  if (!data) return '--';
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatarDataHora(data) {
  if (!data) return '--';
  return new Date(data).toLocaleString('pt-BR');
}

function calcularProximoVencimento(duracaoDias) {
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + duracaoDias);
  return hoje.toISOString().split('T')[0];
}

function calcularDiasRestantes(dataVencimento) {
  const hoje = new Date();
  const venc = new Date(dataVencimento + 'T00:00:00');
  const diff = Math.ceil((venc - hoje) / 86400000);
  return diff;
}

function getStatusBadge(status) {
  const badges = {
    ativo: '<span class="badge-status verde">Ativo</span>',
    inativo: '<span class="badge-status cinza">Inativo</span>',
    inadimplente: '<span class="badge-status vermelho">Inadimplente</span>',
    cancelado: '<span class="badge-status preto">Cancelado</span>'
  };
  return badges[status] || status;
}

function getFormaPagamentoBadge(forma) {
  const icones = {
    pix: '🟢 PIX',
    dinheiro: '💵 Dinheiro',
    cartao_credito: '💳 Crédito',
    cartao_debito: '💳 Débito'
  };
  return icones[forma] || forma;
}

function mostrarToast(mensagem, tipo = 'sucesso') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function mostrarLoading(elemento, texto = 'Carregando...') {
  elemento.innerHTML = `<div class="loading-state">
    <div class="spinner"></div>
    <span>${texto}</span>
  </div>`;
}
```

---

## 📊 js/dashboard.js

```javascript
// js/dashboard.js — Lógica do Dashboard

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar data no header
  document.getElementById('pageDate').textContent =
    new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric',
      month: 'long', day: 'numeric'
    });

  await carregarDashboard();
  configurarModais();
  configurarNavegacao();
});

async function carregarDashboard() {
  try {
    const metricas = await buscarMetricasMes();
    renderizarMetricas(metricas);

    const vencimentos = await buscarVencimentosProximos(7);
    renderizarVencimentos(vencimentos);

    const pagamentos = await buscarPagamentos({ limit: 8 });
    renderizarUltimosPagamentos(pagamentos);

    // Badge de notificações
    document.getElementById('badgeVencimentos').textContent =
      vencimentos.length + metricas.totalInadimplentes;

    // Verificar e atualizar inadimplentes
    await atualizarStatusInadimplentes();

  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
    mostrarToast('Erro ao carregar dados', 'erro');
  }
}

function renderizarMetricas(m) {
  document.getElementById('totalAtivos').textContent = m.totalAtivos;
  document.getElementById('receitaMes').textContent = formatarMoeda(m.receitaMes);
  document.getElementById('totalInadimplentes').textContent = m.totalInadimplentes;
  document.getElementById('valorInadimplente').textContent =
    `Em aberto: ${formatarMoeda(m.valorInadimplente)}`;
}

function renderizarVencimentos(vencimentos) {
  const container = document.getElementById('tabelaVencimentos');

  if (!vencimentos.length) {
    container.innerHTML = '<div class="empty-state">✅ Nenhum vencimento nos próximos 7 dias</div>';
    return;
  }

  container.innerHTML = vencimentos.map(aluno => {
    const dias = calcularDiasRestantes(aluno.data_vencimento);
    const urgencia = dias <= 0 ? 'vermelho' : dias <= 2 ? 'amarelo' : 'verde';

    return `
      <div class="table-row">
        <div class="row-info">
          <span class="row-nome">${aluno.nome}</span>
          <span class="row-plano">${aluno.planos_academia?.nome || '--'}</span>
        </div>
        <div class="row-meta">
          <span class="badge-urgencia ${urgencia}">
            ${dias <= 0 ? 'VENCIDO' : dias === 0 ? 'Hoje' : `${dias}d`}
          </span>
          <span class="row-valor">${formatarMoeda(aluno.planos_academia?.valor)}</span>
          <button class="btn-pagar" onclick="abrirModalPagamento('${aluno.id}')">
            Pagar
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderizarUltimosPagamentos(pagamentos) {
  const container = document.getElementById('tabelaUltimosPagamentos');

  if (!pagamentos.length) {
    container.innerHTML = '<div class="empty-state">Nenhum pagamento registrado</div>';
    return;
  }

  container.innerHTML = pagamentos.map(p => `
    <div class="table-row">
      <div class="row-info">
        <span class="row-nome">${p.alunos?.nome || '--'}</span>
        <span class="row-meta-text">${getFormaPagamentoBadge(p.forma_pagamento)}</span>
      </div>
      <div class="row-meta">
        <span class="row-valor verde">${formatarMoeda(p.valor)}</span>
        <span class="row-data">${formatarData(p.data_pagamento)}</span>
      </div>
    </div>
  `).join('');
}

async function atualizarStatusInadimplentes() {
  const inadimplentes = await buscarInadimplentes();
  for (const aluno of inadimplentes) {
    if (aluno.status !== 'inadimplente') {
      await atualizarAluno(aluno.id, { status: 'inadimplente' });
    }
  }
}

// =====================================
// MODAIS
// =====================================

function configurarModais() {
  // Modal Novo Aluno
  document.getElementById('btnNovoAluno').onclick = abrirModalNovoAluno;
  document.getElementById('fecharModal').onclick = fecharModalNovoAluno;
  document.getElementById('cancelarModal').onclick = fecharModalNovoAluno;
  document.getElementById('salvarAluno').onclick = handleSalvarAluno;

  // Modal Pagamento
  document.getElementById('fecharModalPag').onclick = fecharModalPagamento;
  document.getElementById('cancelarModalPag').onclick = fecharModalPagamento;
  document.getElementById('confirmarPagamento').onclick = handleConfirmarPagamento;

  // Fechar ao clicar fora
  document.getElementById('modalNovoAluno').onclick = (e) => {
    if (e.target.id === 'modalNovoAluno') fecharModalNovoAluno();
  };
}

async function abrirModalNovoAluno() {
  await carregarPlanosNoSelect();
  document.getElementById('alunoInicio').value = new Date().toISOString().split('T')[0];
  document.getElementById('modalNovoAluno').classList.add('active');
}

function fecharModalNovoAluno() {
  document.getElementById('modalNovoAluno').classList.remove('active');
  document.getElementById('salvarAluno').form?.reset();
}

async function carregarPlanosNoSelect() {
  const metricas = await buscarMetricasMes();
  const select = document.getElementById('alunoPlano');
  select.innerHTML = '<option value="">Selecione o plano</option>' +
    metricas.planos.map(p =>
      `<option value="${p.id}" data-duracao="${p.duracao_dias}" data-valor="${p.valor}">
        ${p.nome} — ${formatarMoeda(p.valor)}
      </option>`
    ).join('');
}

async function handleSalvarAluno() {
  const nome = document.getElementById('alunoNome').value.trim();
  const whatsapp = document.getElementById('alunoWhatsapp').value.trim();
  const planoId = document.getElementById('alunoPlano').value;
  const inicio = document.getElementById('alunoInicio').value;

  if (!nome || !whatsapp || !planoId || !inicio) {
    mostrarToast('Preencha todos os campos obrigatórios', 'erro');
    return;
  }

  const planoOption = document.querySelector(`#alunoPlano option[value="${planoId}"]`);
  const duracao = parseInt(planoOption.dataset.duracao);
  const vencimento = new Date(inicio);
  vencimento.setDate(vencimento.getDate() + duracao);

  const dadosAluno = {
    nome,
    cpf: document.getElementById('alunoCpf').value,
    whatsapp,
    email: document.getElementById('alunoEmail').value,
    data_nascimento: document.getElementById('alunoNascimento').value || null,
    plano_id: planoId,
    data_inicio: inicio,
    data_vencimento: vencimento.toISOString().split('T')[0],
    observacoes: document.getElementById('alunoObs').value,
  };

  try {
    document.getElementById('salvarAluno').textContent = 'Salvando...';
    await salvarAluno(dadosAluno);
    mostrarToast('✅ Aluno cadastrado com sucesso!');
    fecharModalNovoAluno();
    await carregarDashboard();
  } catch (err) {
    mostrarToast('Erro ao salvar aluno: ' + err.message, 'erro');
  } finally {
    document.getElementById('salvarAluno').textContent = 'Salvar Aluno';
  }
}

let alunoAtualPagamento = null;

async function abrirModalPagamento(alunoId) {
  const alunos = await buscarAlunos();
  alunoAtualPagamento = alunos.find(a => a.id === alunoId);

  if (!alunoAtualPagamento) return;

  document.getElementById('alunoInfoPagamento').innerHTML = `
    <div class="aluno-card-mini">
      <strong>${alunoAtualPagamento.nome}</strong>
      <span>${alunoAtualPagamento.planos_academia?.nome} — ${formatarMoeda(alunoAtualPagamento.planos_academia?.valor)}</span>
    </div>
  `;

  document.getElementById('pagValor').value = alunoAtualPagamento.planos_academia?.valor || '';
  document.getElementById('pagData').value = new Date().toISOString().split('T')[0];
  document.getElementById('pagReferencia').value = new Date().toISOString().slice(0, 7);
  document.getElementById('modalPagamento').classList.add('active');
}

function fecharModalPagamento() {
  document.getElementById('modalPagamento').classList.remove('active');
  alunoAtualPagamento = null;
}

async function handleConfirmarPagamento() {
  if (!alunoAtualPagamento) return;

  const dados = {
    aluno_id: alunoAtualPagamento.id,
    valor: parseFloat(document.getElementById('pagValor').value),
    data_pagamento: document.getElementById('pagData').value,
    data_vencimento: alunoAtualPagamento.data_vencimento,
    forma_pagamento: document.getElementById('pagForma').value,
    referencia_mes: document.getElementById('pagReferencia').value,
    status: 'pago',
    plano_duracao_dias: alunoAtualPagamento.planos_academia?.duracao_dias
  };

  try {
    document.getElementById('confirmarPagamento').textContent = 'Processando...';
    const pagamento = await registrarPagamento(dados);
    mostrarToast('✅ Pagamento registrado!');
    fecharModalPagamento();
    await carregarDashboard();

    // Oferecer geração de recibo
    if (confirm('Deseja gerar o recibo em PDF?')) {
      gerarReciboPDF(pagamento, alunoAtualPagamento);
    }
  } catch (err) {
    mostrarToast('Erro ao registrar pagamento: ' + err.message, 'erro');
  } finally {
    document.getElementById('confirmarPagamento').textContent = '✅ Confirmar Pagamento';
  }
}

function configurarNavegacao() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page !== 'dashboard') {
        window.location.href = `pages/${page}.html`;
      }
    });
  });
}
```

---

## 📄 js/relatorios.js — PDF com verificação

```javascript
// js/relatorios.js — Geração de PDF com código de verificação

async function gerarRelatorioMensalPDF(mes) {
  const { jsPDF } = window.jspdf;
  const pagamentos = await buscarDadosRelatorio(mes);

  if (!pagamentos.length) {
    mostrarToast('Nenhum pagamento encontrado neste período', 'aviso');
    return;
  }

  const doc = new jsPDF();
  const mesFormatado = new Date(mes + '-01').toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric'
  });

  // Cabeçalho
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(0, 255, 135);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('GestorFit', 20, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(`Relatório Financeiro — ${mesFormatado}`, 20, 32);

  // Dados da academia
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 20, 55);

  // Total
  const total = pagamentos.reduce((sum, p) => sum + parseFloat(p.valor), 0);
  doc.setFillColor(240, 255, 245);
  doc.rect(15, 62, 180, 16, 'F');
  doc.setTextColor(0, 150, 80);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Recebido: ${formatarMoeda(total)}`, 20, 73);
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.text(`${pagamentos.length} pagamento(s) registrado(s)`, 130, 73);

  // Tabela
  let y = 90;
  doc.setFillColor(30, 30, 50);
  doc.rect(15, y - 6, 180, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Aluno', 20, y);
  doc.text('Data', 90, y);
  doc.text('Forma', 120, y);
  doc.text('Valor', 160, y);
  doc.text('Código', 175, y);
  y += 8;

  pagamentos.forEach((p, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 5, 180, 9, 'F');
    }
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text((p.alunos?.nome || '--').substring(0, 30), 20, y);
    doc.text(formatarData(p.data_pagamento), 90, y);
    doc.text(p.forma_pagamento, 120, y);
    doc.text(formatarMoeda(p.valor), 155, y, { align: 'right' });
    doc.text(p.codigo_verificacao || '--', 170, y);
    y += 9;
  });

  // Rodapé com QR de verificação
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Verifique a autenticidade deste documento em: gestorfit.com.br/verificar',
    105, 285, { align: 'center' }
  );

  doc.save(`GestorFit-Relatorio-${mes}.pdf`);
  mostrarToast('📄 Relatório gerado com sucesso!');
}

function gerarReciboPDF(pagamento, aluno) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: 'a5' });

  // Fundo
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, 148, 30, 'F');

  // Logo e título
  doc.setTextColor(0, 255, 135);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('GestorFit', 10, 14);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('RECIBO DE PAGAMENTO', 10, 24);

  // Código de verificação
  doc.setFillColor(0, 255, 135);
  doc.rect(90, 8, 50, 16, 'F');
  doc.setTextColor(10, 10, 15);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CÓDIGO DE VERIFICAÇÃO', 115, 14, { align: 'center' });
  doc.setFontSize(9);
  doc.text(pagamento.codigo_verificacao || '--', 115, 21, { align: 'center' });

  // Dados do aluno
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const dados = [
    ['Aluno:', aluno.nome],
    ['CPF:', aluno.cpf || 'Não informado'],
    ['Plano:', aluno.planos_academia?.nome || '--'],
    ['Valor pago:', formatarMoeda(pagamento.valor)],
    ['Data:', formatarData(pagamento.data_pagamento)],
    ['Forma:', pagamento.forma_pagamento?.toUpperCase()],
    ['Referência:', pagamento.referencia_mes],
    ['Próx. vencimento:', formatarData(aluno.data_vencimento)],
  ];

  let y = 42;
  dados.forEach(([label, valor]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 10, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(valor), 55, y);
    y += 10;
  });

  // Linha divisória
  doc.setDrawColor(200, 200, 200);
  doc.line(10, y + 2, 138, y + 2);
  y += 10;

  // Validade do comprovante
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Este recibo pode ser verificado em:', 10, y);
  doc.setTextColor(0, 100, 200);
  doc.text('gestorfit.com.br/verificar/' + (pagamento.codigo_verificacao || ''), 10, y + 6);

  doc.setTextColor(100, 100, 100);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 10, y + 14);

  doc.save(`Recibo-${aluno.nome}-${pagamento.referencia_mes}.pdf`);
}
```

---

## 📱 manifest.json — PWA

```json
{
  "name": "GestorFit",
  "short_name": "GestorFit",
  "description": "Sistema de gestão para academias",
  "start_url": "/gestorfit/",
  "display": "standalone",
  "background_color": "#0A0A0F",
  "theme_color": "#00FF87",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "assets/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 🚀 Ordem de Implementação no Claude Code

```bash
# 1. Criar repositório
mkdir gestorfit && cd gestorfit && git init

# 2. Criar estrutura de pastas
mkdir -p css js pages assets/icons

# 3. Criar os arquivos na ordem:
# → manifest.json
# → css/main.css
# → js/config.js  (colocar suas keys do Supabase)
# → js/supabase.js
# → js/utils.js
# → js/dashboard.js
# → js/relatorios.js
# → index.html

# 4. Rodar SQL no Supabase SQL Editor

# 5. Deploy
git add . && git commit -m "feat: GestorFit inicial"
git remote add origin https://github.com/SEU_USER/gestorfit.git
git push -u origin main
# Ativar GitHub Pages nas configurações do repo
```

---

## 📋 Checklist de Funcionalidades

- [ ] Dashboard com 4 métricas principais
- [ ] Cadastro de alunos com planos
- [ ] Controle de pagamentos por aluno
- [ ] Atualização automática de vencimento após pagamento
- [ ] Marcação automática de inadimplentes
- [ ] Relatório mensal em PDF com tabela
- [ ] Recibo individual em PDF com código de verificação
- [ ] Página pública de verificação de recibo
- [ ] PWA instalável no celular
- [ ] Alertas de vencimento próximo
- [ ] Notificação WhatsApp (fase 2)
- [ ] Multi-academia / white-label (fase 3)

---

*GestorFit — Documento gerado pelo Claude para implementação via Claude Code*
*Versão 1.0 — Junho 2025*
