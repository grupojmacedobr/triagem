// ===== Tela de login =====
const form = document.getElementById("form-login");
const campoLogin = document.getElementById("login");
const campoSenha = document.getElementById("senha");
const btnEntrar = document.getElementById("btn-entrar");
const mensagem = document.getElementById("mensagem");

function mostrarMensagem(texto, tipo = "erro") {
  mensagem.textContent = texto;
  mensagem.className = "message " + tipo;
}

// Transforma "Rafael.Macedo" em "rafael.macedo@triagem.jmacedo"
function loginParaEmail(login) {
  const limpo = login.trim().toLowerCase();
  return limpo.includes("@") ? limpo : `${limpo}@${DOMINIO_LOGIN}`;
}

// Se já estiver logado, vai direto para o painel
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = "painel.html";
});

// Mostrar / esconder senha
document.getElementById("toggle-senha").addEventListener("click", () => {
  campoSenha.type = campoSenha.type === "password" ? "text" : "password";
});

// Esqueci minha senha
document.getElementById("esqueci").addEventListener("click", (e) => {
  e.preventDefault();
  mostrarMensagem("Para redefinir sua senha, procure o administrador do sistema.", "ok");
});

// Enviar formulário
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarMensagem("");

  const login = campoLogin.value.trim();
  const senha = campoSenha.value;

  if (!login || !senha) {
    mostrarMensagem("Preencha login e senha.");
    return;
  }

  btnEntrar.disabled = true;
  btnEntrar.textContent = "Entrando...";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: loginParaEmail(login),
    password: senha,
  });

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("not confirmed")) {
      mostrarMensagem("Usuário ainda não confirmado. Procure o administrador.");
    } else if (msg.includes("invalid login")) {
      mostrarMensagem("Login ou senha inválidos.");
    } else if (msg.includes("api key") || msg.includes("fetch")) {
      mostrarMensagem("Erro de conexão com o servidor. Tente novamente.");
    } else {
      mostrarMensagem("Erro ao entrar: " + error.message);
    }
    console.error("Erro de login:", error);
    btnEntrar.disabled = false;
    btnEntrar.textContent = "Entrar";
    return;
  }

  mostrarMensagem("Acesso liberado! Redirecionando...", "ok");
  window.location.href = "painel.html";
});
