"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { CHAVE_TEMA } from "@/lib/cor";

/** Alterna entre o tema AZUL (escuro) e o tema CLARO (cinza + azul). */
export default function BotaoTema({ comTexto = false }: { comTexto?: boolean }) {
  const [claro, setClaro] = useState(false);

  useEffect(() => {
    setClaro(document.documentElement.classList.contains("light"));
  }, []);

  function alternar() {
    const novo = !claro;
    setClaro(novo);
    document.documentElement.classList.toggle("light", novo);
    try {
      localStorage.setItem(CHAVE_TEMA, novo ? "light" : "dark");
    } catch {
      // sem localStorage, só não lembra a escolha
    }
  }

  const rotulo = claro ? "Tema azul" : "Tema claro";

  if (comTexto) {
    return (
      <button
        type="button"
        onClick={alternar}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition hover:bg-[var(--surface2)]"
        style={{ color: "var(--muted)" }}
      >
        {claro ? <Moon size={17} /> : <Sun size={17} />}
        {rotulo}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
      className="w-9 h-9 flex items-center justify-center rounded-full border transition hover:border-[var(--accent2)]"
      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
    >
      {claro ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
