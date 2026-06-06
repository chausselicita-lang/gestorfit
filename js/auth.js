// js/auth.js — Controle de autenticação

async function verificarAuth() {
  try {
    const usuario = await getUsuarioAtual();
    if (!usuario) {
      const basePath = window.location.pathname.includes('/pages/') ? '../' : '';
      window.location.href = basePath + 'login.html';
      return false;
    }

    const academia = await getAcademiaDoUsuario();
    if (!academia) {
      mostrarToast('Academia não encontrada. Contate o suporte.', 'erro');
      await logout();
      return false;
    }

    CONFIG.ACADEMIA_ID = academia.id;

    // Preencher info do usuário na sidebar
    const el = document.getElementById('userName');
    const av = document.getElementById('userAvatar');
    if (el) el.textContent = academia.nome;
    if (av) av.textContent = academia.nome.charAt(0).toUpperCase();

    return true;
  } catch (err) {
    console.error('Auth error:', err);
    return false;
  }
}

async function handleLogout() {
  try {
    await logout();
    const basePath = window.location.pathname.includes('/pages/') ? '../' : '';
    window.location.href = basePath + 'login.html';
  } catch (err) {
    mostrarToast('Erro ao sair', 'erro');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
});
