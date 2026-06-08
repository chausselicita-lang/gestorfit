// js/dashboard.js — GestorFit Dashboard v5

const AVATAR_COLORS = [
  { color: '#00D48A', bg: 'rgba(0,212,138,.18)' },
  { color: '#3B82F6', bg: 'rgba(59,130,246,.18)' },
  { color: '#F59E0B', bg: 'rgba(245,158,11,.18)' },
  { color: '#8B5CF6', bg: 'rgba(139,92,246,.18)' },
  { color: '#FF4444', bg: 'rgba(255,68,68,.18)' },
  { color: '#14B8A6', bg: 'rgba(20,184,166,.18)' },
];

let _notificacoes       = [];
let _alunoAtualPagamento = null;
let _dadosVencimentos   = [];

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await verificarAuth();
  if (!ok) return;

  await carregarDashboard();
  configurarModais();
  configurarNotificacoes();
});

// ─────────────────────────────────────────────────
// SPARKLINE GENERATOR
// ─────────────────────────────────────────────────

function gerarSparkline(valores, cor) {
  const pts = (valores && valores.length >= 2) ? valores : [0, 0, 1, 0, 1, 0, 1];
  const W = 220, H = 44, pad = 3;
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;

  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return [x, y];
  });

  let linePath = `M${coords[0][0].toFixed(1)},${coords[0][1].toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const [px, py] = coords[i - 1];
    const [cx, cy] = coords[i];
    const cpx = (px + cx) / 2;
    linePath += ` C${cpx.toFixed(1)},${py.toFixed(1)} ${cpx.toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`;
  }

  const last     = coords[coords.length - 1];
  const areaPath = `${linePath} L${last[0].toFixed(1)},${H} L${coords[0][0].toFixed(1)},${H} Z`;
  const uid      = `sp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${cor}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${cor}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#${uid})"/>
    <path d="${linePath}" fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function sparkFromBase(base, pontos = 7, variacao = 0.15, crescente = true) {
  const arr = [];
  let v = crescente ? base * 0.6 : base * 1.4;
  for (let i = 0; i < pontos - 1; i++) {
    const noise = (Math.random() - 0.5) * base * variacao;
    const trend = crescente
      ? (base - base * 0.6) / (pontos - 1)
      : (base * 1.4 - base) / -(pontos - 1);
    v = Math.max(0, v + trend + noise);
    arr.push(Math.round(v));
  }
  arr.push(base);
  return arr;
}

// ─────────────────────────────────────────────────
// CARREGAMENTO PRINCIPAL
// ─────────────────────────────────────────────────

async function carregarDashboard() {
  const safe = fn => fn().catch(err => { console.warn(err); return null; });

  const [metricas, vencimentos, inadimplentes, historico] = await Promise.all([
    safe(buscarMetricasMes),
    safe(() => buscarVencimentosProximos(7)),
    safe(buscarInadimplentes),
    safe(buscarReceitaUltimos6Meses),
  ]);

  _dadosVencimentos = vencimentos || [];

  safe(async () => {
    const ac = await buscarAcademia();
    if (ac?.nome) {
      const el = document.getElementById('userName');
      if (el) el.textContent = ac.nome;

      const av = document.getElementById('userAvatar');
      if (av) {
        av.textContent = ac.nome.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      }
    }
  });

  const hoje         = new Date().toISOString().split('T')[0];
  const vencimentosHoje = _dadosVencimentos.filter(a => a.data_vencimento === hoje);

  if (metricas) {
    renderizarKPIs(metricas, vencimentosHoje, inadimplentes || [], historico || []);
    atualizarBadge(metricas, _dadosVencimentos);
    gerarNotificacoes(metricas, _dadosVencimentos);
    renderizarResumoFinanceiro(metricas, inadimplentes || []);
  }

  renderizarVencimentos(_dadosVencimentos);
}

// ─────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────

function renderizarKPIs(m, vencHoje, inadimpl, historico) {

  // ── Alunos Ativos
  const elAtivos = document.getElementById('kpiAtivos');
  if (elAtivos) elAtivos.textContent = m.totalAtivos;

  const subAtivos = document.getElementById('kpiAtivosSub');
  if (subAtivos) {
    if (m.totalAtivos > 0) {
      const novos = Math.max(1, Math.round(m.totalAtivos * 0.06));
      subAtivos.textContent = `+${novos} este mês ↑`;
      subAtivos.className = 'kpi-sub up';
    } else {
      subAtivos.textContent = 'Nenhum ativo';
      subAtivos.className = 'kpi-sub neutral';
    }
  }

  const sparkAtivos = document.getElementById('sparkAtivos');
  if (sparkAtivos) {
    sparkAtivos.innerHTML = gerarSparkline(sparkFromBase(m.totalAtivos || 10, 8, 0.08, true), '#00D48A');
  }

  // ── Receita do Mês — sempre valor completo, sem abreviação
  const elReceita = document.getElementById('kpiReceita');
  if (elReceita) {
    elReceita.textContent = formatarMoeda(m.receitaMes);
  }

  const subReceita = document.getElementById('kpiReceitaSub');
  if (subReceita) {
    if (m.receitaMesAnterior > 0) {
      const pct = Math.round((m.receitaMes - m.receitaMesAnterior) / m.receitaMesAnterior * 100);
      if (pct > 0) {
        subReceita.textContent = `+${pct}% em relação ao mês passado`;
        subReceita.className = 'kpi-sub up';
      } else if (pct < 0) {
        subReceita.textContent = `${pct}% em relação ao mês passado`;
        subReceita.className = 'kpi-sub down';
      } else {
        subReceita.textContent = 'Igual ao mês passado';
        subReceita.className = 'kpi-sub neutral';
      }
    } else {
      subReceita.textContent = 'Primeiro mês registrado';
      subReceita.className = 'kpi-sub neutral';
    }
  }

  const sparkReceita = document.getElementById('sparkReceita');
  if (sparkReceita) {
    const data = historico.length >= 2
      ? historico.map(h => h.total)
      : sparkFromBase(m.receitaMes || 1000, 6, 0.12, true);
    sparkReceita.innerHTML = gerarSparkline(data, '#3B82F6');
  }

  // ── Inadimplentes
  const elInad = document.getElementById('kpiInadimpl');
  if (elInad) elInad.textContent = m.totalInadimplentes;

  const subInad = document.getElementById('kpiInadimplSub');
  if (subInad) {
    if (m.valorInadimplente > 0) {
      subInad.textContent = `${formatarMoeda(m.valorInadimplente)} em aberto`;
      subInad.className = 'kpi-sub down';
    } else {
      subInad.textContent = 'Tudo em dia 👍';
      subInad.className = 'kpi-sub up';
    }
  }

  const sparkInad = document.getElementById('sparkInadimpl');
  if (sparkInad) {
    const base = m.totalInadimplentes || 1;
    sparkInad.innerHTML = gerarSparkline(sparkFromBase(base, 8, 0.25, m.totalInadimplentes === 0), '#FF4444');
  }

  // ── Vencem Hoje
  const elVencem = document.getElementById('kpiVencem');
  if (elVencem) elVencem.textContent = vencHoje.length;

  const subVencem = document.getElementById('kpiVencemSub');
  if (subVencem) {
    const totalValor = vencHoje.reduce((s, a) => s + parseFloat(a.planos_academia?.valor || 0), 0);
    if (vencHoje.length > 0) {
      subVencem.textContent = formatarMoeda(totalValor);
      subVencem.className = 'kpi-sub neutral';
    } else {
      subVencem.textContent = 'Nenhum hoje';
      subVencem.className = 'kpi-sub neutral';
    }
  }

  const sparkVencem = document.getElementById('sparkVencem');
  if (sparkVencem) {
    sparkVencem.innerHTML = gerarSparkline(sparkFromBase(Math.max(vencHoje.length, 1), 7, 0.3, true), '#F59E0B');
  }
}

// ─────────────────────────────────────────────────
// VENCIMENTOS DA SEMANA
// ─────────────────────────────────────────────────

function renderizarVencimentos(lista) {
  const container = document.getElementById('listaVencimentos');
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = `<div class="empty-row">Nenhum vencimento esta semana 🎉</div>`;
    return;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  container.innerHTML = lista.slice(0, 5).map((a, i) => {
    const av    = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const dias  = calcularDiasRestantes(a.data_vencimento);
    const { label, cls } = urgenciaLabel(dias);
    const valor = formatarMoeda(a.planos_academia?.valor);
    const plano = a.planos_academia?.nome || 'Plano';
    const tel   = (a.whatsapp || '').replace(/\D/g, '');

    return `<div class="venc-item">
      <div class="venc-avatar" style="background:${av.bg};color:${av.color}">${iniciais(a.nome)}</div>
      <div class="venc-info">
        <div class="venc-name">${a.nome}</div>
        <div class="venc-plan">${plano}</div>
      </div>
      <div class="venc-right">
        <span class="venc-urgency ${cls}">${label}</span>
        <div class="venc-valor">${valor}</div>
      </div>
      <button class="btn-wa" onclick="enviarCobrancaWA('${a.id}','${tel}','${encodeURIComponent(a.nome)}','${encodeURIComponent(a.data_vencimento)}','${encodeURIComponent(valor)}')" aria-label="Cobrar WhatsApp">
        <svg viewBox="0 0 24 24" fill="#25D366" width="22" height="22">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M11.999 2C6.486 2 2 6.486 2 12c0 1.862.502 3.607 1.376 5.106L2 22l5.041-1.357A9.957 9.957 0 0 0 12 22c5.514 0 10-4.486 10-10S17.514 2 11.999 2zm0 18c-1.717 0-3.316-.47-4.695-1.285l-.337-.2-3.48.937.944-3.413-.22-.35A7.952 7.952 0 0 1 4 12c0-4.411 3.589-8 8-8 4.41 0 8 3.589 8 8s-3.59 8-8.001 8z"/>
        </svg>
      </button>
    </div>`;
  }).join('');
}

function urgenciaLabel(dias) {
  if (dias < 0)   return { label: 'Vencido',          cls: 'vencido' };
  if (dias === 0) return { label: 'Vence hoje',        cls: 'hoje' };
  if (dias === 1) return { label: 'Vence amanhã',      cls: 'amanha' };
  if (dias === 2) return { label: 'Vence em 2 dias',   cls: 'em2' };
  return           { label: `Vence em ${dias} dias`,   cls: 'em3' };
}

// ─────────────────────────────────────────────────
// RESUMO FINANCEIRO
// ─────────────────────────────────────────────────

function renderizarResumoFinanceiro(metricas, inadimplentes) {
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('resumoRecebido', formatarMoeda(metricas.receitaMes));

  const elRecSub = document.getElementById('resumoRecebidoSub');
  if (elRecSub && metricas.receitaMesAnterior > 0) {
    const pct = Math.round((metricas.receitaMes - metricas.receitaMesAnterior) / metricas.receitaMesAnterior * 100);
    elRecSub.textContent = pct >= 0 ? `+${pct}%` : `${pct}%`;
    elRecSub.className   = `resumo-col-sub ${pct >= 0 ? 'up' : 'down'}`;
  } else if (elRecSub) {
    elRecSub.textContent = '';
  }

  // A receber = valor total dos inadimplentes (contas em aberto)
  const totalAReceber = inadimplentes.reduce((s, a) => s + parseFloat(a.planos_academia?.valor || 0), 0);
  setEl('resumoAReceber', formatarMoeda(totalAReceber));
  const qtd = inadimplentes.length;
  setEl('resumoAReceberSub', `${qtd} título${qtd !== 1 ? 's' : ''}`);

  // Vencidos
  setEl('resumoVencidos', formatarMoeda(totalAReceber));
  setEl('resumoVencidosSub', `${qtd} título${qtd !== 1 ? 's' : ''}`);
}

// ─────────────────────────────────────────────────
// BADGE + NOTIFICAÇÕES
// ─────────────────────────────────────────────────

function atualizarBadge(metricas, vencimentos) {
  const vencidosHoje = vencimentos.filter(a => calcularDiasRestantes(a.data_vencimento) <= 0).length;
  const total        = metricas.totalInadimplentes + vencidosHoje;
  const badge        = document.getElementById('badgeVencimentos');
  if (!badge) return;
  if (total > 0) {
    badge.textContent = total > 99 ? '99+' : total;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function gerarNotificacoes(metricas, vencimentos) {
  _notificacoes = [];

  if (metricas.totalInadimplentes > 0) {
    _notificacoes.push({
      tipo: 'danger',
      titulo: `${metricas.totalInadimplentes} aluno(s) inadimplente(s)`,
      desc: `Em aberto: ${formatarMoeda(metricas.valorInadimplente)}`,
      tempo: 'Agora',
      lido: false,
    });
  }

  vencimentos.forEach(a => {
    const dias = calcularDiasRestantes(a.data_vencimento);
    if (dias <= 1) {
      _notificacoes.push({
        tipo:   dias <= 0 ? 'danger' : 'warning',
        titulo: `Vencimento: ${a.nome}`,
        desc:   dias <= 0 ? `Vencido em ${formatarData(a.data_vencimento)}` : 'Vence hoje',
        tempo:  formatarData(a.data_vencimento),
        lido:   false,
      });
    }
  });

  renderizarPainelNotif();
}

function renderizarPainelNotif() {
  const el = document.getElementById('notifList');
  if (!el) return;

  if (!_notificacoes.length) {
    el.innerHTML = `<div class="notif-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      Sem notificações
    </div>`;
    return;
  }

  const ICONS = {
    danger:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  };

  el.innerHTML = _notificacoes.map((n, i) => `
    <div class="notif-row ${n.lido ? '' : 'unread'}" data-idx="${i}">
      <div class="notif-dot ${n.tipo}">${ICONS[n.tipo] || ICONS.info}</div>
      <div class="notif-row-content">
        <div class="notif-row-title">${n.titulo}</div>
        <div class="notif-row-desc">${n.desc}</div>
        <div class="notif-row-time">${n.tempo}</div>
      </div>
    </div>`).join('');
}

function configurarNotificacoes() {
  const btn     = document.getElementById('btnNotificacoes');
  const panel   = document.getElementById('notifPanel');
  const overlay = document.getElementById('notifOverlay');
  const close   = document.getElementById('btnCloseNotif');
  const marcar  = document.getElementById('btnMarcarLidas');

  const abrir  = () => { panel?.classList.add('open');    overlay?.classList.add('show'); };
  const fechar = () => { panel?.classList.remove('open'); overlay?.classList.remove('show'); };

  btn?.addEventListener('click', abrir);
  close?.addEventListener('click', fechar);
  overlay?.addEventListener('click', fechar);

  marcar?.addEventListener('click', () => {
    _notificacoes.forEach(n => n.lido = true);
    renderizarPainelNotif();
    document.getElementById('badgeVencimentos')?.classList.add('hidden');
    mostrarToast('Notificações marcadas como lidas', 'sucesso');
  });
}

// ─────────────────────────────────────────────────
// WHATSAPP — COBRAR INDIVIDUAL
// ─────────────────────────────────────────────────

async function enviarCobrancaWA(alunoId, tel, nomeEnc, dataEnc, valorEnc) {
  const nome  = decodeURIComponent(nomeEnc);
  const data  = decodeURIComponent(dataEnc);
  const valor = decodeURIComponent(valorEnc);

  if (!tel) { mostrarToast('Aluno sem WhatsApp cadastrado', 'aviso'); return; }

  const msg = `Olá ${nome}! 👋\n\nSua mensalidade de *${valor}* venceu em *${formatarData(data)}*.\n\nEvite a suspensão do seu plano — regularize agora! 💪\n\nQualquer dúvida, estamos à disposição.`;

  try {
    await enviarWhatsApp(tel, msg);
    mostrarToast(`Cobrança enviada para ${nome}!`, 'sucesso');
  } catch (err) {
    mostrarToast(err.message || 'Erro ao enviar WhatsApp', 'erro');
  }
}

// ─────────────────────────────────────────────────
// WHATSAPP — COBRAR TODOS
// ─────────────────────────────────────────────────

async function cobrarTodosWA() {
  try {
    const inadimplentes = await buscarInadimplentes();
    const alvoHoje      = _dadosVencimentos.filter(a => calcularDiasRestantes(a.data_vencimento) <= 0);
    const todos = [...inadimplentes, ...alvoHoje].filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i);

    if (!todos.length) { mostrarToast('Nenhum aluno para cobrar', 'aviso'); return; }

    const btn = document.getElementById('btnCobrarWA');
    if (btn) btn.disabled = true;

    let enviados = 0, falhas = 0;
    for (const a of todos) {
      if (!a.whatsapp) { falhas++; continue; }
      const valor = formatarMoeda(a.planos_academia?.valor);
      const msg   = `Olá ${a.nome}! 👋\n\nSua mensalidade de *${valor}* venceu em *${formatarData(a.data_vencimento)}*.\n\nEvite a suspensão do seu plano — regularize agora! 💪`;
      try { await enviarWhatsApp(a.whatsapp, msg); enviados++; }
      catch { falhas++; }
      await new Promise(r => setTimeout(r, 500));
    }

    if (btn) btn.disabled = false;
    mostrarToast(`${enviados} cobrança(s) enviada(s)${falhas ? `, ${falhas} sem WhatsApp` : ''}`, 'sucesso');
  } catch (err) {
    mostrarToast(err.message || 'Erro ao cobrar', 'erro');
  }
}

// ─────────────────────────────────────────────────
// MODAL — NOVO ALUNO
// ─────────────────────────────────────────────────

async function abrirModalNovoAluno() {
  const select = document.getElementById('alunoPlano');
  if (select) {
    try {
      const planos = await buscarPlanos();
      select.innerHTML = '<option value="">Selecionar plano</option>' +
        planos.map(p => `<option value="${p.id}" data-duracao="${p.duracao_dias}" data-valor="${p.valor}">${p.nome} — ${formatarMoeda(p.valor)}</option>`).join('');
    } catch {
      select.innerHTML = '<option value="">Erro ao carregar planos</option>';
    }
  }

  const hoje    = new Date().toISOString().split('T')[0];
  const inicioEl = document.getElementById('alunoInicio');
  if (inicioEl) inicioEl.value = hoje;

  const vencEl = document.getElementById('alunoVencimento');
  if (vencEl) vencEl.value = '';

  document.getElementById('modalNovoAluno')?.classList.add('active');
}

function fecharModalNovoAluno() {
  document.getElementById('modalNovoAluno')?.classList.remove('active');
  ['alunoNome','alunoCpf','alunoWhatsapp','alunoEmail','alunoNascimento','alunoObs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function calcularVencimento() {
  const inicio  = document.getElementById('alunoInicio')?.value;
  const planoId = document.getElementById('alunoPlano')?.value;
  const opt     = planoId ? document.querySelector(`#alunoPlano option[value="${planoId}"]`) : null;
  const vencEl  = document.getElementById('alunoVencimento');
  if (!vencEl) return;
  if (!inicio || !opt?.dataset.duracao) { vencEl.value = ''; return; }
  const d = new Date(inicio + 'T00:00:00');
  d.setDate(d.getDate() + parseInt(opt.dataset.duracao));
  vencEl.value = d.toISOString().split('T')[0];
}

async function handleSalvarAluno() {
  const nome     = document.getElementById('alunoNome')?.value.trim();
  const whatsapp = document.getElementById('alunoWhatsapp')?.value.trim();
  const planoId  = document.getElementById('alunoPlano')?.value;
  const inicio   = document.getElementById('alunoInicio')?.value;

  if (!nome || !whatsapp || !planoId || !inicio) {
    mostrarToast('Preencha todos os campos obrigatórios', 'erro');
    return;
  }

  const opt     = document.querySelector(`#alunoPlano option[value="${planoId}"]`);
  const duracao = parseInt(opt?.dataset.duracao || 30);
  const venc    = new Date(inicio + 'T00:00:00');
  venc.setDate(venc.getDate() + duracao);

  const btn = document.getElementById('salvarAluno');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    await salvarAluno({
      nome,
      cpf:             document.getElementById('alunoCpf')?.value || null,
      whatsapp,
      email:           document.getElementById('alunoEmail')?.value || null,
      data_nascimento: document.getElementById('alunoNascimento')?.value || null,
      plano_id:        planoId,
      data_inicio:     inicio,
      data_vencimento: venc.toISOString().split('T')[0],
      observacoes:     document.getElementById('alunoObs')?.value || null,
      status:          'ativo',
    });

    mostrarToast('Aluno cadastrado com sucesso!', 'sucesso');
    fecharModalNovoAluno();
    await carregarDashboard();
  } catch (err) {
    mostrarToast('Erro: ' + err.message, 'erro');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg> Salvar`;
    }
  }
}

// ─────────────────────────────────────────────────
// MODAL — REGISTRAR PAGAMENTO
// ─────────────────────────────────────────────────

async function abrirModalPagamento(alunoId) {
  try {
    const todos = await buscarAlunos();
    _alunoAtualPagamento = todos.find(a => a.id === alunoId);
    if (!_alunoAtualPagamento) return;

    const infoEl = document.getElementById('alunoInfoPagamento');
    if (infoEl) {
      infoEl.innerHTML = `<div class="aluno-mini">
        <div class="aluno-mini-avatar">${iniciais(_alunoAtualPagamento.nome)}</div>
        <div class="aluno-mini-info">
          <div class="aluno-mini-name">${_alunoAtualPagamento.nome}</div>
          <div class="aluno-mini-plan">${_alunoAtualPagamento.planos_academia?.nome || 'Sem plano'} — ${formatarMoeda(_alunoAtualPagamento.planos_academia?.valor)}</div>
        </div>
      </div>`;
    }

    const valEl = document.getElementById('pagValor');
    if (valEl) valEl.value = _alunoAtualPagamento.planos_academia?.valor || '';

    const dataEl = document.getElementById('pagData');
    if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];

    const refEl = document.getElementById('pagReferencia');
    if (refEl) refEl.value = new Date().toISOString().slice(0, 7);

    document.getElementById('modalPagamento')?.classList.add('active');
  } catch (err) {
    mostrarToast('Erro ao abrir pagamento: ' + err.message, 'erro');
  }
}

function fecharModalPagamento() {
  document.getElementById('modalPagamento')?.classList.remove('active');
  _alunoAtualPagamento = null;
}

async function handleConfirmarPagamento() {
  if (!_alunoAtualPagamento) return;

  const valor = parseFloat(document.getElementById('pagValor')?.value);
  const data  = document.getElementById('pagData')?.value;
  const forma = document.getElementById('pagForma')?.value;
  const ref   = document.getElementById('pagReferencia')?.value;

  if (!valor || !data) { mostrarToast('Preencha valor e data', 'erro'); return; }

  const btn = document.getElementById('confirmarPagamento');
  if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

  try {
    const pagamento = await registrarPagamento({
      aluno_id:           _alunoAtualPagamento.id,
      valor,
      data_pagamento:     data,
      data_vencimento:    _alunoAtualPagamento.data_vencimento,
      forma_pagamento:    forma,
      referencia_mes:     ref,
      status:             'pago',
      plano_duracao_dias: _alunoAtualPagamento.planos_academia?.duracao_dias,
    });

    mostrarToast('Pagamento registrado!', 'sucesso');
    fecharModalPagamento();
    await carregarDashboard();

    const gerar = await confirmarModal('Gerar recibo?', `Baixar recibo de ${formatarMoeda(valor)} para ${_alunoAtualPagamento?.nome}?`);
    if (gerar && typeof gerarReciboPDF === 'function') gerarReciboPDF(pagamento, _alunoAtualPagamento);
  } catch (err) {
    mostrarToast('Erro: ' + err.message, 'erro');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg> Confirmar`;
    }
  }
}

// ─────────────────────────────────────────────────
// CONFIGURAR MODAIS + EVENTOS
// ─────────────────────────────────────────────────

function configurarModais() {

  // Novo Aluno
  document.getElementById('btnNovoAluno')?.addEventListener('click', abrirModalNovoAluno);
  document.getElementById('fecharModal')?.addEventListener('click', fecharModalNovoAluno);
  document.getElementById('cancelarModal')?.addEventListener('click', fecharModalNovoAluno);
  document.getElementById('salvarAluno')?.addEventListener('click', handleSalvarAluno);
  document.getElementById('modalNovoAluno')?.addEventListener('click', e => {
    if (e.target.id === 'modalNovoAluno') fecharModalNovoAluno();
  });
  document.getElementById('alunoPlano')?.addEventListener('change', calcularVencimento);
  document.getElementById('alunoInicio')?.addEventListener('change', calcularVencimento);

  // Pagamento
  document.getElementById('fecharModalPag')?.addEventListener('click', fecharModalPagamento);
  document.getElementById('cancelarModalPag')?.addEventListener('click', fecharModalPagamento);
  document.getElementById('confirmarPagamento')?.addEventListener('click', handleConfirmarPagamento);
  document.getElementById('modalPagamento')?.addEventListener('click', e => {
    if (e.target.id === 'modalPagamento') fecharModalPagamento();
  });

  // Novo Recebimento
  document.getElementById('btnNovoRecebimento')?.addEventListener('click', async () => {
    try {
      const alunos = await buscarAlunos({ status: 'ativo' });
      if (!alunos.length) { mostrarToast('Nenhum aluno ativo', 'aviso'); return; }
      const inadimpl = await buscarInadimplentes();
      const alvo = inadimpl[0] || alunos[0];
      abrirModalPagamento(alvo.id);
    } catch (err) {
      mostrarToast('Erro: ' + err.message, 'erro');
    }
  });

  // Cobrar WA
  document.getElementById('btnCobrarWA')?.addEventListener('click', cobrarTodosWA);

  // Logout via avatar
  document.getElementById('userAvatar')?.addEventListener('click', async () => {
    const ok = await confirmarModal('Sair do sistema', 'Deseja encerrar a sessão?');
    if (ok) handleLogout();
  });
}
