"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LIMITE_INATIVIDADE_MS = 60 * 60 * 1000; // 1 hora sem mexer = sai sozinho
const INTERVALO_VERIFICACAO_MS = 30 * 1000;

const CHAVE_ULTIMA_ATIVIDADE = "triagem-ultima-atividade";
export const CHAVE_AVISO_LOGOUT_INATIVIDADE = "triagem-logout-por-inatividade";

function lerUltimaAtividade(): number {
  try {
    const valor = localStorage.getItem(CHAVE_ULTIMA_ATIVIDADE);
    return valor ? Number(valor) : Date.now();
  } catch {
    return Date.now();
  }
}

function gravarUltimaAtividade(ts: number) {
  try {
    localStorage.setItem(CHAVE_ULTIMA_ATIVIDADE, String(ts));
  } catch {
    // sem localStorage, segue sem persistir
  }
}

const EVENTOS: (keyof WindowEventMap)[] = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

/**
 * Encerra a sessão sozinho depois de 1 hora sem nenhuma interação
 * (mouse, teclado, rolagem ou toque). Mesmo comportamento do Allied.
 */
export default function InactivityGuard() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    gravarUltimaAtividade(Date.now());

    const registrar = () => gravarUltimaAtividade(Date.now());
    EVENTOS.forEach((ev) => window.addEventListener(ev, registrar, { passive: true }));

    const verificacao = setInterval(async () => {
      if (Date.now() - lerUltimaAtividade() < LIMITE_INATIVIDADE_MS) return;
      try {
        sessionStorage.setItem(CHAVE_AVISO_LOGOUT_INATIVIDADE, "1");
      } catch {
        // só não mostra o aviso
      }
      await supabase.auth.signOut();
      router.push("/login");
    }, INTERVALO_VERIFICACAO_MS);

    return () => {
      EVENTOS.forEach((ev) => window.removeEventListener(ev, registrar));
      clearInterval(verificacao);
    };
  }, [router]);

  return null;
}
