// js/utils.js — Funções auxiliares GestorFit v2

// ─── Formatação ───────────────────────────────────
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
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
  const d = new Date();
  d.setDate(d.getDate() + duracaoDias);
  return d.toISOString().split('T')[0];
}

function calcularDiasRestantes(dataVencimento) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento + 'T00:00:00');
  return Math.ceil((venc - hoje) / 86400000);
}

function nomeMes(mesStr) {
  const [ano, mes] = mesStr.split('-');
  return new Date(parseInt(ano), parseInt(mes) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function formatarCPF(cpf) {
  return (cpf || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatarTelefone(tel) {
  return (tel || '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
}

function iniciais(nome) {
  return (nome || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

// ─── Badges ───────────────────────────────────────
function getStatusBadge(status) {
  const map = {
    ativo:        '<span class="badge-status verde">Ativo</span>',
    inativo:      '<span class="badge-status cinza">Inativo</span>',
    inadimplente: '<span class="badge-status vermelho">Inadimplente</span>',
    cancelado:    '<span class="badge-status preto">Cancelado</span>',
  };
  return map[status] || status;
}

function getFormaPagamentoBadge(forma) {
  const map = {
    pix:            'PIX',
    dinheiro:       'Dinheiro',
    cartao_credito: 'Crédito',
    cartao_debito:  'Débito',
  };
  return map[forma] || forma;
}

// ─── Trend badge HTML ──────────────────────────────
function trendBadge(atual, anterior) {
  if (!anterior || anterior === 0) {
    return `<span class="kpi-trend-badge neutral">–</span>`;
  }
  const pct = ((atual - anterior) / anterior * 100).toFixed(0);
  if (pct > 0) {
    return `<span class="kpi-trend-badge up">
      <svg viewBox="0 0 24 24" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
      ${pct}%
    </span>`;
  } else if (pct < 0) {
    return `<span class="kpi-trend-badge down">
      <svg viewBox="0 0 24 24" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      ${Math.abs(pct)}%
    </span>`;
  }
  return `<span class="kpi-trend-badge neutral">0%</span>`;
}

// ─── Toast ─────────────────────────────────────────
let _toastContainer = null;

function _getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

const TOAST_ICONS = {
  sucesso: '<svg viewBox="0 0 24 24" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  erro:    '<svg viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  aviso:   '<svg viewBox="0 0 24 24" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info:    '<svg viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

function mostrarToast(mensagem, tipo = 'sucesso') {
  const container = _getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<span class="toast-icon">${TOAST_ICONS[tipo] || TOAST_ICONS.info}</span><span>${mensagem}</span>`;
  toast.addEventListener('click', () => _removeToast(toast));
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(() => _removeToast(toast), 3500);
}

function _removeToast(toast) {
  toast.classList.remove('show');
  setTimeout(() => toast.remove(), 350);
}

// ─── Confirm Modal (substitui window.confirm) ──────
function confirmarModal(titulo, mensagem) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modalConfirmar');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl   = document.getElementById('confirmMsg');
    const simBtn  = document.getElementById('confirmSim');
    const naoBtn  = document.getElementById('confirmNao');

    if (!overlay) { resolve(window.confirm(`${titulo}\n${mensagem}`)); return; }

    titleEl.textContent = titulo;
    msgEl.textContent   = mensagem;
    overlay.classList.add('active');

    const cleanup = (val) => {
      overlay.classList.remove('active');
      simBtn.removeEventListener('click', onSim);
      naoBtn.removeEventListener('click', onNao);
      resolve(val);
    };

    const onSim = () => cleanup(true);
    const onNao = () => cleanup(false);

    simBtn.addEventListener('click', onSim, { once: true });
    naoBtn.addEventListener('click', onNao, { once: true });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) cleanup(false);
    }, { once: true });
  });
}

// ─── KPI skeleton toggle ───────────────────────────
function showKpiData(skId, dataId) {
  const sk = document.getElementById(skId);
  const dt = document.getElementById(dataId);
  if (sk) sk.style.display = 'none';
  if (dt) dt.style.display = 'flex';
}

// ─── Loading helper ────────────────────────────────
function mostrarLoading(elemento, texto = 'Carregando...') {
  if (typeof elemento === 'string') elemento = document.getElementById(elemento);
  if (elemento) {
    elemento.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>${texto}</span></div>`;
  }
}

// ─── Confirmar (backward compat) ───────────────────
function confirmar(mensagem) {
  return window.confirm(mensagem);
}

// ─── Inline SVG icons for JS-generated HTML ────────
const SVG = {
  alertTriangle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  userX: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>`,
  bell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  empty: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
};

// ─── Service Worker ────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/gestorfit/sw.js').catch(() => {});
  });
}
