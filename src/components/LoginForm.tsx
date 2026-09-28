"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usuarioParaEmailTecnico } from "@/lib/auth";
import { CHAVE_AVISO_LOGOUT_INATIVIDADE } from "./InactivityGuard";
import PasswordInput from "./PasswordInput";
import PopupSolicitarResetSenha from "./PopupSolicitarResetSenha";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [solicitandoReset, setSolicitandoReset] = useState(false);
  const [avisoInatividade, setAvisoInatividade] = useState(false);

  // Veio parar aqui porque o InactivityGuard encerrou a sessão sozinho
  // (1h sem nenhuma interação) — mostra o aviso uma
  // única vez e limpa a marca, pra não reaparecer num login normal
  // logo em seguida.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(CHAVE_AVISO_LOGOUT_INATIVIDADE) === "1") {
        sessionStorage.removeItem(CHAVE_AVISO_LOGOUT_INATIVIDADE);
        setAvisoInatividade(true);
      }
    } catch {
      // sem sessionStorage, só não mostra o aviso — não afeta o login em si
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const usuarioNormalizado = usuario.trim().toLowerCase();
    const email = usuarioParaEmailTecnico(usuarioNormalizado);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setCarregando(false);
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("banned")) setErro("Este usuário está bloqueado. Procure o administrador.");
      else if (msg.includes("not confirmed")) setErro("Usuário ainda não confirmado. Procure o administrador.");
      else if (msg.includes("invalid login")) setErro("Usuário ou senha inválidos.");
      else setErro("Não foi possível entrar: " + error.message);
      return;
    }


    setCarregando(false);
    router.refresh();
    router.push("/dashboard");
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      {avisoInatividade && (
        <p className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          Sua sessão foi encerrada automaticamente após um período de inatividade superior a 1 hora. Por segurança,
          faça login novamente para continuar.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="usuario" className="text-xs font-medium uppercase tracking-wide text-tri-silver/70">
          Login
        </label>
        <input
          id="usuario"
          name="usuario"
          type="text"
          autoComplete="username"
          required
          placeholder="nome.sobrenome"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full rounded-lg bg-tri-panel2 border border-tri-border px-4 py-3 text-sm text-tri-silver placeholder:text-tri-silver/40 outline-none focus:border-tri-accent2 focus:ring-1 focus:ring-tri-accent2 transition"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="senha" className="text-xs font-medium uppercase tracking-wide text-tri-silver/70">
          Senha
        </label>
        <PasswordInput
          id="senha"
          name="senha"
          placeholder="••••••••"
          autoComplete="current-password"
          value={senha}
          onChange={setSenha}
        />
      </div>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-lg bg-tri-accent hover:bg-tri-accent2 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm py-3 transition shadow-glow"
      >
        {carregando ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-xs text-tri-silver/50">
        <button
          type="button"
          onClick={() => setSolicitandoReset(true)}
          className="text-tri-accent2 hover:underline"
        >
          Esqueci minha senha
        </button>
      </p>
    </form>

    {solicitandoReset && <PopupSolicitarResetSenha onFechar={() => setSolicitandoReset(false)} />}
    </>
  );
}
