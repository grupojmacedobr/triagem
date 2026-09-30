"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, Eraser, GraduationCap, Info, Layers, Link2, Loader2, PackageCheck, Search, Wrench, X } from "lucide-react";
import { CATEGORIAS } from "@/lib/gspn";
import type { Confianca, KitPecas, ResultadoTriagem, NivelBusca, PecaSugerida } from "@/lib/triagem";

type SugestaoModelo = { modelo: string; familia: string; categoria: string; qtd_os: number; qtd_entregues: number; qtd_reparadas: number };
type SugestaoDefeito = { texto: string; qtd: number };

const ORIGEM: Record<PecaSugerida["origem"], { rotulo: string; cor: string; dica: string }> = {
  "defeito-modelo": { rotulo: "Modelo", cor: "#22c55e", dica: "Usada neste mesmo modelo com defeito parecido" },
  "defeito-familia": { rotulo: "Família", cor: "#3b82f6", dica: "Usada em modelos da mesma família com defeito parecido" },
  "tipo-provavel": { rotulo: "Tipo provável", cor: "#f59e0b", dica: "Tipo de peça comum para esse defeito; código mais usado neste modelo/família" },
};

const cartao = { background: "var(--surface)", borderColor: "var(--line)" } as const;

type LinhaSugerida =
  | { tipo: "peca"; p: PecaSugerida }
  | { tipo: "conjunto"; c: ResultadoTriagem["conjuntos"][number] };

/** Peças + soluções com mais de 1 peça, na ordem do percentual (tipo provável fica por último). */
function linhasSugeridas(r: ResultadoTriagem): LinhaSugerida[] {
  const linhas: LinhaSugerida[] = [
    ...r.pecas.map((p) => ({ tipo: "peca" as const, p })),
    ...(r.conjuntos ?? []).map((c) => ({ tipo: "conjunto" as const, c })),
  ];
  const grupo = (l: LinhaSugerida) => (l.tipo === "peca" && l.p.origem === "tipo-provavel" ? 1 : 0);
  const perc = (l: LinhaSugerida) => (l.tipo === "peca" ? l.p.percentual : l.c.percentual);
  return linhas.sort((a, b) => grupo(a) - grupo(b) || perc(b) - perc(a)).slice(0, 15);
}
const pct = (v: number) => `${v.toFixed(v >= 10 ? 0 : 1).replace(".", ",")}%`;
const num = (v: number) => v.toLocaleString("pt-BR");
const campoClasse =
  "w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] bg-[var(--surface2)] border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--muted)]";
const rotuloClasse = "text-xs font-medium uppercase tracking-wide";

// trecho do defeito que está sendo digitado agora (depois da última vírgula / ponto / quebra de linha)
function trechoAtual(texto: string): { antes: string; atual: string } {
  const m = texto.match(/^([\s\S]*[,;.\n]\s*)?([^,;.\n]*)$/);
  return { antes: m?.[1] ?? "", atual: (m?.[2] ?? texto).trimStart() };
}

type Inicial = { modelo?: string; categorias?: string[]; defeito?: string; garantias?: string[]; resultado?: ResultadoTriagem | null };

const GARANTIAS = [
  { sigla: "LP", nome: "Em garantia" },
  { sigla: "OW", nome: "Fora de garantia" },
];

export default function TriagemPainel({
  inicial,
  listaCategorias = CATEGORIAS,
}: {
  inicial?: Inicial;
  /** categorias cadastradas no banco (Configurações > Cadastro Categorias) */
  listaCategorias?: { sigla: string; nome: string }[];
}) {
  const [modelo, setModelo] = useState(inicial?.modelo ?? "");
  const [categorias, setCategorias] = useState<string[]>(inicial?.categorias ?? []);
  const [defeito, setDefeito] = useState(inicial?.defeito ?? "");
  // garantia (coluna AL): LP = em garantia, OW = fora de garantia. As duas = todas.
  const [garantias, setGarantias] = useState<string[]>(inicial?.garantias ?? ["LP", "OW"]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoTriagem | null>(inicial?.resultado ?? null);
  const [copiado, setCopiado] = useState<string | null>(null);

  // sugestões de SKU
  const [sugModelos, setSugModelos] = useState<SugestaoModelo[]>([]);
  const [abrirModelos, setAbrirModelos] = useState(false);
  const [idxModelo, setIdxModelo] = useState(-1);
  // sugestões de defeito
  const [sugDefeitos, setSugDefeitos] = useState<SugestaoDefeito[]>([]);
  const [abrirDefeitos, setAbrirDefeitos] = useState(false);
  const [idxDefeito, setIdxDefeito] = useState(-1);
  // caixa de categorias
  const [abrirCategorias, setAbrirCategorias] = useState(false);

  const timerModelo = useRef<ReturnType<typeof setTimeout>>();
  const timerDefeito = useRef<ReturnType<typeof setTimeout>>();
  const campoDefeito = useRef<HTMLTextAreaElement>(null);
  const catParam = categorias.join(",");

  useEffect(() => {
    clearTimeout(timerModelo.current);
    const q = modelo.trim();
    if (q.length < 1) return setSugModelos([]);
    timerModelo.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/triagem/modelos?q=${encodeURIComponent(q)}&categorias=${catParam}`);
        if (res.ok) {
          setSugModelos(await res.json());
          setIdxModelo(-1);
        }
      } catch {
        // sem sugestões
      }
    }, 150);
  }, [modelo, catParam]);

  useEffect(() => {
    clearTimeout(timerDefeito.current);
    const { atual } = trechoAtual(defeito);
    if (atual.trim().length < 2) return setSugDefeitos([]);
    timerDefeito.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/triagem/defeitos?q=${encodeURIComponent(atual)}&categorias=${catParam}`);
        if (res.ok) {
          setSugDefeitos(await res.json());
          setIdxDefeito(-1);
        }
      } catch {
        // sem sugestões
      }
    }, 200);
  }, [defeito, catParam]);

  function escolherModelo(s: SugestaoModelo) {
    setModelo(s.modelo);
    if (s.categoria && !categorias.includes(s.categoria)) setCategorias((c) => [...c, s.categoria]);
    setAbrirModelos(false);
  }

  function escolherDefeito(s: SugestaoDefeito) {
    const { antes } = trechoAtual(defeito);
    const frase = s.texto.toLowerCase();
    setDefeito(antes + (antes && !/\s$/.test(antes) ? " " : "") + frase);
    setAbrirDefeitos(false);
    campoDefeito.current?.focus();
  }

  function alternarCategoria(sigla: string) {
    setCategorias((c) => (c.includes(sigla) ? c.filter((x) => x !== sigla) : [...c, sigla]));
  }

  function limpar() {
    setModelo("");
    setCategorias([]);
    setDefeito("");
    setGarantias(["LP", "OW"]);
    setResultado(null);
    setErro(null);
    setSugModelos([]);
    setSugDefeitos([]);
  }

  function teclas<T>(
    e: React.KeyboardEvent,
    lista: T[],
    aberto: boolean,
    idx: number,
    setIdx: (n: number) => void,
    escolher: (item: T) => void,
    fechar: () => void
  ) {
    if (!aberto || lista.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx(Math.min(lista.length - 1, idx + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx(Math.max(-1, idx - 1));
    } else if (e.key === "Enter" && idx >= 0) {
      e.preventDefault();
      escolher(lista[idx]);
    } else if (e.key === "Escape") {
      fechar();
    }
  }

  async function analisar(e?: React.FormEvent) {
    e?.preventDefault();
    setErro(null);
    if (categorias.length === 0) return setErro("Escolha pelo menos uma categoria.");
    if (!defeito.trim()) return setErro("Descreva o defeito.");
    setCarregando(true);
    try {
      const res = await fetch("/api/triagem/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelo, categorias, defeito, garantias }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível analisar.");
      setResultado(data);
    } catch (e) {
      setErro((e as Error).message);
      setResultado(null);
    }
    setCarregando(false);
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      // ignora
    }
  }

  const nomesSelecionados = listaCategorias.filter((c) => categorias.includes(c.sigla));

  return (
    <div className="max-w-6xl">
      {/* ---------- formulário ---------- */}
      <form onSubmit={analisar} className="rounded-xl border p-5 mb-6" style={cartao}>
        <div className="flex flex-col md:flex-row gap-4">
          {/* modelo */}
          <div className="relative md:w-72 shrink-0">
            <label className={rotuloClasse} style={{ color: "var(--muted)" }}>
              Modelo (SKU)
            </label>
            <input
              value={modelo}
              onChange={(e) => {
                setModelo(e.target.value.toUpperCase());
                setAbrirModelos(true);
              }}
              onFocus={() => setAbrirModelos(true)}
              onBlur={() => setTimeout(() => setAbrirModelos(false), 150)}
              onKeyDown={(e) => teclas(e, sugModelos, abrirModelos, idxModelo, setIdxModelo, escolherModelo, () => setAbrirModelos(false))}
              placeholder="Ex: UN50CU7700GXZD"
              autoComplete="off"
              className={`mt-1.5 font-mono ${campoClasse}`}
            />
            {abrirModelos && sugModelos.length > 0 && (
              <div className="absolute z-30 mt-1 w-[min(420px,calc(100vw-3rem))] rounded-lg border shadow-2xl max-h-80 overflow-y-auto" style={cartao}>
                {sugModelos.map((s, i) => (
                  <button
                    type="button"
                    key={s.modelo}
                    onMouseDown={() => escolherModelo(s)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-[var(--surface2)]"
                    style={i === idxModelo ? { background: "var(--surface2)" } : undefined}
                  >
                    <span className="font-mono" style={{ color: "var(--ink)" }}>
                      {s.modelo}
                    </span>
                    <span className="text-[11px] shrink-0" style={{ color: "var(--muted)" }}>
                      {s.categoria} · {num(s.qtd_reparadas)} reparadas
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
              Opcional, mas melhora muito o acerto.
            </p>
          </div>

          {/* categorias (várias) */}
          <div className="relative flex-1 min-w-0">
            <label className={rotuloClasse} style={{ color: "var(--muted)" }}>
              Categoria <span className="normal-case font-normal">(uma ou mais)</span>
            </label>
            <button
              type="button"
              onClick={() => setAbrirCategorias((v) => !v)}
              className={`mt-1.5 flex items-center gap-2 text-left min-h-[42px] ${campoClasse}`}
            >
              <span className="flex-1 flex flex-wrap gap-1.5">
                {nomesSelecionados.length === 0 ? (
                  <span style={{ color: "var(--muted)" }}>Selecione...</span>
                ) : (
                  nomesSelecionados.map((c) => (
                    <span key={c.sigla} className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: "var(--accent)" }}>
                      {c.sigla} · {c.nome}
                    </span>
                  ))
                )}
              </span>
              <ChevronDown size={16} className={`shrink-0 transition-transform ${abrirCategorias ? "rotate-180" : ""}`} style={{ color: "var(--muted)" }} />
            </button>
            {abrirCategorias && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setAbrirCategorias(false)} />
                <div className="absolute z-30 mt-1 w-full rounded-lg border shadow-2xl p-2" style={cartao}>
                  <div className="grid sm:grid-cols-2 gap-0.5">
                    {listaCategorias.map((c) => {
                      const marcado = categorias.includes(c.sigla);
                      return (
                        <label
                          key={c.sigla}
                          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-[var(--surface2)]"
                          style={{ color: "var(--ink)" }}
                        >
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternarCategoria(c.sigla)}
                            className="w-4 h-4 accent-[var(--accent)]"
                          />
                          <strong className="w-9">{c.sigla}</strong>
                          <span style={{ color: "var(--muted)" }}>{c.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex justify-between border-t mt-2 pt-2 px-1" style={{ borderColor: "var(--line)" }}>
                    <button type="button" onClick={() => setCategorias(listaCategorias.map((c) => c.sigla))} className="text-xs hover:underline" style={{ color: "var(--accent2)" }}>
                      Marcar todas
                    </button>
                    <button type="button" onClick={() => setCategorias([])} className="text-xs hover:underline" style={{ color: "var(--muted)" }}>
                      Desmarcar
                    </button>
                    <button type="button" onClick={() => setAbrirCategorias(false)} className="text-xs font-medium hover:underline" style={{ color: "var(--ink)" }}>
                      OK
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* garantia */}
          <div className="shrink-0">
            <label className={rotuloClasse} style={{ color: "var(--muted)" }}>
              Garantia
            </label>
            <div className="mt-1.5 grid grid-cols-2 md:flex gap-2">
              {GARANTIAS.map((g) => {
                const ativo = garantias.includes(g.sigla);
                return (
                  <button
                    key={g.sigla}
                    type="button"
                    aria-pressed={ativo}
                    title={ativo && garantias.length === 1 ? "Pelo menos uma opção precisa ficar marcada" : undefined}
                    onClick={() =>
                      setGarantias((atual) =>
                        atual.includes(g.sigla) ? (atual.length === 1 ? atual : atual.filter((x) => x !== g.sigla)) : [...atual, g.sigla],
                      )
                    }
                    className="flex items-center gap-2 rounded-lg border px-3 py-1.5 min-h-[42px] text-sm leading-tight text-left transition md:whitespace-nowrap"
                    style={
                      ativo
                        ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" }
                        : { background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }
                    }
                  >
                    {ativo ? <Check size={14} className="shrink-0" /> : <span className="w-3.5 shrink-0" />}
                    <strong>{g.sigla}</strong>
                    <span className={ativo ? "opacity-90" : ""}>{g.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* defeito com sugestões */}
        <div className="mt-4 relative">
          <label className={rotuloClasse} style={{ color: "var(--muted)" }}>
            Descrição do defeito
          </label>
          <textarea
            ref={campoDefeito}
            value={defeito}
            onChange={(e) => {
              setDefeito(e.target.value);
              setAbrirDefeitos(true);
            }}
            onFocus={() => setAbrirDefeitos(true)}
            onBlur={() => setTimeout(() => setAbrirDefeitos(false), 150)}
            onKeyDown={(e) => teclas(e, sugDefeitos, abrirDefeitos, idxDefeito, setIdxDefeito, escolherDefeito, () => setAbrirDefeitos(false))}
            rows={3}
            placeholder='Digite livremente. Ex: "TV sem imagem, mas tem som" · "barulho ao centrifugar" · "não gela o freezer"'
            className={`mt-1.5 ${campoClasse}`}
          />
          {abrirDefeitos && sugDefeitos.length > 0 && (
            <div className="absolute z-30 left-0 right-0 rounded-lg border shadow-2xl max-h-72 overflow-y-auto" style={cartao}>
              <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Defeitos já cadastrados (clique para usar ou continue digitando)
              </p>
              {sugDefeitos.map((s, i) => (
                <button
                  type="button"
                  key={s.texto}
                  onMouseDown={() => escolherDefeito(s)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-[var(--surface2)]"
                  style={i === idxDefeito ? { background: "var(--surface2)" } : undefined}
                >
                  <span style={{ color: "var(--ink)" }}>{s.texto}</span>
                  <span className="text-[11px] shrink-0" style={{ color: "var(--muted)" }}>
                    {num(s.qtd)} OS
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            Pode misturar sugestões e texto livre, separando por vírgula. Cada palavra é analisada, com sinônimos.
          </p>
        </div>

        {erro && <p className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{erro}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={carregando}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition"
            style={{ boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            {carregando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {carregando ? "Analisando..." : "Analisar defeito"}
          </button>
          <button
            type="button"
            onClick={limpar}
            disabled={carregando}
            className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition hover:border-[var(--accent2)] disabled:opacity-60"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <Eraser size={16} />
            Limpar
          </button>
        </div>
      </form>

      {/* ---------- resultado ---------- */}
      {resultado && <Resultado r={resultado} copiar={copiar} copiado={copiado} />}
    </div>
  );
}

const NIVEL_TXT: Record<NivelBusca, string> = {
  modelo: "deste mesmo modelo",
  familia: "da mesma família (mesmo aparelho, outras cores/regiões)",
  serie: "da mesma série (outras polegadas/capacidades)",
  categoria: "da mesma categoria",
};

const CONFIANCA: Record<Confianca, { rotulo: string; cor: string; fundo: string; dica: string }> = {
  alta: { rotulo: "Confiança alta", cor: "#22c55e", fundo: "rgba(34,197,94,0.12)", dica: "50 OS ou mais: o percentual é bem representativo." },
  media: { rotulo: "Confiança média", cor: "#f59e0b", fundo: "rgba(245,158,11,0.12)", dica: "Entre 20 e 49 OS: use como boa indicação e confirme no teste." },
  baixa: { rotulo: "Amostra pequena", cor: "#ef4444", fundo: "rgba(239,68,68,0.12)", dica: "Menos de 20 OS: o percentual pode mudar muito. Veja o apoio da série e confirme no diagnóstico." },
};

/** Abre a janela com as OS da base GSPN. */
type AbrirOS = (titulo: string, ids: string[]) => void;

function Resultado({ r, copiar, copiado }: { r: ResultadoTriagem; copiar: (t: string) => void; copiado: string | null }) {
  const [janela, setJanela] = useState<{ titulo: string; ids: string[] } | null>(null);
  const abrir: AbrirOS = (titulo, ids) => ids.length && setJanela({ titulo, ids });
  const nada = !r.nivelBase || r.baseOs === 0;

  return (
    <div className="space-y-6">
      <DefeitoIdentificado r={r} />

      {nada ? (
        <div className="rounded-xl border p-5 text-sm flex items-start gap-2" style={{ ...cartao, color: "var(--muted)" }}>
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          Nenhuma OS reparada com esse defeito nessa categoria. Tente descrever com outras palavras ou confira a categoria.
        </div>
      ) : (
        <>
          {r.kits.length > 0 && <KitSolucao r={r} copiar={copiar} copiado={copiado} abrir={abrir} />}

          {/* peças sugeridas */}
          <div className="rounded-xl border overflow-hidden" style={cartao}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
              <p className="text-sm font-semibold flex flex-wrap items-center gap-2" style={{ color: "var(--ink)" }}>
                <Wrench size={16} style={{ color: "var(--accent2)" }} /> Peças sugeridas (mais prováveis primeiro)
                <span className="text-[11px] font-normal" style={{ color: "var(--muted)" }}>
                  · inclui as soluções com mais de uma peça · clique na linha para ver as OS
                </span>
              </p>
            </div>
            {r.pecas.length === 0 && r.conjuntos.length === 0 ? (
              <p className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>
                Sem histórico de peças para este modelo/família. Veja os tipos de peça mais prováveis abaixo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="text-left text-xs" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                      <th className="px-4 py-2.5 font-medium w-8">#</th>
                      <th className="px-4 py-2.5 font-medium">Código</th>
                      <th className="px-4 py-2.5 font-medium">Peça</th>
                      <th className="px-4 py-2.5 font-medium w-60">OS com esta peça</th>
                      <th className="px-4 py-2.5 font-medium">Origem</th>
                      <th className="px-4 py-2.5 font-medium" title="OS do modelo/família (qualquer defeito) que usaram esta peça">
                        Uso total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasSugeridas(r).map((l, i) =>
                      l.tipo === "conjunto" ? (
                        <tr
                          key={"c" + i}
                          className="border-t cursor-pointer hover:brightness-110"
                          style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
                          onClick={() => abrir(`Conjunto: ${l.c.pecas.map((p) => p.nome).join(" + ")}`, l.c.ids)}
                        >
                          <td className="px-4 py-3 font-semibold" style={{ color: i < 3 ? "var(--accent2)" : "var(--muted)" }}>
                            {i + 1}
                          </td>
                          <td className="px-4 py-3" colSpan={2}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {l.c.pecas.map((p, j) => (
                                <span key={p.codigo} className="inline-flex items-center gap-1.5">
                                  {j > 0 && <span style={{ color: "var(--muted)" }}>+</span>}
                                  <PecaChip codigo={p.codigo} nome={p.nome} descricao={p.descricao} copiar={copiar} copiado={copiado} />
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Barra valor={l.c.percentual} cor="#a855f7" texto={`${num(l.c.os)} de ${num(l.c.baseOs)}`} />
                          </td>
                          <td className="px-4 py-3">
                            <span
                              title="OS parecidas que usaram TODAS estas peças juntas"
                              className="text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap"
                              style={{ color: "#a855f7", background: "var(--surface)" }}
                            >
                              Conjunto · {l.c.pecas.length} peças
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>—</td>
                        </tr>
                      ) : (
                        <tr
                          key={l.p.codigo + i}
                          className="border-t cursor-pointer hover:bg-[var(--surface2)]"
                          style={{ borderColor: "var(--line)" }}
                          onClick={() => abrir(`${l.p.nome} (${l.p.codigo})`, l.p.ids)}
                        >
                          <td className="px-4 py-3 font-semibold" style={{ color: i < 3 ? "var(--accent2)" : "var(--muted)" }}>
                            {i + 1}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => copiar(l.p.codigo)}
                              title="Copiar código"
                              className="inline-flex items-center gap-1.5 font-mono text-xs rounded px-2 py-1 whitespace-nowrap hover:bg-[var(--surface2)]"
                              style={{ color: "var(--ink)" }}
                            >
                              {l.p.codigo}
                              {copiado === l.p.codigo ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} style={{ color: "var(--muted)" }} />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p
                              className="font-medium cursor-help underline decoration-dotted decoration-1 underline-offset-4"
                              style={{ color: "var(--ink)", textDecorationColor: "var(--line)" }}
                              title={`Descrição no GSPN: ${l.p.descricao}`}
                            >
                              {l.p.nome || l.p.tipo}
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                              {l.p.tipo}
                              {r.guia?.[l.p.tipo]?.por_que && (
                                <span className="ml-1 cursor-help" title={`Por que: ${r.guia[l.p.tipo].por_que}\n\nComo confirmar: ${r.guia[l.p.tipo].como_confirmar ?? "—"}`}>
                                  · <Info size={11} className="inline -mt-0.5" /> por quê?
                                </span>
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Barra valor={l.p.percentual} cor={ORIGEM[l.p.origem].cor} texto={`${num(l.p.osComPeca)} de ${num(l.p.baseOs)}`} />
                          </td>
                          <td className="px-4 py-3">
                            <span
                              title={ORIGEM[l.p.origem].dica}
                              className="text-[11px] font-medium rounded-full px-2 py-0.5 cursor-help whitespace-nowrap"
                              style={{ color: ORIGEM[l.p.origem].cor, background: "var(--surface2)" }}
                            >
                              {ORIGEM[l.p.origem].rotulo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                            {num(l.p.usoHistorico)} OS
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* tipos */}
            <div className="rounded-xl border p-5" style={cartao}>
              <p className="text-sm font-semibold flex items-center gap-2 mb-1" style={{ color: "var(--ink)" }}>
                <Layers size={16} style={{ color: "var(--accent2)" }} /> Tipos de peça mais trocados nesse defeito
              </p>
              <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
                {num(r.baseTipo)} OS {NIVEL_TXT[r.nivelTipo]}
              </p>
              <div className="space-y-2.5">
                {r.tipos.map((t) => (
                  <div key={t.tipo}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: "var(--ink)" }}>{t.tipo}</span>
                      <span style={{ color: "var(--muted)" }}>
                        {num(t.os)} OS · <strong style={{ color: "var(--ink)" }}>{pct(t.percentual)}</strong>
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, t.percentual)}%`, background: "var(--accent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* peças trocadas juntas */}
            <div className="rounded-xl border p-5" style={cartao}>
              <p className="text-sm font-semibold flex items-center gap-2 mb-1" style={{ color: "var(--ink)" }}>
                <Link2 size={16} style={{ color: "var(--accent2)" }} /> Peças trocadas juntas
              </p>
              <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
                % das {num(r.baseOs)} OS parecidas que usaram as duas peças · clique para ver as OS
              </p>
              {r.combinacoes.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>Nenhuma combinação frequente.</p>
              ) : (
                <div className="space-y-2">
                  {r.combinacoes.map((c) => (
                    <div
                      role="button"
                      tabIndex={0}
                      key={c.codigos.join("+")}
                      onClick={() => abrir(`${c.nomes[0]} + ${c.nomes[1]}`, c.ids)}
                      className="w-full text-left rounded-lg px-3 py-2 cursor-pointer hover:brightness-110"
                      style={{ background: "var(--surface2)" }}
                    >
                      <span className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <PecaChip codigo={c.codigos[0]} nome={c.nomes?.[0]} descricao={c.descricoes?.[0]} copiar={copiar} copiado={copiado} />
                        <span style={{ color: "var(--muted)" }}>+</span>
                        <PecaChip codigo={c.codigos[1]} nome={c.nomes?.[1]} descricao={c.descricoes?.[1]} copiar={copiar} copiado={copiado} />
                      </span>
                      <span className="mt-2 block">
                        <Barra valor={c.percentual} cor="var(--accent)" texto={`${num(c.os)} OS`} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* exemplos */}
          <div className="rounded-xl border overflow-hidden" style={cartao}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                OS parecidas usadas no cálculo (exemplos)
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                {r.exemplos.length > 0 && r.exemplos.every((e) => e.nivel === "modelo") ? (
                  <>
                    Somente OS do mesmo modelo: <span className="font-mono">{r.exemplos[0].modelo}</span> ·{" "}
                  </>
                ) : null}
                clique na OS para ver todos os dados da base GSPN
              </p>
            </div>
            {r.exemplos.length === 0 ? (
              <p className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>
                Nenhuma OS deste modelo exato com esse defeito. As sugestões acima usam a família / série / categoria.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="text-left text-xs" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                      <th className="px-4 py-2.5 font-medium">OS</th>
                      <th className="px-4 py-2.5 font-medium" title="LP = em garantia · OW = fora de garantia">Garantia</th>
                      <th className="px-4 py-2.5 font-medium">Modelo</th>
                      <th className="px-4 py-2.5 font-medium">Defeito</th>
                      <th className="px-4 py-2.5 font-medium">Reparo</th>
                      <th className="px-4 py-2.5 font-medium">Peças</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.exemplos.map((e) => (
                      <tr
                        key={e.os}
                        className="border-t align-top cursor-pointer hover:bg-[var(--surface2)]"
                        style={{ borderColor: "var(--line)" }}
                        onClick={() => abrir(`OS ${e.os}`, [e.os])}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs underline decoration-dotted underline-offset-4" style={{ color: "var(--accent2)" }}>
                          {e.os}
                        </td>
                        <td className="px-4 py-2.5">
                          <SeloGarantia g={e.garantia} />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--ink)" }}>
                          {e.modelo}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "var(--ink)" }}>{e.defeito}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{e.reparacao || "—"}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }} onClick={(ev) => ev.stopPropagation()}>
                          {e.pecas.length ? (
                            <span className="flex flex-wrap gap-1">
                              {e.pecas.map((p, i) => (
                                <PecaChip key={p.c + i} codigo={p.c} nome={p.n || p.t} descricao={p.d} copiar={copiar} copiado={copiado} />
                              ))}
                            </span>
                          ) : (
                            "sem peça"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--muted)" }}>
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>
              Entram no cálculo só OS com status <strong>Produto Entregue</strong> e peça lançada (ou código de reparo A..). Ficam de
              fora os códigos de reparo <strong>X</strong> (cancelado, orçamento recusado, sem defeito).{" "}
              {r.garantias && r.garantias.length === 1 && (
                <strong style={{ color: "var(--ink)" }}>
                  Somente OS {r.garantias[0] === "LP" ? "em garantia (LP)" : "fora de garantia (OW)"}.{" "}
                </strong>
              )}
              Sugestão baseada no histórico de reparos. Sempre confirme no diagnóstico técnico antes de pedir a peça.
            </span>
          </p>
        </>
      )}

      {janela && <JanelaOS titulo={janela.titulo} ids={janela.ids} copiar={copiar} copiado={copiado} onFechar={() => setJanela(null)} />}
    </div>
  );
}

/** Barra de percentual com texto "x de y · z%". */
function Barra({ valor, cor, texto }: { valor: number; cor: string; texto: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden min-w-[60px]" style={{ background: "var(--surface2)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, valor))}%`, background: cor }} />
      </div>
      <span className="text-xs text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
        {texto} · <strong>{pct(valor)}</strong>
      </span>
    </div>
  );
}

/** Defeito padrão identificado + perfil de defeitos do modelo. */
function DefeitoIdentificado({ r }: { r: ResultadoTriagem }) {
  const [verGuia, setVerGuia] = useState(false);
  const principal = r.defeito.codigos[0];
  const perfilTop = r.perfil.filter((p) => p.codigo).slice(0, 8);
  return (
    <div className="rounded-xl border p-5" style={cartao}>
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Defeito identificado
          </p>
          {principal ? (
            <>
              <div className="flex flex-wrap gap-2 mt-2">
                {r.defeito.codigos.map((c) => (
                  <span
                    key={c.codigo}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold"
                    style={{ background: "var(--accent-glow)", border: "1px solid var(--accent2)", color: "var(--ink)" }}
                    title={`Código de sintoma IRIS (coluna AY): ${c.codigo}`}
                  >
                    {c.nome || c.codigo}
                    <span className="font-mono text-[11px] font-normal opacity-70">{c.codigo}</span>
                  </span>
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                Nas OS da base com esse texto, {pct(principal.percentual)} foram classificadas pelo técnico como{" "}
                <strong>{principal.nome || principal.codigo}</strong>. A análise conta todas as OS com esse defeito padrão, mesmo
                escritas de outro jeito.
              </p>
              {principal.guia && (
                <button
                  type="button"
                  onClick={() => setVerGuia((v) => !v)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
                  style={{ color: "var(--accent2)" }}
                >
                  <GraduationCap size={14} /> {verGuia ? "Esconder" : "Como triar este defeito"}
                </button>
              )}
              {verGuia && principal.guia && (
                <p className="mt-2 text-xs leading-relaxed rounded-lg p-3" style={{ background: "var(--surface2)", color: "var(--ink)" }}>
                  {principal.guia}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
              Não encontrei um defeito padrão (código IRIS) dominante: a análise usa as palavras digitadas.
            </p>
          )}
        </div>

        {perfilTop.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Perfil de defeitos do modelo · {num(r.perfilTotal)} OS reparadas
            </p>
            <div className="mt-2 space-y-1.5">
              {perfilTop.map((p) => (
                <div key={p.codigo} className="flex items-center gap-2 text-xs">
                  <span className="w-40 truncate" style={{ color: p.destacado ? "var(--ink)" : "var(--muted)", fontWeight: p.destacado ? 600 : 400 }} title={p.codigo}>
                    {p.nome || p.codigo}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(2, p.percentual)}%`, background: p.destacado ? "var(--accent2)" : "var(--line)" }}
                    />
                  </div>
                  <span className="w-20 text-right whitespace-nowrap" style={{ color: p.destacado ? "var(--ink)" : "var(--muted)" }}>
                    {num(p.os)} · {pct(p.percentual)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KitSolucao({ r, copiar, copiado, abrir }: { r: ResultadoTriagem; copiar: (t: string) => void; copiado: string | null; abrir: AbrirOS }) {
  const [principal, ...outros] = r.kits;
  const conf = CONFIANCA[r.confianca];
  const codigosPrincipal = [...principal.pecas, ...principal.acompanham].map((p) => p.codigo).filter(Boolean).join(" ");
  const nivel = r.kitNivel ?? "modelo";
  const grupos = Array.from(new Set(principal.pecas.map((p) => p.tipo)));

  const itens = (k: KitPecas, destaque = false) =>
    k.pecas.length === 0 ? (
      <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
        Reparo sem troca de peça (ajuste, limpeza ou atualização)
      </span>
    ) : (
      k.pecas.map((p) =>
        p.codigo ? (
          <PecaChip key={p.codigo} codigo={p.codigo} nome={p.nome} descricao={p.descricao} copiar={copiar} copiado={copiado} grande={destaque} />
        ) : (
          <span
            key={p.tipo}
            className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs"
            style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
          >
            {p.nome || p.tipo}
          </span>
        ),
      )
    );

  return (
    <div className="rounded-xl border-2 overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--accent2)", boxShadow: "0 0 30px var(--accent-glow)" }}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageCheck size={18} style={{ color: "var(--accent2)" }} /> Conjunto de peças mais provável
          </p>
          <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-help" style={{ color: conf.cor, background: conf.fundo }} title={conf.dica}>
            {conf.rotulo} · {num(r.kitBase)} OS
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          {num(r.kitBase)} OS reparadas {NIVEL_TXT[nivel]}
          {r.garantias && r.garantias.length === 1 ? (r.garantias[0] === "LP" ? " em garantia" : " fora de garantia") : ""} com esse defeito
          {r.viaIris > 0 && (
            <>
              {" "}
              ({num(r.viaTexto)} pelo texto + {num(r.viaIris)} pelo defeito padrão)
            </>
          )}
          . Conserto mais comum:
        </p>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && abrir("OS do conjunto mais provável", principal.ids)}
          onClick={() => abrir("OS do conjunto mais provável", principal.ids)}
          className="mt-4 w-full text-left rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-4 hover:brightness-110 cursor-pointer"
          style={{ background: "var(--surface2)" }}
          title="Clique para ver as OS"
        >
          <div className="shrink-0 text-center md:w-32">
            <p className="text-3xl font-bold leading-none" style={{ color: "var(--accent2)" }}>
              {pct(principal.percentual)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
              {num(principal.os)} de {num(r.kitBase)} OS
            </p>
          </div>
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center gap-2">
              {principal.pecas.length > 1 && (
                <span className="text-[11px] font-semibold uppercase tracking-wide mr-1" style={{ color: "var(--muted)" }}>
                  {principal.pecas.length} peças
                </span>
              )}
              {itens(principal, true)}
            </div>
            {principal.acompanham.length > 0 && (
              <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                Costuma ir junto: {principal.acompanham.map((a) => (a.codigo ? `${a.nome || a.tipo} (${a.codigo})` : a.nome || a.tipo)).join(", ")}
              </p>
            )}
            {principal.porTipo && (
              <p className="text-[11px] mt-2 text-amber-500">
                Sem histórico suficiente deste modelo: o conjunto mostra os tipos de peça usados {NIVEL_TXT[nivel]}.
              </p>
            )}
          </div>
          {codigosPrincipal && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                copiar(codigosPrincipal);
              }}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:border-[var(--accent2)]"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              {copiado === codigosPrincipal ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              Copiar todos
            </span>
          )}
        </div>

        {/* por que estas peças (guia + evidência da base) */}
        {grupos.some((g) => r.guia?.[g] || r.evidencia.porGrupo[g]) && (
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            {grupos.map((g) => {
              const gu = r.guia?.[g];
              const ev = r.evidencia.porGrupo[g];
              if (!gu && !ev) return null;
              return (
                <div key={g} className="rounded-lg border p-3 text-xs leading-relaxed" style={{ borderColor: "var(--line)" }}>
                  <p className="font-semibold flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                    <GraduationCap size={14} style={{ color: "var(--accent2)" }} /> Por que {g}?
                  </p>
                  {ev !== undefined && (
                    <p className="mt-1" style={{ color: "var(--ink)" }}>
                      Na base, <strong>{pct(ev)}</strong> das {num(r.evidencia.base)} OS da categoria com esse defeito usaram {g.toLowerCase()}.
                    </p>
                  )}
                  {gu?.o_que_e && <p className="mt-1" style={{ color: "var(--muted)" }}>{gu.o_que_e}</p>}
                  {gu?.por_que && <p className="mt-1" style={{ color: "var(--muted)" }}>{gu.por_que}</p>}
                  {gu?.como_confirmar && (
                    <p className="mt-1.5" style={{ color: "var(--ink)" }}>
                      <strong>Como confirmar:</strong> {gu.como_confirmar}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {outros.length > 0 && (
        <div className="border-t px-5 py-4" style={{ borderColor: "var(--line)" }}>
          <p className="text-xs font-medium mb-2.5" style={{ color: "var(--muted)" }}>
            Outros conjuntos que também resolveram · clique para ver as OS
          </p>
          <div className="space-y-2">
            {outros.map((k, i) => (
              <div
                role="button"
                tabIndex={0}
                key={i}
                onClick={() => abrir(`Conjunto: ${k.pecas.map((p) => p.nome).join(" + ") || "sem troca de peça"}`, k.ids)}
                className="w-full text-left flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg px-2 py-1 cursor-pointer hover:bg-[var(--surface2)]"
              >
                <div className="sm:w-56 shrink-0">
                  <Barra valor={k.percentual} cor="var(--accent)" texto={`${num(k.os)} OS`} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {itens(k)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.apoio && (
        <div className="border-t px-5 py-4" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
            Apoio: {num(r.apoio.base)} OS {NIVEL_TXT[r.apoio.nivel]} com esse defeito
          </p>
          <p className="text-[11px] mb-2.5" style={{ color: "var(--muted)" }}>
            Como a amostra deste modelo é pequena, veja que tipo de peça resolveu nos aparelhos parecidos:
          </p>
          <div className="space-y-2">
            {r.apoio.kits.map((k, i) => (
              <button
                type="button"
                key={i}
                onClick={() => abrir(`Série: ${k.pecas.map((p) => p.nome).join(" + ") || "sem troca de peça"}`, k.ids)}
                className="w-full text-left flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg px-2 py-1 hover:bg-[var(--surface)]"
              >
                <div className="sm:w-56 shrink-0">
                  <Barra valor={k.percentual} cor="#64748b" texto={`${num(k.os)} OS`} />
                </div>
                <span className="text-xs" style={{ color: "var(--ink)" }}>
                  {k.pecas.map((p) => p.nome).join(" + ") || "Reparo sem troca de peça"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type OsDetalhe = {
  os: string;
  asc_code: string | null;
  asc_nome: string | null;
  modelo: string | null;
  categoria: string | null;
  categoria_gspn: string | null;
  status: string | null;
  data_solicitacao: string | null;
  reparo_finalizado: string | null;
  garantia: string | null;
  tipo_defeito: string | null;
  sintoma: string | null;
  defeito: string | null;
  reparacao: string | null;
  codigo_reparo: string | null;
  pecas: { c: string; d: string; t: string; n?: string; q: number }[];
};

const dataBr = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

/** Janela com as OS da base GSPN (dados completos ao clicar em cada uma). */
function JanelaOS({
  titulo,
  ids,
  copiar,
  copiado,
  onFechar,
}: {
  titulo: string;
  ids: string[];
  copiar: (t: string) => void;
  copiado: string | null;
  onFechar: () => void;
}) {
  const POR_PAGINA = 30;
  const [lista, setLista] = useState<OsDetalhe[]>([]);
  const [carregadas, setCarregadas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(ids.length === 1 ? ids[0] : null);

  async function carregar(de: number) {
    setCarregando(true);
    try {
      const res = await fetch("/api/triagem/os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids.slice(de, de + POR_PAGINA) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao buscar as OS.");
      setLista((l) => {
        const ja = new Set(l.map((o) => o.os));
        return [...l, ...(data.os as OsDetalhe[]).filter((o) => !ja.has(o.os))];
      });
      setCarregadas(de + POR_PAGINA);
    } catch (e) {
      setErro((e as Error).message);
    }
    setCarregando(false);
  }

  const iniciou = useRef(false);
  useEffect(() => {
    if (!iniciou.current) {
      iniciou.current = true;
      carregar(0);
    }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campos = (o: OsDetalhe): [string, string][] => [
    ["OS (SO Nro.)", o.os],
    ["Unidade (ASC)", `${o.asc_code ?? ""} ${o.asc_nome ?? ""}`.trim() || "—"],
    ["Modelo", o.modelo ?? "—"],
    ["Categoria (BH)", `${o.categoria ?? ""} · ${o.categoria_gspn ?? ""}`],
    ["Status", o.status ?? "—"],
    ["Data de solicitação", dataBr(o.data_solicitacao)],
    ["Reparo finalizado", dataBr(o.reparo_finalizado)],
    ["Garantia (AL)", o.garantia ?? "—"],
    ["Tipo de defeito (AM)", o.tipo_defeito ?? "—"],
    ["Código de sintoma IRIS (AY)", o.sintoma ?? "—"],
    ["Código de reparo (BB)", o.codigo_reparo ?? "—"],
    ["Descrição do defeito (AU)", o.defeito ?? "—"],
    ["Descrição da reparação (AT)", o.reparacao ?? "—"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 md:p-6" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onFechar}>
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {titulo}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              {num(ids.length)} OS da base GSPN · clique em uma OS para ver todos os dados
            </p>
          </div>
          <button type="button" onClick={onFechar} className="p-1 hover:opacity-70" style={{ color: "var(--muted)" }} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto">
          {lista.map((o) => (
            <div key={o.os} className="border-b" style={{ borderColor: "var(--line)" }}>
              <button
                type="button"
                onClick={() => setAberta((a) => (a === o.os ? null : o.os))}
                className="w-full text-left px-5 py-3 grid grid-cols-[100px_120px_1fr] md:grid-cols-[100px_120px_150px_1fr_1fr] gap-3 text-xs hover:bg-[var(--surface2)]"
              >
                <span className="font-mono" style={{ color: "var(--accent2)" }}>
                  {o.os}
                </span>
                <SeloGarantia g={o.garantia ?? ""} />
                <span className="hidden md:block font-mono truncate" style={{ color: "var(--ink)" }}>
                  {o.modelo}
                </span>
                <span className="truncate" style={{ color: "var(--ink)" }}>
                  {o.defeito}
                </span>
                <span className="hidden md:block truncate" style={{ color: "var(--muted)" }}>
                  {o.pecas.map((p) => p.n || p.t).join(" + ") || "sem peça"}
                </span>
              </button>
              {aberta === o.os && (
                <div className="px-5 pb-4">
                  <div className="grid md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs rounded-lg p-4" style={{ background: "var(--surface2)" }}>
                    {campos(o).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="w-44 shrink-0" style={{ color: "var(--muted)" }}>
                          {k}
                        </span>
                        <span style={{ color: "var(--ink)" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] mt-3 mb-1.5 font-semibold" style={{ color: "var(--muted)" }}>
                    Peças lançadas ({o.pecas.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {o.pecas.length ? (
                      o.pecas.map((p, i) => (
                        <PecaChip key={p.c + i} codigo={p.c} nome={`${p.n || p.t}${p.q > 1 ? ` ×${p.q}` : ""}`} descricao={p.d} copiar={copiar} copiado={copiado} />
                      ))
                    ) : (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        sem peça
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {erro && <p className="px-5 py-4 text-sm text-red-400">{erro}</p>}
          {carregando && (
            <p className="px-5 py-4 text-sm flex items-center gap-2" style={{ color: "var(--muted)" }}>
              <Loader2 size={14} className="animate-spin" /> Buscando na base GSPN...
            </p>
          )}
          {!carregando && carregadas < ids.length && (
            <div className="px-5 py-4">
              <button
                type="button"
                onClick={() => carregar(carregadas)}
                className="rounded-lg border px-4 py-2 text-xs font-medium hover:border-[var(--accent2)]"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              >
                Carregar mais ({num(ids.length - carregadas)} restantes)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Uma peça: part number (com botão de copiar) + nome traduzido. Passando o mouse mostra a descrição do GSPN. */
function PecaChip({
  codigo,
  nome,
  descricao,
  copiar,
  copiado,
  grande = false,
}: {
  codigo: string;
  nome?: string;
  descricao?: string;
  copiar: (t: string) => void;
  copiado: string | null;
  grande?: boolean;
}) {
  const ok = copiado === codigo;
  return (
    <span
      className={`inline-flex items-stretch max-w-full rounded-lg border overflow-hidden ${grande ? "text-sm" : "text-xs"}`}
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <button
        type="button"
        onClick={() => copiar(codigo)}
        title={`Copiar ${codigo}`}
        aria-label={`Copiar part number ${codigo}`}
        className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap font-mono font-semibold border-r hover:bg-[var(--surface2)] transition ${grande ? "px-2.5 py-1.5" : "px-2 py-1"}`}
        style={{ color: "var(--ink)", borderColor: "var(--line)" }}
      >
        {codigo}
        {ok ? <Check size={grande ? 14 : 12} className="text-emerald-500" /> : <Copy size={grande ? 14 : 12} style={{ color: "var(--muted)" }} />}
      </button>
      {nome && (
        <span
          className={`inline-flex items-center min-w-0 cursor-help ${grande ? "px-2.5 py-1.5 font-medium" : "px-2 py-1"}`}
          style={{ color: grande ? "var(--ink)" : "var(--muted)" }}
          title={descricao ? `Descrição no GSPN: ${descricao}` : undefined}
        >
          {nome}
        </span>
      )}
    </span>
  );
}

/** LP (em garantia) / OW (fora de garantia) */
function SeloGarantia({ g }: { g?: string }) {
  const v = (g || "").toUpperCase();
  if (v !== "LP" && v !== "OW") return <span className="text-xs" style={{ color: "var(--muted)" }}>{v || "—"}</span>;
  const lp = v === "LP";
  return (
    <span
      title={lp ? "Em garantia" : "Fora de garantia"}
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={
        lp
          ? { color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)" }
          : { color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)" }
      }
    >
      {v} · {lp ? "Garantia" : "Fora"}
    </span>
  );
}
