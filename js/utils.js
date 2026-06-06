// js/utils.js — Funções auxiliares

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
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + duracaoDias);
  return hoje.toISOString().split('T')[0];
}

function calcularDiasRestantes(dataVencimento) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento + 'T00:00:00');
  return Math.ceil((venc - hoje) / 86400000);
}

function getStatusBadge(status) {
  const badges = {
    ativo: '<span class="badge-status verde">Ativo</span>',
    inativo: '<span class="badge-status cinza">Inativo</span>',
    inadimplente: '<span class="badge-status vermelho">Inadimplente</span>',
    cancelado: '<span class="badge-status preto">Cancelado</span>',
  };
  return badges[status] || status;
}

function getFormaPagamentoBadge(forma) {
  const icones = {
    pix: '🟢 PIX',
    dinheiro: '💵 Dinheiro',
    cartao_credito: '💳 Crédito',
    cartao_debito: '💳 Débito',
  };
  return icones[forma] || forma;
}

function nomeMes(mesStr) {
  const [ano, mes] = mesStr.split('-');
  const d = new Date(parseInt(ano), parseInt(mes) - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function mostrarToast(mensagem, tipo = 'sucesso') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}

function mostrarLoading(elemento, texto = 'Carregando...') {
  elemento.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>${texto}</span></div>`;
}

function confirmar(mensagem) {
  return window.confirm(mensagem);
}

function formatarCPF(cpf) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatarTelefone(tel) {
  return tel.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
}

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/gestorfit/sw.js').catch(() => {});
  });
}
