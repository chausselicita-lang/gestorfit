// js/supabase.js — Cliente Supabase + queries GestorFit

const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ─── HELPER: ID REAL DA ACADEMIA ──────────────────
// CONFIG.ACADEMIA_ID é fallback; o ID real é resolvido
// via usuario_id do usuário logado e fica cacheado.

let _cachedAcademiaId = null;

async function getAcademiaId() {
  if (_cachedAcademiaId) return _cachedAcademiaId;
  try {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return CONFIG.ACADEMIA_ID;
    const { data } = await db.from('academias')
      .select('id').eq('usuario_id', user.id).limit(1).maybeSingle();
    _cachedAcademiaId = data?.id || CONFIG.ACADEMIA_ID;
  } catch {
    _cachedAcademiaId = CONFIG.ACADEMIA_ID;
  }
  return _cachedAcademiaId;
}

// ─── AUTENTICAÇÃO ──────────────────────────────────

async function loginComEmail(email, senha) {
  const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

async function logout() {
  _cachedAcademiaId = null;
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

async function getUsuarioAtual() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function getAcademiaDoUsuario() {
  const academia = await buscarAcademia();
  return academia;
}

// ─── ALUNOS ───────────────────────────────────────

async function buscarAlunos(filtros = {}) {
  const aid = await getAcademiaId();
  let query = db.from('alunos')
    .select('*, planos_academia(nome, valor, duracao_dias)')
    .eq('academia_id', aid)
    .order('nome');

  if (filtros.status) query = query.eq('status', filtros.status);
  if (filtros.nome)   query = query.ilike('nome', `%${filtros.nome}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function buscarAlunoPorId(id) {
  const { data, error } = await db.from('alunos')
    .select('*, planos_academia(nome, valor, duracao_dias)')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

async function salvarAluno(dadosAluno) {
  const aid = await getAcademiaId();
  const { data, error } = await db.from('alunos')
    .insert({ ...dadosAluno, academia_id: aid })
    .select().single();
  if (error) throw error;
  return data;
}

async function atualizarAluno(id, dados) {
  const { data, error } = await db.from('alunos')
    .update(dados).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function excluirAluno(id) {
  const { error } = await db.from('alunos').delete().eq('id', id);
  if (error) throw error;
}

async function buscarVencimentosProximos(dias = 7) {
  const aid = await getAcademiaId();
  const hoje   = new Date().toISOString().split('T')[0];
  const limite = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0];
  const { data, error } = await db.from('alunos')
    .select('*, planos_academia(nome, valor)')
    .eq('academia_id', aid)
    .eq('status', 'ativo')
    .gte('data_vencimento', hoje)
    .lte('data_vencimento', limite)
    .order('data_vencimento');
  if (error) throw error;
  return data;
}

async function buscarInadimplentes() {
  const aid = await getAcademiaId();
  const hoje = new Date().toISOString().split('T')[0];
  const { data, error } = await db.from('alunos')
    .select('*, planos_academia(nome, valor)')
    .eq('academia_id', aid)
    .in('status', ['ativo', 'inadimplente'])
    .lt('data_vencimento', hoje)
    .order('data_vencimento');
  if (error) throw error;
  return data;
}

async function buscarAlunosRecentes(limit = 5) {
  const aid = await getAcademiaId();
  const { data, error } = await db.from('alunos')
    .select('id, nome, status, planos_academia(nome, valor)')
    .eq('academia_id', aid)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function buscarAniversariantes() {
  const aid = await getAcademiaId();
  const hoje = new Date();
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  const dd = String(hoje.getDate()).padStart(2, '0');

  const { data } = await db.from('alunos')
    .select('id, nome, data_nascimento, whatsapp')
    .eq('academia_id', aid)
    .eq('status', 'ativo')
    .not('data_nascimento', 'is', null);

  if (!data) return [];
  return data.filter(a => {
    const d = a.data_nascimento;
    return d && d.slice(5, 7) === mm && d.slice(8, 10) === dd;
  });
}

// ─── PLANOS ───────────────────────────────────────

async function buscarPlanos() {
  const aid = await getAcademiaId();
  const { data, error } = await db.from('planos_academia')
    .select('*')
    .eq('academia_id', aid)
    .eq('ativo', true)
    .order('valor');
  if (error) throw error;
  return data || [];
}

async function salvarPlano(dados) {
  const aid = await getAcademiaId();
  const { data, error } = await db.from('planos_academia')
    .insert({ ...dados, academia_id: aid })
    .select().single();
  if (error) throw error;
  return data;
}

async function excluirPlano(id) {
  const { error } = await db.from('planos_academia').delete().eq('id', id);
  if (error) throw error;
}

// ─── PAGAMENTOS ───────────────────────────────────

async function registrarPagamento(dados) {
  const aid = await getAcademiaId();
  const referencia = dados.referencia_mes || new Date().toISOString().slice(0, 7);
  const { data, error } = await db.from('pagamentos')
    .insert({ ...dados, academia_id: aid, referencia_mes: referencia })
    .select().single();
  if (error) throw error;

  const novoVencimento = calcularProximoVencimento(dados.plano_duracao_dias || 30);
  await atualizarAluno(dados.aluno_id, { data_vencimento: novoVencimento, status: 'ativo' });

  return data;
}

async function buscarPagamentos(filtros = {}) {
  const aid = await getAcademiaId();
  let query = db.from('pagamentos')
    .select('*, alunos(nome, whatsapp)')
    .eq('academia_id', aid)
    .order('created_at', { ascending: false });

  if (filtros.mes)      query = query.eq('referencia_mes', filtros.mes);
  if (filtros.aluno_id) query = query.eq('aluno_id', filtros.aluno_id);
  if (filtros.status)   query = query.eq('status', filtros.status);

  const { data, error } = await query.limit(filtros.limit || 100);
  if (error) throw error;
  return data;
}

// ─── MÉTRICAS ─────────────────────────────────────

async function buscarMetricasMes() {
  const aid = await getAcademiaId();
  const mesAtual = new Date().toISOString().slice(0, 7);

  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const mesAnterior = d.toISOString().slice(0, 7);

  const [
    ativosRes,
    inadimplentes,
    pagamentosRes,
    pagamentosMesAnteriorRes,
    planosData,
  ] = await Promise.all([
    db.from('alunos').select('id', { count: 'exact' }).eq('academia_id', aid).eq('status', 'ativo'),
    buscarInadimplentes(),
    db.from('pagamentos').select('valor').eq('academia_id', aid).eq('referencia_mes', mesAtual).eq('status', 'pago'),
    db.from('pagamentos').select('valor').eq('academia_id', aid).eq('referencia_mes', mesAnterior).eq('status', 'pago'),
    buscarPlanos(),
  ]);

  const receitaMes         = (pagamentosRes.data || []).reduce((s, p) => s + parseFloat(p.valor), 0);
  const receitaMesAnterior = (pagamentosMesAnteriorRes.data || []).reduce((s, p) => s + parseFloat(p.valor), 0);
  const valorInadimplente  = inadimplentes.reduce((s, a) => s + parseFloat(a.planos_academia?.valor || 0), 0);

  // Agrupar planos por nome para o donut chart
  const planosContagem = {};
  planosData.forEach(p => {
    planosContagem[p.nome] = (planosContagem[p.nome] || 0);
  });

  return {
    totalAtivos:        ativosRes.count || 0,
    totalAtivosPrev:    0,
    totalInadimplentes: inadimplentes.length,
    receitaMes,
    receitaMesAnterior,
    valorInadimplente,
    planos: planosData.map(p => ({ nome: p.nome, count: 1, valor: p.valor })),
  };
}

async function buscarReceitaUltimos6Meses() {
  const aid = await getAcademiaId();
  const resultado = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mes = d.toISOString().slice(0, 7);
    const { data } = await db.from('pagamentos').select('valor')
      .eq('academia_id', aid).eq('referencia_mes', mes).eq('status', 'pago');
    const total = data?.reduce((s, p) => s + parseFloat(p.valor), 0) || 0;
    resultado.push({ mes, total });
  }
  return resultado;
}

// ─── RELATÓRIOS ───────────────────────────────────

async function buscarDadosRelatorio(mes) {
  const aid = await getAcademiaId();
  const { data, error } = await db.from('pagamentos')
    .select('*, alunos(nome, cpf, whatsapp, planos_academia(nome))')
    .eq('academia_id', aid)
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

// ─── ACADEMIA ─────────────────────────────────────

async function buscarAcademia() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db.from('academias')
    .select('*').eq('usuario_id', user.id).limit(1).maybeSingle();
  if (error) return null;
  // Atualiza o cache com o ID real
  if (data?.id) _cachedAcademiaId = data.id;
  return data;
}

async function atualizarAcademia(dados) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  const { data, error } = await db.from('academias')
    .update(dados).eq('usuario_id', user.id).select().maybeSingle();
  if (error) throw error;
  return data;
}

// ─── FREQUÊNCIA ────────────────────────────────

async function registrarFrequencia(alunoId) {
  const aid = await getAcademiaId();
  const hoje = new Date().toISOString().split('T')[0];
  const { data: existing } = await db.from('frequencias')
    .select('id').eq('aluno_id', alunoId).eq('data', hoje).maybeSingle();
  if (existing) throw new Error('Check-in já registrado hoje para este aluno');
  const { data, error } = await db.from('frequencias')
    .insert({ aluno_id: alunoId, academia_id: aid, data: hoje })
    .select().single();
  if (error) throw error;
  return data;
}

async function removerFrequencia(id) {
  const { error } = await db.from('frequencias').delete().eq('id', id);
  if (error) throw error;
}

async function buscarFrequenciasHoje() {
  const aid = await getAcademiaId();
  const hoje = new Date().toISOString().split('T')[0];
  const { data, error } = await db.from('frequencias')
    .select('id, created_at, alunos(id, nome, status, planos_academia(nome))')
    .eq('academia_id', aid)
    .eq('data', hoje)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function buscarFrequenciasAluno(alunoId, limit = 35) {
  const { data, error } = await db.from('frequencias')
    .select('id, data')
    .eq('aluno_id', alunoId)
    .order('data', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function buscarAlunosSemFrequencia(dias = 7) {
  const aid = await getAcademiaId();
  const limite = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];
  const { data: alunos } = await db.from('alunos')
    .select('id, nome, whatsapp, planos_academia(nome)')
    .eq('academia_id', aid)
    .eq('status', 'ativo');
  if (!alunos?.length) return [];
  const { data: recentes } = await db.from('frequencias')
    .select('aluno_id')
    .eq('academia_id', aid)
    .gte('data', limite);
  const idsAtivos = new Set((recentes || []).map(f => f.aluno_id));
  return alunos.filter(a => !idsAtivos.has(a.id));
}

async function buscarFrequenciaPeriodo(inicio, fim) {
  const aid = await getAcademiaId();
  const { data, error } = await db.from('frequencias')
    .select('aluno_id, data')
    .eq('academia_id', aid)
    .gte('data', inicio)
    .lte('data', fim)
    .order('data');
  if (error) throw error;
  return data || [];
}
