"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, Eraser, Info, Layers, Link2, Loader2, Search, Sparkles, Wrench } from "lucide-react";
import { CATEGORIAS } from "@/lib/gspn";
import type { ResultadoTriagem, NivelBusca, PecaSugerida } from "@/lib/triagem";

type SugestaoModelo = { modelo: string; familia: string; categoria: string; qtd_os: number; qtd_entregues: number; qtd_reparadas: number };
type SugestaoDefeito = { texto: string; qtd: number };

const NOME_NIVEL: Record<NivelBusca, string> = { modelo: "mesmo modelo", familia: "mesma família", categoria: "mesma categoria" };
const ORIGEM: Record<PecaSugerida["origem"], { rotulo: string; cor: string; dica: string }> = {
  "defeito-modelo": { rotulo: "Modelo", cor: "#22c55e", dica: "Usada neste mesmo modelo com defeito parecido" },
  "defeito-familia": { rotulo: "Família", cor: "#3b82f6", dica: "Usada em modelos da mesma família com defeito parecido" },
  "tipo-provavel": { rotulo: "Tipo provável", cor: "#f59e0b", dica: "Tipo de peça comum para esse defeito; código mais usado neste modelo/família" },
};

const cartao = { background: "var(--surface)", borderColor: "var(--line)" } as const;
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

type Inicial = { modelo?: string; categorias?: string[]; defeito?: string; resultado?: ResultadoTriagem | null };

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
        body: JSON.stringify({ modelo, categorias, defeito }),
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

function Resultado({ r, copiar, copiado }: { r: ResultadoTriagem; copiar: (t: string) => void; copiado: string | null }) {
  const nada = r.baseTipo === 0;
  return (
    <div className="space-y-6">
      {/* como entendi */}
      <div className="rounded-xl border p-5" style={cartao}>
        <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--ink)" }}>
          <Sparkles size={16} style={{ color: "var(--accent2)" }} /> Como entendi o defeito
        </p>
        <div className="flex flex-wrap gap-2">
          {r.termos.map((t, i) => (
            <span
              key={i}
              title={
                t.tipo === "conceito"
                  ? `Também procura: ${t.variantes.join(", ")}`
                  : t.tipo === "funciona"
                    ? "Entendi que isso FUNCIONA (veio depois de \"tem\"), então não entra na busca"
                    : "Palavra procurada (e variações)"
              }
              className="rounded-full px-3 py-1 text-xs border cursor-help"
              style={
                t.tipo === "conceito"
                  ? { background: "var(--accent-glow)", borderColor: "var(--accent2)", color: "var(--ink)" }
                  : t.tipo === "funciona"
                    ? { background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.5)", color: "#22c55e" }
                    : { background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }
              }
            >
              {t.tipo === "funciona" && "✓ funciona: "}
              {t.rotulo}
              {t.tipo === "conceito" && <span className="opacity-60"> +{t.variantes.length - 1}</span>}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Numero rotulo="OS parecidas · modelo" valor={r.casadosPorNivel.modelo} de={r.totais.n_modelo} />
          <Numero rotulo="OS parecidas · família" valor={r.casadosPorNivel.familia} de={r.totais.n_familia} />
          <Numero rotulo="OS parecidas · categoria" valor={r.casadosPorNivel.categoria} de={r.totais.n_categoria} />
          <Numero
            rotulo="Reparadas sem trocar peça"
            valor={r.semPeca}
            texto={r.baseTipo ? pct((100 * r.semPeca) / r.baseTipo) : "—"}
          />
        </div>
        <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: "var(--muted)" }}>
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>
            Entram no cálculo só OS com status <strong>Produto Entregue</strong> e reparo realizado (com peça ou código de
            reparo A..) — aparelhos devolvidos sem conserto ficam de fora. Tipos de peça calculados com {num(r.baseTipo)} OS
            da {NOME_NIVEL[r.nivelTipo]}
            {r.familia ? ` (família ${r.familia})` : ""}.
          </span>
        </p>
      </div>

      {nada ? (
        <div className="rounded-xl border p-5 text-sm flex items-start gap-2" style={{ ...cartao, color: "var(--muted)" }}>
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          Nenhuma OS reparada com esse defeito nessa categoria. Tente descrever com outras palavras ou confira a categoria.
        </div>
      ) : (
        <>
          {/* peças sugeridas */}
          <div className="rounded-xl border overflow-hidden" style={cartao}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <Wrench size={16} style={{ color: "var(--accent2)" }} /> Peças sugeridas (mais prováveis primeiro)
              </p>
            </div>
            {r.pecas.length === 0 ? (
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
                      <th className="px-4 py-2.5 font-medium w-56">OS com esta peça</th>
                      <th className="px-4 py-2.5 font-medium">Origem</th>
                      <th className="px-4 py-2.5 font-medium" title="OS do modelo/família (qualquer defeito) que usaram esta peça">
                        Uso total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.pecas.map((p, i) => (
                      <tr key={p.codigo} className="border-t" style={{ borderColor: "var(--line)" }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: i < 3 ? "var(--accent2)" : "var(--muted)" }}>
                          {i + 1}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => copiar(p.codigo)}
                            title="Copiar código"
                            className="inline-flex items-center gap-1.5 font-mono text-xs rounded px-2 py-1 whitespace-nowrap hover:bg-[var(--surface2)]"
                            style={{ color: "var(--ink)" }}
                          >
                            {p.codigo}
                            {copiado === p.codigo ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} style={{ color: "var(--muted)" }} />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium" style={{ color: "var(--ink)" }}>{p.tipo}</p>
                          <p className="text-[11px]" style={{ color: "var(--muted)" }}>{p.descricao}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.percentual)}%`, background: ORIGEM[p.origem].cor }} />
                            </div>
                            <span className="text-xs w-24 text-right" style={{ color: "var(--ink)" }}>
                              {num(p.osComPeca)} de {num(p.baseOs)} · <strong>{pct(p.percentual)}</strong>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            title={ORIGEM[p.origem].dica}
                            className="text-[11px] font-medium rounded-full px-2 py-0.5 cursor-help"
                            style={{ color: ORIGEM[p.origem].cor, background: "var(--surface2)" }}
                          >
                            {ORIGEM[p.origem].rotulo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                          {num(p.usoHistorico)} OS
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* tipos */}
            <div className="rounded-xl border p-5" style={cartao}>
              <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--ink)" }}>
                <Layers size={16} style={{ color: "var(--accent2)" }} /> Tipos de peça mais trocados nesse defeito
              </p>
              <div className="space-y-2.5">
                {r.tipos.length === 0 && (
                  <p className="text-sm" style={{ color: "var(--muted)" }}>Nenhuma peça trocada nas OS parecidas.</p>
                )}
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

            {/* combinações */}
            <div className="rounded-xl border p-5" style={cartao}>
              <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--ink)" }}>
                <Link2 size={16} style={{ color: "var(--accent2)" }} /> Peças trocadas juntas
              </p>
              {r.combinacoes.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>Nenhuma combinação frequente.</p>
              ) : (
                <div className="space-y-2">
                  {r.combinacoes.map((c) => (
                    <div key={c.codigos.join("+")} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ background: "var(--surface2)" }}>
                      <span className="font-mono text-xs" style={{ color: "var(--ink)" }}>
                        {c.codigos[0]} + {c.codigos[1]}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{num(c.os)} OS</span>
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
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="text-left text-xs" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                    <th className="px-4 py-2.5 font-medium">OS</th>
                    <th className="px-4 py-2.5 font-medium">Modelo</th>
                    <th className="px-4 py-2.5 font-medium">Defeito</th>
                    <th className="px-4 py-2.5 font-medium">Reparo</th>
                    <th className="px-4 py-2.5 font-medium">Peças</th>
                  </tr>
                </thead>
                <tbody>
                  {r.exemplos.map((e) => (
                    <tr key={e.os} className="border-t align-top" style={{ borderColor: "var(--line)" }}>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--muted)" }}>{e.os}</td>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--ink)" }}>
                        {e.modelo}
                        <p className="font-sans text-[10px]" style={{ color: "var(--muted)" }}>{NOME_NIVEL[e.nivel]}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--ink)" }}>{e.defeito}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{e.reparacao || "—"}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>
                        {e.pecas.length ? e.pecas.map((p) => `${p.c} (${p.t})`).join(", ") : "sem peça"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--muted)" }}>
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>Sugestão baseada no histórico de reparos entregues. Sempre confirme no diagnóstico técnico antes de pedir a peça.</span>
          </p>
        </>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, de, texto }: { rotulo: string; valor: number; de?: number; texto?: string }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--surface2)" }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{rotulo}</p>
      <p className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
        {texto ?? num(valor)}
        {de !== undefined && <span className="text-xs font-normal" style={{ color: "var(--muted)" }}> de {num(de)}</span>}
      </p>
    </div>
  );
}
