// js/dashboard.js — Dashboard GestorFit v2

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await verificarAuth();
  if (!ok) return;

  document.getElementById('pageDate').textContent =
    new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  await carregarDashboard();
  configurarModais();
  configurarNavegacao();
  configurarMenuMobile();
  configurarNotificacoes();

  if (typeof lucide !== 'undefined') lucide.createIcons();
});

// ─────────────────────────────────────────────────
// CARREGAMENTO PRINCIPAL
// ─────────────────────────────────────────────────

async function carregarDashboard() {
  // Cada seção carrega independentemente — falha de uma não trava as outras
  const safe = (fn) => fn().catch(err => { console.error(err); return null; });

  const [metricas, vencimentos, pagamentos, alunosRec] = await Promise.all([
    safe(buscarMetricasMes),
    safe(() => buscarVencimentosProximos(7)),
    safe(() => buscarPagamentos({ limit: 8 })),
    safe(() => buscarAlunosRecentes(6)),
  ]);

  if (metricas) {
    renderizarKPIs(metricas, vencimentos || []);
    atualizarBadgeNotificacoes(metricas, vencimentos || []);
    gerarNotificacoes(metricas, vencimentos || []);
  } else {
    // Mostrar skeletons como estado de erro
    ['skAtivos','skReceita','skInadimpl','skVenc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:8px">Falha ao carregar</div>';
    });
    mostrarToast('Erro ao carregar métricas — verifique a conexão', 'erro');
  }

  renderizarGraficos();
  renderizarAlunosRecentes(alunosRec || []);
  renderizarInadimplentes();
  renderizarVencimentos(vencimentos || []);
  renderizarUltimosPagamentos(pagamentos || []);

  safe(atualizarStatusInadimplentes);
}

// ─────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────

function _setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function _setTrend(id, atual, anterior) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!anterior || anterior === 0) {
    el.className = 'kpi-trend-badge neutral';
    el.textContent = '–';
    return;
  }
  const pct = ((atual - anterior) / anterior * 100).toFixed(0);
  if (Number(pct) > 0) {
    el.className = 'kpi-trend-badge up';
    el.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg> ${pct}%`;
  } else if (Number(pct) < 0) {
    el.className = 'kpi-trend-badge down';
    el.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg> ${Math.abs(pct)}%`;
  } else {
    el.className = 'kpi-trend-badge neutral';
    el.textContent = '0%';
  }
}

function renderizarKPIs(m, vencimentos) {
  // Alunos Ativos
  _setEl('totalAtivos', m.totalAtivos);
  _setTrend('trendAtivos', m.totalAtivos, m.totalAtivosPrev);
  showKpiData('skAtivos', 'dataAtivos');

  // Receita do mês
  _setEl('receitaMes', formatarMoeda(m.receitaMes));
  _setTrend('trendReceita', m.receitaMes, m.receitaMesAnterior);
  _setEl('totalReceitaLabel', m.receitaMes > 0 ? formatarMoeda(m.receitaMes) + ' este mês' : '');
  showKpiData('skReceita', 'dataReceita');

  // Inadimplentes
  _setEl('totalInadimplentes', m.totalInadimplentes);
  const elInad = document.getElementById('trendInadimpl');
  if (elInad) {
    elInad.className = m.totalInadimplentes > 0 ? 'kpi-trend-badge down' : 'kpi-trend-badge neutral';
    elInad.textContent = m.totalInadimplentes > 0 ? 'Atenção' : 'OK';
  }
  _setEl('valorInadimplente', m.valorInadimplente > 0 ? `Em aberto: ${formatarMoeda(m.valorInadimplente)}` : '');
  _setEl('countInadimpl', m.totalInadimplentes);
  showKpiData('skInadimpl', 'dataInadimpl');

  // Vencimentos 7 dias
  _setEl('vencemHoje', vencimentos.length);
  const elVenc = document.getElementById('trendVenc');
  if (elVenc) {
    elVenc.className = vencimentos.length > 0 ? 'kpi-trend-badge down' : 'kpi-trend-badge neutral';
    elVenc.textContent = vencimentos.length > 0 ? 'Urgente' : 'OK';
  }
  _setEl('countVencimentos', vencimentos.length);
  showKpiData('skVenc', 'dataVenc');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─────────────────────────────────────────────────
// GRÁFICO RECEITA
// ─────────────────────────────────────────────────

async function renderizarGraficos() {
  try {
    const historico = await buscarReceitaUltimos6Meses();
    const labels    = historico.map(h => nomeMes(h.mes));
    const valores   = historico.map(h => h.total);

    const skChart   = document.getElementById('skChart');
    const chartWrap = document.getElementById('chartWrap');
    if (skChart)   skChart.style.display = 'none';
    if (chartWrap) chartWrap.style.display = 'block';

    const ctx = document.getElementById('graficoReceita');
    if (!ctx) return;

    if (window._chartReceita) window._chartReceita.destroy();

    window._chartReceita = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Receita',
          data: valores,
          backgroundColor: 'rgba(108,99,255,0.25)',
          borderColor: '#6C63FF',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
          hoverBackgroundColor: 'rgba(108,99,255,0.4)',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#16161E',
            borderColor: '#2A2A3A',
            borderWidth: 1,
            titleColor: '#F1F1F6',
            bodyColor: '#8B8BA7',
            padding: 12,
            callbacks: {
              label: ctx => ' ' + formatarMoeda(ctx.raw),
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: { color: '#8B8BA7', font: { family: 'Inter', size: 12 } },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: {
              color: '#8B8BA7',
              font: { family: 'Inter', size: 12 },
              callback: v => v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : 'R$' + v,
            },
          },
        },
      },
    });
  } catch (err) {
    console.error('Erro ao renderizar gráfico:', err);
  }
}

// ─────────────────────────────────────────────────
// ALUNOS RECENTES
// ─────────────────────────────────────────────────

function renderizarAlunosRecentes(alunos) {
  const container = document.getElementById('alunosRecentes');
  if (!alunos.length) {
    container.innerHTML = `<div class="empty-state">${SVG.empty}<span>Nenhum aluno cadastrado</span></div>`;
    return;
  }

  const avatarColors = ['#6C63FF', '#00D4AA', '#FF4757', '#FFA502', '#667EEA'];

  container.innerHTML = `<div class="recent-list">` + alunos.map((a, i) => `
    <div class="recent-item">
      <div class="student-avatar" style="background:${avatarColors[i % avatarColors.length]}">
        ${iniciais(a.nome)}
      </div>
      <div class="recent-info">
        <div class="recent-name">${a.nome}</div>
        <div class="recent-plan">${a.planos_academia?.nome || 'Sem plano'}</div>
      </div>
      ${getStatusBadge(a.status)}
    </div>`).join('') + `</div>`;
}

// ─────────────────────────────────────────────────
// INADIMPLENTES
// ─────────────────────────────────────────────────

async function renderizarInadimplentes() {
  const container = document.getElementById('listaInadimplentes');
  try {
    const lista = await buscarInadimplentes();
    if (!lista.length) {
      container.innerHTML = `<div class="empty-state">${SVG.empty}<span>Nenhum inadimplente</span></div>`;
      return;
    }
    container.innerHTML = lista.map(a => {
      const dias = Math.abs(calcularDiasRestantes(a.data_vencimento));
      return `
        <div class="inadimpl-row">
          <div class="inadimpl-avatar">${iniciais(a.nome)}</div>
          <div class="inadimpl-info">
            <div class="inadimpl-name">${a.nome}</div>
            <div class="inadimpl-days">${dias}d em atraso</div>
          </div>
          <div class="inadimpl-valor">${formatarMoeda(a.planos_academia?.valor)}</div>
          <button class="btn-pagar" onclick="abrirModalPagamento('${a.id}')">Pagar</button>
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${SVG.empty}<span>Erro ao carregar</span></div>`;
  }
}

// ─────────────────────────────────────────────────
// VENCIMENTOS
// ─────────────────────────────────────────────────

function renderizarVencimentos(vencimentos) {
  const container = document.getElementById('tabelaVencimentos');
  if (!vencimentos.length) {
    container.innerHTML = `<div class="empty-state">${SVG.empty}<span>Nenhum vencimento nos próximos 7 dias</span></div>`;
    return;
  }
  container.innerHTML = vencimentos.map(a => {
    const dias = calcularDiasRestantes(a.data_vencimento);
    const urg  = dias <= 0 ? 'vermelho' : dias <= 2 ? 'amarelo' : 'verde';
    const label = dias <= 0 ? 'Vencido' : dias === 0 ? 'Hoje' : `${dias}d`;
    return `
      <div class="table-row">
        <div class="row-info">
          <span class="row-nome">${a.nome}</span>
          <span class="row-plano">${a.planos_academia?.nome || '--'}</span>
        </div>
        <div class="row-meta">
          <span class="badge-urgencia ${urg}">${label}</span>
          <span class="row-valor">${formatarMoeda(a.planos_academia?.valor)}</span>
          <button class="btn-pagar" onclick="abrirModalPagamento('${a.id}')">Pagar</button>
        </div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────
// ÚLTIMOS PAGAMENTOS
// ─────────────────────────────────────────────────

function renderizarUltimosPagamentos(pagamentos) {
  const container = document.getElementById('tabelaUltimosPagamentos');
  if (!pagamentos.length) {
    container.innerHTML = `<div class="empty-state">${SVG.empty}<span>Nenhum pagamento registrado</span></div>`;
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
    </div>`).join('');
}

// ─────────────────────────────────────────────────
// INADIMPLENTES — atualizar status no Supabase
// ─────────────────────────────────────────────────

async function atualizarStatusInadimplentes() {
  try {
    const lista = await buscarInadimplentes();
    await Promise.all(
      lista
        .filter(a => a.status !== 'inadimplente')
        .map(a => atualizarAluno(a.id, { status: 'inadimplente' }))
    );
  } catch (err) {
    console.warn('Erro ao atualizar status inadimplentes:', err);
  }
}

// ─────────────────────────────────────────────────
// BADGE NOTIFICAÇÕES
// ─────────────────────────────────────────────────

function atualizarBadgeNotificacoes(metricas, vencimentos) {
  const total  = metricas.totalInadimplentes + vencimentos.length;
  const badge  = document.getElementById('badgeVencimentos');
  if (!badge) return;
  if (total > 0) {
    badge.textContent = total > 99 ? '99+' : total;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────
// PAINEL DE NOTIFICAÇÕES
// ─────────────────────────────────────────────────

let _notificacoes = [];

function gerarNotificacoes(metricas, vencimentos) {
  _notificacoes = [];

  // Inadimplentes
  if (metricas.totalInadimplentes > 0) {
    _notificacoes.push({
      tipo: 'danger',
      titulo: `${metricas.totalInadimplentes} aluno(s) inadimplente(s)`,
      desc: `Em aberto: ${formatarMoeda(metricas.valorInadimplente)}`,
      tempo: 'Agora',
      lido: false,
    });
  }

  // Vencimentos próximos
  vencimentos.forEach(a => {
    const dias = calcularDiasRestantes(a.data_vencimento);
    if (dias <= 3) {
      _notificacoes.push({
        tipo: dias <= 0 ? 'danger' : 'warning',
        titulo: `Vencimento: ${a.nome}`,
        desc: dias <= 0 ? 'Plano vencido' : `Vence em ${dias} dia(s)`,
        tempo: formatarData(a.data_vencimento),
        lido: false,
      });
    }
  });

  renderizarPainelNotificacoes();
}

function renderizarPainelNotificacoes() {
  const container = document.getElementById('notifList');
  if (!container) return;

  if (!_notificacoes.length) {
    container.innerHTML = `
      <div class="notif-empty">
        ${SVG.bell}
        <span>Nenhuma notificação</span>
      </div>`;
    return;
  }

  const ICONS = {
    danger:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  };

  container.innerHTML = _notificacoes.map((n, i) => `
    <div class="notif-item ${n.lido ? '' : 'unread'}" data-idx="${i}">
      <div class="notif-dot ${n.tipo}">${ICONS[n.tipo] || ICONS.info}</div>
      <div class="notif-content">
        <div class="notif-title">${n.titulo}</div>
        <div class="notif-desc">${n.desc}</div>
        <div class="notif-time">${n.tempo}</div>
      </div>
    </div>`).join('');
}

function configurarNotificacoes() {
  const btnNotif      = document.getElementById('btnNotificacoes');
  const panel         = document.getElementById('notifPanel');
  const overlay       = document.getElementById('panelOverlay');
  const btnClose      = document.getElementById('btnCloseNotif');
  const btnMarcarLidas = document.getElementById('btnMarcarLidas');

  const open = () => {
    panel?.classList.add('open');
    overlay?.classList.add('show');
  };

  const close = () => {
    panel?.classList.remove('open');
    overlay?.classList.remove('show');
  };

  btnNotif?.addEventListener('click', open);
  btnClose?.addEventListener('click', close);
  overlay?.addEventListener('click', close);

  btnMarcarLidas?.addEventListener('click', () => {
    _notificacoes.forEach(n => n.lido = true);
    renderizarPainelNotificacoes();
    const badge = document.getElementById('badgeVencimentos');
    if (badge) badge.style.display = 'none';
    mostrarToast('Notificações marcadas como lidas', 'sucesso');
  });
}

// ─────────────────────────────────────────────────
// MODAL — NOVO ALUNO
// ─────────────────────────────────────────────────

async function abrirModalNovoAluno() {
  await carregarPlanosNoSelect('alunoPlano');
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('alunoInicio').value = hoje;
  document.getElementById('alunoVencimento').value = '';
  document.getElementById('modalNovoAluno').classList.add('active');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharModalNovoAluno() {
  document.getElementById('modalNovoAluno').classList.remove('active');
  ['alunoNome','alunoCpf','alunoWhatsapp','alunoEmail','alunoNascimento','alunoObs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

async function carregarPlanosNoSelect(selectId) {
  const planos = await buscarPlanos();
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">Selecione o plano</option>' +
    planos.map(p =>
      `<option value="${p.id}" data-duracao="${p.duracao_dias}" data-valor="${p.valor}">
        ${p.nome} — ${formatarMoeda(p.valor)}
      </option>`
    ).join('');
}

async function handleSalvarAluno() {
  const nome     = document.getElementById('alunoNome').value.trim();
  const whatsapp = document.getElementById('alunoWhatsapp').value.trim();
  const planoId  = document.getElementById('alunoPlano').value;
  const inicio   = document.getElementById('alunoInicio').value;

  if (!nome || !whatsapp || !planoId || !inicio) {
    mostrarToast('Preencha todos os campos obrigatórios', 'erro');
    return;
  }

  const opt    = document.querySelector(`#alunoPlano option[value="${planoId}"]`);
  const duracao = parseInt(opt.dataset.duracao);
  const venc   = new Date(inicio + 'T00:00:00');
  venc.setDate(venc.getDate() + duracao);

  const btn = document.getElementById('salvarAluno');
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></div> Salvando...';
  btn.disabled = true;

  try {
    await salvarAluno({
      nome,
      cpf:           document.getElementById('alunoCpf').value,
      whatsapp,
      email:         document.getElementById('alunoEmail').value,
      data_nascimento: document.getElementById('alunoNascimento').value || null,
      plano_id:      planoId,
      data_inicio:   inicio,
      data_vencimento: venc.toISOString().split('T')[0],
      observacoes:   document.getElementById('alunoObs').value,
    });
    mostrarToast('Aluno cadastrado com sucesso!', 'sucesso');
    fecharModalNovoAluno();
    await carregarDashboard();
  } catch (err) {
    mostrarToast('Erro ao salvar: ' + err.message, 'erro');
  } finally {
    btn.innerHTML = `<i data-lucide="save"></i> Salvar Aluno`;
    btn.disabled = false;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// Calcular vencimento ao mudar plano ou data de início
function configurarAutoVencimento() {
  const calcVenc = () => {
    const inicio  = document.getElementById('alunoInicio').value;
    const planoId = document.getElementById('alunoPlano').value;
    const opt     = document.querySelector(`#alunoPlano option[value="${planoId}"]`);
    if (!inicio || !opt) { document.getElementById('alunoVencimento').value = ''; return; }
    const duracao = parseInt(opt.dataset.duracao);
    const venc    = new Date(inicio + 'T00:00:00');
    venc.setDate(venc.getDate() + duracao);
    document.getElementById('alunoVencimento').value = venc.toISOString().split('T')[0];
  };
  document.getElementById('alunoPlano')?.addEventListener('change', calcVenc);
  document.getElementById('alunoInicio')?.addEventListener('change', calcVenc);
}

// ─────────────────────────────────────────────────
// MODAL — REGISTRAR PAGAMENTO
// ─────────────────────────────────────────────────

let _alunoAtualPagamento = null;

async function abrirModalPagamento(alunoId) {
  const todos = await buscarAlunos();
  _alunoAtualPagamento = todos.find(a => a.id === alunoId);
  if (!_alunoAtualPagamento) return;

  document.getElementById('alunoInfoPagamento').innerHTML = `
    <div class="aluno-card-mini">
      <strong>${_alunoAtualPagamento.nome}</strong>
      <span>${_alunoAtualPagamento.planos_academia?.nome} — ${formatarMoeda(_alunoAtualPagamento.planos_academia?.valor)}</span>
    </div>`;

  document.getElementById('pagValor').value      = _alunoAtualPagamento.planos_academia?.valor || '';
  document.getElementById('pagData').value       = new Date().toISOString().split('T')[0];
  document.getElementById('pagReferencia').value = new Date().toISOString().slice(0, 7);
  document.getElementById('modalPagamento').classList.add('active');
}

function fecharModalPagamento() {
  document.getElementById('modalPagamento').classList.remove('active');
  _alunoAtualPagamento = null;
}

async function handleConfirmarPagamento() {
  if (!_alunoAtualPagamento) return;

  const dados = {
    aluno_id:          _alunoAtualPagamento.id,
    valor:             parseFloat(document.getElementById('pagValor').value),
    data_pagamento:    document.getElementById('pagData').value,
    data_vencimento:   _alunoAtualPagamento.data_vencimento,
    forma_pagamento:   document.getElementById('pagForma').value,
    referencia_mes:    document.getElementById('pagReferencia').value,
    status:            'pago',
    plano_duracao_dias: _alunoAtualPagamento.planos_academia?.duracao_dias,
  };

  const btn = document.getElementById('confirmarPagamento');
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></div> Processando...';
  btn.disabled = true;

  try {
    const pagamento = await registrarPagamento(dados);
    mostrarToast('Pagamento registrado com sucesso!', 'sucesso');
    fecharModalPagamento();
    await carregarDashboard();

    const gerar = await confirmarModal('Gerar recibo em PDF?', `Pagamento de ${formatarMoeda(dados.valor)} para ${_alunoAtualPagamento?.nome || ''}.\nDeseja baixar o recibo?`);
    if (gerar) gerarReciboPDF(pagamento, _alunoAtualPagamento);
  } catch (err) {
    mostrarToast('Erro: ' + err.message, 'erro');
  } finally {
    btn.innerHTML = `<i data-lucide="check"></i> Confirmar Pagamento`;
    btn.disabled = false;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// ─────────────────────────────────────────────────
// CONFIGURAR MODAIS + EVENTOS
// ─────────────────────────────────────────────────

function configurarModais() {
  // Novo aluno
  document.getElementById('btnNovoAluno')?.addEventListener('click', abrirModalNovoAluno);
  document.getElementById('fecharModal')?.addEventListener('click', fecharModalNovoAluno);
  document.getElementById('cancelarModal')?.addEventListener('click', fecharModalNovoAluno);
  document.getElementById('salvarAluno')?.addEventListener('click', handleSalvarAluno);
  document.getElementById('modalNovoAluno')?.addEventListener('click', e => {
    if (e.target.id === 'modalNovoAluno') fecharModalNovoAluno();
  });

  // Pagamento
  document.getElementById('fecharModalPag')?.addEventListener('click', fecharModalPagamento);
  document.getElementById('cancelarModalPag')?.addEventListener('click', fecharModalPagamento);
  document.getElementById('confirmarPagamento')?.addEventListener('click', handleConfirmarPagamento);
  document.getElementById('modalPagamento')?.addEventListener('click', e => {
    if (e.target.id === 'modalPagamento') fecharModalPagamento();
  });

  configurarAutoVencimento();
}

// ─────────────────────────────────────────────────
// NAVEGAÇÃO SIDEBAR
// ─────────────────────────────────────────────────

function configurarNavegacao() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page && page !== 'dashboard') {
        window.location.href = `pages/${page}.html`;
      }
    });
  });
}

function configurarMenuMobile() {
  const btn     = document.getElementById('btnMenuMobile');
  const sidebar = document.getElementById('sidebar');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}
