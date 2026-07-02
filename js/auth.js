// js/auth.js — Controle de autenticação

async function verificarAuth() {
  try {
    let usuario = await getUsuarioAtual();

    // PWA: ao abrir pelo ícone o Supabase pode demorar ~300ms para restaurar a sessão
    // Se não achou usuário, tenta mais uma vez após um breve aguardo
    if (!usuario) {
      await new Promise(r => setTimeout(r, 350));
      usuario = await getUsuarioAtual();
    }

    if (!usuario) {
      const base = window.location.pathname.includes('/pages/') ? '../' : '';
      window.location.href = base + 'login.html';
      return false;
    }

    // 1. Tenta buscar academia pelo ID já configurado
    // 2. Fallback: primeira academia ativa
    // 3. Se nenhuma encontrar, usa o ID hardcoded e continua mesmo assim
    const academia = await getAcademiaDoUsuario();

    if (academia) {
      CONFIG.ACADEMIA_ID = academia.id;
      _preencherSidebarUsuario(academia.nome);
    } else if (CONFIG.ACADEMIA_ID) {
      // ID já configurado no config.js — prosseguir sem dados da academia
      _preencherSidebarUsuario('Academia');
    } else {
      mostrarToast('Academia não encontrada. Verifique o CONFIG.ACADEMIA_ID.', 'erro');
      return false;
    }

    return true;
  } catch (err) {
    console.error('Auth error:', err);
    // Se o ID já está configurado, permite continuar mesmo com erro de rede
    if (CONFIG.ACADEMIA_ID) {
      _preencherSidebarUsuario('Academia');
      return true;
    }
    return false;
  }
}

function _preencherSidebarUsuario(nome) {
  const el = document.getElementById('userName');
  const av = document.getElementById('userAvatar');
  if (el) el.textContent = nome;
  if (av) av.textContent = (nome || 'A').charAt(0).toUpperCase();
}

async function handleLogout() {
  try {
    await logout();
    const base = window.location.pathname.includes('/pages/') ? '../' : '';
    window.location.href = base + 'login.html';
  } catch (err) {
    mostrarToast('Erro ao sair', 'erro');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
});
