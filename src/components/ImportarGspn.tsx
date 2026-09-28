"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, FolderOpen, Loader2, Square, Upload, X, XCircle } from "lucide-react";
import type { RegistroOS } from "@/lib/gspnPlanilha";

/**
 * Importação "gentil" com o plano gratuito do Supabase:
 *  - a planilha é lida por trás (Web Worker), a tela não trava;
 *  - envia em partes pequenas, uma de cada vez, com uma pausa curta entre elas;
 *  - se o servidor reclamar, espera e tenta de novo (e diminui o tamanho da parte);
 *  - OS que não mudaram desde a última importação nem são regravadas.
 */
const LOTE_INICIAL = 250;
const LOTE_MINIMO = 50;
const PAUSA_MS = 150;
const TENTATIVAS = 6;

const PASTA_BASES = "C:\\TRIAGEM GRUPO J MACEDO\\BASE GSPN";

type Contagem = { novos: number; atualizados: number; iguais: number };

type Progresso = {
  arquivoAtual: number; // 1..n
  totalArquivos: number;
  nome: string;
  fase: "abrindo" | "lendo" | "enviando" | "aprendendo";
  lidas: number;
  totalLinhas: number;
  enviados: number;
  totalOs: number;
  lote: number;
  totalLotes: number;
  restanteSeg: number | null;
  aviso: string | null;
  cont: Contagem;
};

type Resultado = {
  nome: string;
  ok: boolean;
  mensagem?: string;
  linhas: number;
  os: number;
  entregues: number;
  reparadas: number;
  cont: Contagem;
  reclassificadas: number;
  segundos: number;
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (n: number) => n.toLocaleString("pt-BR");
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

function tempo(seg: number) {
  if (seg < 60) return `${Math.max(1, Math.round(seg))}s`;
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}min${s ? ` ${s}s` : ""}`;
}

async function chamar(corpo: unknown) {
  const res = await fetch("/api/gspn/importar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erro = new Error(data.error || `Falha no servidor (${res.status}).`) as Error & { status?: number };
    erro.status = res.status;
    throw erro;
  }
  return data;
}

/** Lê o arquivo num Web Worker (sem travar a tela). */
function lerPlanilha(
  arquivo: File,
  onProgresso: (fase: "abrindo" | "lendo", lidas: number, total: number) => void,
): Promise<{ registros: RegistroOS[]; linhas: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../lib/lerGspn.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.tipo === "fase") onProgresso("abrindo", 0, 0);
      else if (m.tipo === "lendo") onProgresso("lendo", m.lidas, m.total);
      else if (m.tipo === "pronto") {
        worker.terminate();
        resolve({ registros: m.registros, linhas: m.linhas });
      } else if (m.tipo === "erro") {
        worker.terminate();
        reject(new Error(m.mensagem));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Falha ao ler a planilha (arquivo muito grande para a memória do navegador?)."));
    };
    worker.postMessage({ arquivo });
  });
}

export default function ImportarGspn() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const cancelar = useRef(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cancelando, setCancelando] = useState(false);
  const ocupado = progresso !== null;
  const [inicioFase, setInicioFase] = useState(0);
  const [, setTique] = useState(0);
  const faseAtual = progresso?.fase;
  useEffect(() => setInicioFase(Date.now()), [faseAtual, progresso?.nome]);
  useEffect(() => {
    if (!ocupado) return;
    const t = setInterval(() => setTique((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [ocupado]);

  // avisa se tentar fechar a página no meio da importação
  useEffect(() => {
    if (!ocupado) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [ocupado]);

  function escolher(lista: FileList | null) {
    const novos = Array.from(lista ?? []).filter((f) => /\.xlsx?$/i.test(f.name));
    setArquivos((atual) => {
      const nomes = new Set(atual.map((f) => f.name + f.size));
      return [...atual, ...novos.filter((f) => !nomes.has(f.name + f.size))];
    });
    setResultados([]);
    if (input.current) input.current.value = "";
  }

  async function importarArquivo(arquivo: File, idx: number, total: number): Promise<Resultado> {
    const inicio = Date.now();
    const cont: Contagem = { novos: 0, atualizados: 0, iguais: 0 };
    const base: Progresso = {
      arquivoAtual: idx + 1,
      totalArquivos: total,
      nome: arquivo.name,
      fase: "abrindo",
      lidas: 0,
      totalLinhas: 0,
      enviados: 0,
      totalOs: 0,
      lote: 0,
      totalLotes: 0,
      restanteSeg: null,
      aviso: null,
      cont,
    };
    setProgresso(base);

    let registros: RegistroOS[];
    let linhas: number;
    try {
      ({ registros, linhas } = await lerPlanilha(arquivo, (fase, lidas, totalLinhas) =>
        setProgresso((p) => (p ? { ...p, fase, lidas, totalLinhas } : p)),
      ));
    } catch (e) {
      return { nome: arquivo.name, ok: false, mensagem: `Não consegui ler a planilha: ${(e as Error).message}`, linhas: 0, os: 0, entregues: 0, reparadas: 0, cont, reclassificadas: 0, segundos: 0 };
    }

    const entregues = registros.filter((r) => r.entregue).length;
    const reparadas = registros.filter((r) => r.reparado).length;
    let importacaoId = "";
    try {
      importacaoId = (await chamar({ acao: "iniciar", arquivo: arquivo.name })).importacao_id;

      let tamanho = LOTE_INICIAL;
      let seguidos = 0; // partes aceitas em sequência (para voltar a aumentar o tamanho)
      let pos = 0;
      let lote = 0;
      const inicioEnvio = Date.now();
      while (pos < registros.length) {
        if (cancelar.current) throw new Error("Importação cancelada. O que já foi enviado ficou gravado.");
        let parte = registros.slice(pos, pos + tamanho);
        lote++;
        const faltam = Math.ceil((registros.length - pos) / tamanho);
        setProgresso((p) =>
          p ? { ...p, fase: "enviando", totalOs: registros.length, lote, totalLotes: lote - 1 + faltam } : p,
        );

        let tentativa = 0;
        for (;;) {
          try {
            const r = await chamar({ acao: "lote", importacao_id: importacaoId, registros: parte });
            cont.novos += r.novos || 0;
            cont.atualizados += r.atualizados || 0;
            cont.iguais += r.iguais || 0;
            if (++seguidos >= 10 && tamanho < LOTE_INICIAL) {
              tamanho = Math.min(LOTE_INICIAL, tamanho * 2); // o banco voltou ao normal
              seguidos = 0;
            }
            break;
          } catch (e) {
            const status = (e as { status?: number }).status;
            if (status === 401 || status === 403) throw e; // sem permissão / sessão expirou: não adianta insistir
            if (++tentativa >= TENTATIVAS) throw e;
            seguidos = 0;
            tamanho = Math.max(LOTE_MINIMO, Math.floor(tamanho / 2)); // servidor apertado: manda menos por vez
            const espera = Math.min(30000, 2000 * 2 ** (tentativa - 1));
            setProgresso((p) =>
              p ? { ...p, aviso: `O banco pediu uma pausa. Tentando de novo em ${Math.round(espera / 1000)}s (tentativa ${tentativa + 1} de ${TENTATIVAS})...` } : p,
            );
            await esperar(espera);
            setProgresso((p) => (p ? { ...p, aviso: null } : p));
            parte = registros.slice(pos, pos + tamanho);
          }
        }
        pos += parte.length;
        const decorrido = (Date.now() - inicioEnvio) / 1000;
        const restante = pos > 0 ? (decorrido / pos) * (registros.length - pos) : null;
        setProgresso((p) => (p ? { ...p, enviados: pos, restanteSeg: restante, cont: { ...cont } } : p));
        await esperar(PAUSA_MS);
      }

      setProgresso((p) => (p ? { ...p, fase: "aprendendo", restanteSeg: null } : p));
      const fim = await chamar({
        acao: "concluir",
        importacao_id: importacaoId,
        linhas: registros.length,
        entregues,
        ...cont,
      });
      return {
        nome: arquivo.name,
        ok: true,
        linhas,
        os: registros.length,
        entregues,
        reparadas,
        cont: { ...cont },
        reclassificadas: fim.reclassificadas || 0,
        segundos: Math.round((Date.now() - inicio) / 1000),
      };
    } catch (e) {
      if (importacaoId) chamar({ acao: "erro", importacao_id: importacaoId, linhas: registros.length, entregues, ...cont }).catch(() => {});
      return { nome: arquivo.name, ok: false, mensagem: (e as Error).message, linhas, os: registros.length, entregues, reparadas, cont: { ...cont }, reclassificadas: 0, segundos: Math.round((Date.now() - inicio) / 1000) };
    }
  }

  async function importar() {
    if (!arquivos.length) return;
    cancelar.current = false;
    setCancelando(false);
    setResultados([]);
    const lista = [...arquivos];
    const feitos: Resultado[] = [];
    for (let i = 0; i < lista.length; i++) {
      if (cancelar.current) break;
      const r = await importarArquivo(lista[i], i, lista.length);
      feitos.push(r);
      setResultados([...feitos]);
    }
    setProgresso(null);
    setCancelando(false);
    setArquivos((atual) => atual.filter((f) => !feitos.some((r) => r.ok && r.nome === f.name)));
    router.refresh();
  }

  const p = progresso;
  const pct = !p
    ? 0
    : p.fase === "abrindo"
      ? 0
      : p.fase === "lendo"
        ? p.totalLinhas ? (100 * p.lidas) / p.totalLinhas : 0
        : p.fase === "aprendendo"
          ? 100
          : p.totalOs ? (100 * p.enviados) / p.totalOs : 0;
  const tamanhoTotal = arquivos.reduce((s, f) => s + f.size, 0);

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <h2 className="font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Importar planilhas GSPN
      </h2>
      <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
        Use a exportação padrão do GSPN (.xlsx). Pode escolher <strong>várias planilhas de várias lojas</strong> de uma vez. O
        sistema envia em partes pequenas (sem sobrecarregar o banco gratuito), pula as OS que não mudaram e, no final,
        aprende as categorias dos modelos novos.
      </p>

      <label
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${
          ocupado ? "opacity-60 cursor-wait" : "cursor-pointer hover:border-[var(--accent2)]"
        }`}
        style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!ocupado) escolher(e.dataTransfer.files);
        }}
      >
        <FileSpreadsheet size={30} style={{ color: "var(--accent2)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          Clique para escolher (ou arraste aqui) as planilhas
        </span>
        <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted)" }}>
          <FolderOpen size={13} /> Pasta das bases: <code className="font-mono">{PASTA_BASES}</code>
        </span>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          disabled={ocupado}
          onChange={(e) => escolher(e.target.files)}
        />
      </label>

      {arquivos.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {arquivos.map((f) => (
            <li
              key={f.name + f.size}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--surface2)" }}
            >
              <span className="truncate" style={{ color: "var(--ink)" }}>
                {f.name}
              </span>
              <span className="flex items-center gap-3 shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                {mb(f.size)}
                {!ocupado && (
                  <button
                    type="button"
                    aria-label={`Tirar ${f.name}`}
                    onClick={() => setArquivos((a) => a.filter((x) => x !== f))}
                    className="hover:text-red-400"
                  >
                    <X size={15} />
                  </button>
                )}
              </span>
            </li>
          ))}
          {arquivos.length > 1 && (
            <li className="text-xs px-1" style={{ color: "var(--muted)" }}>
              {arquivos.length} planilhas · {mb(tamanhoTotal)} no total
            </li>
          )}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={importar}
          disabled={!arquivos.length || ocupado}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 transition"
          style={{ boxShadow: "0 0 30px var(--accent-glow)" }}
        >
          {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {ocupado ? "Importando..." : arquivos.length > 1 ? `Importar ${arquivos.length} planilhas` : "Importar"}
        </button>
        {ocupado && (
          <button
            type="button"
            disabled={cancelando}
            onClick={() => {
              cancelar.current = true;
              setCancelando(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border text-sm px-4 py-2.5 hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
          >
            <Square size={14} /> {cancelando ? "Parando após esta parte..." : "Parar"}
          </button>
        )}
      </div>

      {p && (
        <div className="mt-5 rounded-lg border p-4" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          <div className="flex justify-between gap-3 text-xs mb-2" style={{ color: "var(--muted)" }}>
            <span className="truncate">
              {p.totalArquivos > 1 && (
                <strong style={{ color: "var(--ink)" }}>
                  Planilha {p.arquivoAtual} de {p.totalArquivos} ·{" "}
                </strong>
              )}
              {p.nome}
            </span>
            <strong className="text-base leading-none" style={{ color: "var(--ink)" }}>
              {Math.floor(pct)}%
            </strong>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--surface)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: p.fase === "lendo" || p.fase === "abrindo" ? "var(--accent2)" : "var(--accent)" }}
            />
          </div>

          <p className="text-sm mt-3 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Loader2 size={14} className="animate-spin shrink-0" />
            {p.fase === "abrindo" &&
              `Abrindo a planilha... ${Math.round((Date.now() - inicioFase) / 1000)}s (arquivos grandes levam de 10 a 40 segundos)`}
            {p.fase === "lendo" && `Lendo linhas: ${fmt(p.lidas)} de ${fmt(p.totalLinhas)}`}
            {p.fase === "enviando" &&
              `Enviando: ${fmt(p.enviados)} de ${fmt(p.totalOs)} OS · parte ${fmt(p.lote)} de ${fmt(p.totalLotes)}`}
            {p.fase === "aprendendo" && "Aprendendo: atualizando as categorias dos modelos..."}
          </p>

          {p.fase === "enviando" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
              {[
                ["Novas", p.cont.novos, "text-emerald-500"],
                ["Atualizadas", p.cont.atualizados, "text-sky-400"],
                ["Iguais (puladas)", p.cont.iguais, ""],
                ["Tempo restante", p.restanteSeg === null ? "calculando..." : `~${tempo(p.restanteSeg)}`, ""],
              ].map(([rot, val, cor]) => (
                <div key={rot as string} className="rounded-md px-2.5 py-1.5" style={{ background: "var(--surface)" }}>
                  <p style={{ color: "var(--muted)" }}>{rot}</p>
                  <p className={`font-semibold text-sm ${cor}`} style={cor ? undefined : { color: "var(--ink)" }}>
                    {typeof val === "number" ? fmt(val) : val}
                  </p>
                </div>
              ))}
            </div>
          )}

          {p.aviso && <p className="text-xs mt-2 text-amber-500">{p.aviso}</p>}
          <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
            Não feche esta página até terminar. Se precisar parar, o que já foi enviado fica gravado.
          </p>
        </div>
      )}

      {resultados.map((r) =>
        r.ok ? (
          <div
            key={r.nome}
            className="mt-4 rounded-lg border px-4 py-3"
            style={{ borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.08)" }}
          >
            <p className="text-sm font-medium flex items-center gap-2 text-emerald-500">
              <CheckCircle2 size={16} /> {r.nome} — concluída em {tempo(r.segundos)}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--ink)" }}>
              {fmt(r.os)} OS · {fmt(r.entregues)} com Produto Entregue · {fmt(r.reparadas)} reparadas (usadas na Triagem)
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {fmt(r.cont.novos)} novas · {fmt(r.cont.atualizados)} atualizadas · {fmt(r.cont.iguais)} iguais (não regravadas)
              {r.reclassificadas > 0 && ` · ${fmt(r.reclassificadas)} OS saíram de "Outros" pelo aprendizado`}
            </p>
          </div>
        ) : (
          <div key={r.nome} className="mt-4 text-sm flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <XCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              <strong>{r.nome}:</strong> {r.mensagem}
              {r.cont.novos + r.cont.atualizados + r.cont.iguais > 0 &&
                ` (${fmt(r.cont.novos + r.cont.atualizados + r.cont.iguais)} OS já tinham sido gravadas — é só importar de novo que ele continua e pula as iguais.)`}
            </span>
          </div>
        ),
      )}
    </div>
  );
}
