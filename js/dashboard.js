// js/dashboard.js — Lógica do Dashboard

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await verificarAuth();
  if (!ok) return;

  document.getElementById('pageDate').textContent =
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  await carregarDashboard();
  configurarModais();
  configurarNavegacao();
  configurarMenuMobile();
});

async function carregarDashboard() {
  try {
    const [metricas, vencimentos, pagamentos] = await Promise.all([
      buscarMetricasMes(),
      buscarVencimentosProximos(7),
      buscarPagamentos({ limit: 8 }),
    ]);

    renderizarMetricas(metricas);
    renderizarVencimentos(vencimentos);
    renderizarUltimosPagamentos(pagamentos);

    document.getElementById('badgeVencimentos').textContent =
      vencimentos.length + metricas.totalInadimplentes;

    await renderizarGraficos();
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
  document.getElementById('valorInadimplente').textContent = `Em aberto: ${formatarMoeda(m.valorInadimplente)}`;
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
          <span class="badge-urgencia ${urgencia}">${dias <= 0 ? 'VENCIDO' : dias === 0 ? 'Hoje' : `${dias}d`}</span>
          <span class="row-valor">${formatarMoeda(aluno.planos_academia?.valor)}</span>
          <button class="btn-pagar" onclick="abrirModalPagamento('${aluno.id}')">Pagar</button>
        </div>
      </div>`;
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
    </div>`).join('');
}

async function renderizarGraficos() {
  if (typeof Chart === 'undefined') return;

  const historico = await buscarReceitaUltimos6Meses();
  const labels = historico.map(h => nomeMes(h.mes));
  const valores = historico.map(h => h.total);

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
        backgroundColor: 'rgba(0,255,135,0.2)',
        borderColor: 'rgba(0,255,135,0.8)',
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#8892A4' } },
        y: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#8892A4', callback: v => 'R$ ' + (v / 1000).toFixed(0) + 'k' },
        },
      },
    },
  });
}

async function atualizarStatusInadimplentes() {
  const inadimplentes = await buscarInadimplentes();
  await Promise.all(
    inadimplentes
      .filter(a => a.status !== 'inadimplente')
      .map(a => atualizarAluno(a.id, { status: 'inadimplente' }))
  );
}

// =====================================
// MODAIS
// =====================================

function configurarModais() {
  document.getElementById('btnNovoAluno').onclick = abrirModalNovoAluno;
  document.getElementById('fecharModal').onclick = fecharModalNovoAluno;
  document.getElementById('cancelarModal').onclick = fecharModalNovoAluno;
  document.getElementById('salvarAluno').onclick = handleSalvarAluno;

  document.getElementById('fecharModalPag').onclick = fecharModalPagamento;
  document.getElementById('cancelarModalPag').onclick = fecharModalPagamento;
  document.getElementById('confirmarPagamento').onclick = handleConfirmarPagamento;

  document.getElementById('modalNovoAluno').onclick = e => {
    if (e.target.id === 'modalNovoAluno') fecharModalNovoAluno();
  };
  document.getElementById('modalPagamento').onclick = e => {
    if (e.target.id === 'modalPagamento') fecharModalPagamento();
  };
}

async function abrirModalNovoAluno() {
  await carregarPlanosNoSelect('alunoPlano');
  document.getElementById('alunoInicio').value = new Date().toISOString().split('T')[0];
  document.getElementById('modalNovoAluno').classList.add('active');
}

function fecharModalNovoAluno() {
  document.getElementById('modalNovoAluno').classList.remove('active');
}

async function carregarPlanosNoSelect(selectId) {
  const planos = await buscarPlanos();
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">Selecione o plano</option>' +
    planos.map(p => `<option value="${p.id}" data-duracao="${p.duracao_dias}" data-valor="${p.valor}">${p.nome} — ${formatarMoeda(p.valor)}</option>`).join('');
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

  const opt = document.querySelector(`#alunoPlano option[value="${planoId}"]`);
  const duracao = parseInt(opt.dataset.duracao);
  const venc = new Date(inicio + 'T00:00:00');
  venc.setDate(venc.getDate() + duracao);

  const btn = document.getElementById('salvarAluno');
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  try {
    await salvarAluno({
      nome,
      cpf: document.getElementById('alunoCpf').value,
      whatsapp,
      email: document.getElementById('alunoEmail').value,
      data_nascimento: document.getElementById('alunoNascimento').value || null,
      plano_id: planoId,
      data_inicio: inicio,
      data_vencimento: venc.toISOString().split('T')[0],
      observacoes: document.getElementById('alunoObs').value,
    });
    mostrarToast('✅ Aluno cadastrado com sucesso!');
    fecharModalNovoAluno();
    await carregarDashboard();
  } catch (err) {
    mostrarToast('Erro: ' + err.message, 'erro');
  } finally {
    btn.textContent = 'Salvar Aluno';
    btn.disabled = false;
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
    </div>`;

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
    plano_duracao_dias: alunoAtualPagamento.planos_academia?.duracao_dias,
  };

  const btn = document.getElementById('confirmarPagamento');
  btn.textContent = 'Processando...';
  btn.disabled = true;

  try {
    const pagamento = await registrarPagamento(dados);
    mostrarToast('✅ Pagamento registrado!');
    fecharModalPagamento();
    await carregarDashboard();

    if (confirm('Deseja gerar o recibo em PDF?')) {
      gerarReciboPDF(pagamento, alunoAtualPagamento);
    }
  } catch (err) {
    mostrarToast('Erro: ' + err.message, 'erro');
  } finally {
    btn.textContent = '✅ Confirmar Pagamento';
    btn.disabled = false;
  }
}

// =====================================
// NAVEGAÇÃO
// =====================================

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

function configurarMenuMobile() {
  const btn = document.getElementById('btnMenuMobile');
  const sidebar = document.getElementById('sidebar');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}
