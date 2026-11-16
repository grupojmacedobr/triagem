"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, CheckCircle2, Clock, Loader2, RefreshCw, RotateCcw, Square } from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

/**
 * Card "Robô GSPN" da tela Base GSPN: mostra cada unidade que o robô coleta
 * (via Sistema de Inventário) e permite sincronizar na hora.
 * Todo dia às 6h a Vercel sincroniza sozinha (vercel.json).
 */
type Estado = {
  pagina: number;
  paginas: number | null;
  total: number | null;
  novos: number;
  atualizados: number;
  iguais: number;
  desde: string | null;
  ultima_ok: string | null;
  ultimo_erro: string | null;
  erro_em: string | null;
} | null;

type Linha = {
  unidade: { unidade_id: string; nome: string; asc: string | null; base_atualizada_em: string | null; enviado_em: string | null; os: number | null };
  estado: Estado;
  situacao: "andamento" | "nova" | "em_dia";
};

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");

async function chamar(acao: string) {
  const r = await fetch("/api/gspn/sincronizar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Erro ${r.status}`);
  return j;
}

export default function SincronizacaoRobo() {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [parando, setParando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [configurado, setConfigurado] = useState(true);
  const [cronAtivo, setCronAtivo] = useState(true);
  const [mensagens, setMensagens] = useState<string[]>([]);
  const parar = useRef(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const j = await chamar("status");
      setConfigurado(j.configurado !== false);
      setCronAtivo(j.cronAtivo !== false);
      setLinhas(j.unidades ?? []);
      setErro(j.error ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function sincronizar(baseInteira = false) {
    setRodando(true);
    setErro(null);
    setMensagens([]);
    parar.current = false;
    setParando(false);
    try {
      if (baseInteira) await chamar("reiniciar");
      for (let volta = 0; volta < 60 && !parar.current; volta++) {
        const j = await chamar("sincronizar");
        if (j.error) throw new Error(j.error);
        setLinhas(j.unidades ?? []);
        if (j.mensagens?.length) setMensagens((m) => [...m, ...j.mensagens]);
        if (!j.pendente) break;
      }
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setRodando(false);
      setParando(false);
    }
  }

  const emDia = linhas.filter((l) => l.situacao === "em_dia").length;

  return (
    <div className="rounded-xl border p-5 mb-6" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Bot size={18} style={{ color: "var(--accent2)" }} /> Robô GSPN · atualização automática
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            A base de OS de cada unidade vem do robô (pasta <strong>OneDrive\AUTOMAÇÃO</strong>), pelo Sistema de Inventário.
            Todo dia às <strong>6h</strong> a Triagem busca sozinha o que mudou.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => sincronizar(false)}
            disabled={rodando || !configurado}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition"
          >
            {rodando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {rodando ? "Sincronizando..." : "Sincronizar agora"}
          </button>
          {rodando ? (
            <button
              type="button"
              disabled={parando}
              onClick={() => {
                parar.current = true;
                setParando(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border text-sm px-3 py-2 hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}
            >
              <Square size={13} /> {parando ? "Parando..." : "Parar"}
            </button>
          ) : (
            <button
              type="button"
              disabled={!configurado}
              title="Relê a base inteira de todas as unidades (OS iguais não são regravadas)"
              onClick={() => {
                if (window.confirm("Reler a base inteira de todas as unidades? Pode levar alguns minutos.")) sincronizar(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border text-sm px-3 py-2 hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}
            >
              <RotateCcw size={13} /> Base inteira
            </button>
          )}
        </div>
      </div>

      {!configurado && (
        <p className="mt-4 text-sm flex items-start gap-2 text-amber-500">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {erro}
        </p>
      )}
      {configurado && !cronAtivo && (
        <p className="mt-3 text-xs text-amber-500">
          A atualização diária automática ainda não está ligada (falta CRON_SECRET na Vercel). O botão funciona normalmente.
        </p>
      )}
      {configurado && erro && (
        <p className="mt-4 text-sm flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {erro}
        </p>
      )}

      {configurado && (
        <div className="mt-4 rounded-lg border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-2 font-medium">Unidade</th>
                <th className="px-3 py-2 font-medium">ASC</th>
                <th className="px-3 py-2 font-medium">OS no robô</th>
                <th className="px-3 py-2 font-medium">Base do robô</th>
                <th className="px-3 py-2 font-medium">Última sincronização</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {carregando && linhas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--muted)" }}>
                    <Loader2 size={16} className="animate-spin inline mr-2" /> Consultando o robô...
                  </td>
                </tr>
              )}
              {linhas.map(({ unidade: u, estado: e, situacao }) => (
                <tr key={u.unidade_id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2" style={{ color: "var(--ink)" }}>{u.nome}</td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--muted)" }}>{u.asc ?? "—"}</td>
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{fmt(u.os)}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>{u.base_atualizada_em ?? formatarDataHoraBrasilia(u.enviado_em)}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>
                    {formatarDataHoraBrasilia(e?.ultima_ok)}
                    {e?.ultima_ok && (e.novos > 0 || e.atualizados > 0) && (
                      <span className="block">
                        <span className="text-emerald-500">{fmt(e.novos)} novas</span> ·{" "}
                        <span className="text-sky-400">{fmt(e.atualizados)} atualizadas</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {e?.ultimo_erro ? (
                      <span className="text-red-400" title={e.ultimo_erro}>
                        <AlertTriangle size={13} className="inline mr-1" />
                        Erro: {e.ultimo_erro.slice(0, 60)}
                      </span>
                    ) : situacao === "em_dia" ? (
                      <span className="text-emerald-500">
                        <CheckCircle2 size={13} className="inline mr-1" />
                        Em dia
                      </span>
                    ) : situacao === "andamento" ? (
                      <span className="text-sky-400">
                        <Loader2 size={13} className={`inline mr-1 ${rodando ? "animate-spin" : ""}`} />
                        Página {fmt(e?.pagina)} de {e?.paginas ? fmt(e.paginas) : "?"}
                        {e?.desde ? " (só o que mudou)" : " (base inteira)"}
                      </span>
                    ) : (
                      <span className="text-amber-500">
                        <Clock size={13} className="inline mr-1" />
                        {e ? "Dados novos no robô" : "Ainda não sincronizada"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {configurado && linhas.length > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
          {emDia} de {linhas.length} unidades em dia. A 1ª vez de cada unidade lê a base inteira; depois só o que mudou.
        </p>
      )}
      {mensagens.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs" style={{ color: "var(--muted)" }}>
          {mensagens.map((m, i) => (
            <li key={i}>• {m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
