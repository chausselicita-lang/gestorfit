// js/supabase.js — Cliente Supabase + todas as queries

const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// =====================================
// AUTENTICAÇÃO
// =====================================

async function loginComEmail(email, senha) {
  const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

async function logout() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

async function getUsuarioAtual() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function getAcademiaDoUsuario(userId) {
  const { data, error } = await db.from('academias')
    .select('*')
    .eq('usuario_id', userId)
    .single();
  if (error) return null;
  return data;
}

// =====================================
// ALUNOS
// =====================================

async function buscarAlunos(filtros = {}) {
  let query = db.from('alunos')
    .select('*, planos_academia(nome, valor, duracao_dias)')
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .order('nome');

  if (filtros.status) query = query.eq('status', filtros.status);
  if (filtros.nome) query = query.ilike('nome', `%${filtros.nome}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function buscarAlunoPorId(id) {
  const { data, error } = await db.from('alunos')
    .select('*, planos_academia(nome, valor, duracao_dias)')
    .eq('id', id)
    .single();
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

async function excluirAluno(id) {
  const { error } = await db.from('alunos').delete().eq('id', id);
  if (error) throw error;
}

async function buscarVencimentosProximos(dias = 7) {
  const hoje = new Date().toISOString().split('T')[0];
  const limite = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0];

  const { data, error } = await db.from('alunos')
    .select('*, planos_academia(nome, valor)')
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
    .select('*, planos_academia(nome, valor)')
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .in('status', ['ativo', 'inadimplente'])
    .lt('data_vencimento', hoje)
    .order('data_vencimento');

  if (error) throw error;
  return data;
}

// =====================================
// PLANOS
// =====================================

async function buscarPlanos() {
  const { data, error } = await db.from('planos_academia')
    .select('*')
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .eq('ativo', true)
    .order('valor');
  if (error) throw error;
  return data || [];
}

async function salvarPlano(dados) {
  const { data, error } = await db.from('planos_academia')
    .insert({ ...dados, academia_id: CONFIG.ACADEMIA_ID })
    .select().single();
  if (error) throw error;
  return data;
}

async function excluirPlano(id) {
  const { error } = await db.from('planos_academia').delete().eq('id', id);
  if (error) throw error;
}

// =====================================
// PAGAMENTOS
// =====================================

async function registrarPagamento(dados) {
  const referencia = dados.referencia_mes || new Date().toISOString().slice(0, 7);

  const { data, error } = await db.from('pagamentos')
    .insert({ ...dados, academia_id: CONFIG.ACADEMIA_ID, referencia_mes: referencia })
    .select().single();

  if (error) throw error;

  // Atualizar vencimento do aluno
  const novoVencimento = calcularProximoVencimento(dados.plano_duracao_dias || 30);
  await atualizarAluno(dados.aluno_id, { data_vencimento: novoVencimento, status: 'ativo' });

  return data;
}

async function buscarPagamentos(filtros = {}) {
  let query = db.from('pagamentos')
    .select('*, alunos(nome, whatsapp)')
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .order('created_at', { ascending: false });

  if (filtros.mes) query = query.eq('referencia_mes', filtros.mes);
  if (filtros.aluno_id) query = query.eq('aluno_id', filtros.aluno_id);
  if (filtros.status) query = query.eq('status', filtros.status);

  const { data, error } = await query.limit(filtros.limit || 100);
  if (error) throw error;
  return data;
}

async function buscarMetricasMes() {
  const mesAtual = new Date().toISOString().slice(0, 7);

  const [ativos, inadimplentes, pagamentosRes, planosData] = await Promise.all([
    db.from('alunos').select('id', { count: 'exact' })
      .eq('academia_id', CONFIG.ACADEMIA_ID).eq('status', 'ativo'),
    buscarInadimplentes(),
    db.from('pagamentos').select('valor')
      .eq('academia_id', CONFIG.ACADEMIA_ID)
      .eq('referencia_mes', mesAtual).eq('status', 'pago'),
    buscarPlanos(),
  ]);

  const receitaMes = pagamentosRes.data?.reduce((s, p) => s + parseFloat(p.valor), 0) || 0;
  const valorInadimplente = inadimplentes.reduce((s, a) => s + parseFloat(a.planos_academia?.valor || 0), 0);

  return {
    totalAtivos: ativos.count || 0,
    totalInadimplentes: inadimplentes.length,
    receitaMes,
    valorInadimplente,
    planos: planosData,
  };
}

async function buscarReceitaUltimos6Meses() {
  const resultado = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mes = d.toISOString().slice(0, 7);
    const { data } = await db.from('pagamentos').select('valor')
      .eq('academia_id', CONFIG.ACADEMIA_ID)
      .eq('referencia_mes', mes).eq('status', 'pago');
    const total = data?.reduce((s, p) => s + parseFloat(p.valor), 0) || 0;
    resultado.push({ mes, total });
  }
  return resultado;
}

// =====================================
// RELATÓRIOS
// =====================================

async function buscarDadosRelatorio(mes) {
  const { data, error } = await db.from('pagamentos')
    .select('*, alunos(nome, cpf, whatsapp, planos_academia(nome))')
    .eq('academia_id', CONFIG.ACADEMIA_ID)
    .eq('referencia_mes', mes).eq('status', 'pago')
    .order('data_pagamento');
  if (error) throw error;
  return data;
}

async function verificarRecibo(codigo) {
  const { data } = await db.from('pagamentos')
    .select('*, alunos(nome, cpf)')
    .eq('codigo_verificacao', codigo.toUpperCase())
    .single();
  return data || null;
}

// =====================================
// ACADEMIA
// =====================================

async function buscarAcademia() {
  const { data, error } = await db.from('academias')
    .select('*').eq('id', CONFIG.ACADEMIA_ID).single();
  if (error) return null;
  return data;
}

async function atualizarAcademia(dados) {
  const { data, error } = await db.from('academias')
    .update(dados).eq('id', CONFIG.ACADEMIA_ID).select().single();
  if (error) throw error;
  return data;
}
