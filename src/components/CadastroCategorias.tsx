"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Search, Tags, Trash2, Wand2, X } from "lucide-react";
import PopupConfirmar from "@/components/PopupConfirmar";
import {
  PREFIXO_VALIDO,
  SIGLA_VALIDA,
  limparPrefixo,
  type CategoriaResumo,
  type ModeloSemCategoria,
  type RegraCategoria,
} from "@/lib/categorias";

const cartao = { background: "var(--surface)", borderColor: "var(--line)" } as const;
const campoClasse =
  "w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] bg-[var(--surface2)] border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--muted)]";
const botaoPrincipal =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 transition";
const fmt = (n: number) => (n ?? 0).toLocaleString("pt-BR");

type Previa = {
  modelos: number;
  os: number;
  porCategoria: Record<string, number>;
  exemplos: { modelo: string; categoria: string; qtd_os: number }[];
  regra: { prefixo: string; categoria: string } | null;
};

async function chamar(url: string, metodo: string, corpo?: unknown) {
  const res = await fetch(url, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Falha no servidor (${res.status}).`);
  return data;
}

export default function CadastroCategorias({
  categorias,
  regras,
  semCategoria,
  nomesUsuarios,
  osSemModelo,
  podeEditar,
}: {
  categorias: CategoriaResumo[];
  regras: RegraCategoria[];
  semCategoria: ModeloSemCategoria[];
  nomesUsuarios: Record<string, string>;
  osSemModelo: number;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const nomeCat = useMemo(() => new Map(categorias.map((c) => [c.sigla, c.nome])), [categorias]);
  const escolhiveis = categorias.filter((c) => c.sigla !== "OUT");

  // ---- nova regra ----
  const [prefixo, setPrefixo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    const p = limparPrefixo(prefixo);
    if (!PREFIXO_VALIDO.test(p)) {
      setPrevia(null);
      return;
    }
    setCarregandoPrevia(true);
    const t = setTimeout(async () => {
      try {
        setPrevia(await chamar(`/api/categorias/previa?prefixo=${encodeURIComponent(p)}`, "GET"));
      } catch {
        setPrevia(null);
      } finally {
        setCarregandoPrevia(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [prefixo]);

  function usarPrefixo(p: string, sugestao?: string) {
    setPrefixo(p);
    if (sugestao) setCategoria(sugestao);
    setMsg(null);
    document.getElementById("nova-regra")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function salvarRegra() {
    const p = limparPrefixo(prefixo);
    if (!PREFIXO_VALIDO.test(p)) return setMsg({ ok: false, texto: "Digite o começo do modelo (ex.: WF, RF28, SM-X)." });
    if (!categoria) return setMsg({ ok: false, texto: "Escolha a categoria." });
    setSalvando(true);
    setMsg(null);
    try {
      const r = await chamar("/api/categorias/regras", "POST", { prefixo: p, categoria });
      setMsg({
        ok: true,
        texto: `Regra salva: modelos que começam com "${p}" = ${categoria}. ${fmt(r.reclassificadas)} OS da base foram reclassificadas.`,
      });
      setPrefixo("");
      setCategoria("");
      setPrevia(null);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  // ---- excluir regra ----
  const [excluir, setExcluir] = useState<RegraCategoria | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  async function confirmarExcluir() {
    if (!excluir) return;
    setExcluindo(true);
    setErroExcluir(null);
    try {
      const r = await chamar(`/api/categorias/regras?id=${excluir.id}`, "DELETE");
      setMsg({ ok: true, texto: `Regra "${excluir.prefixo}" excluída. ${fmt(r.reclassificadas)} OS voltaram para a categoria da planilha / aprendida.` });
      setExcluir(null);
      router.refresh();
    } catch (e) {
      setErroExcluir((e as Error).message);
    } finally {
      setExcluindo(false);
    }
  }

  // ---- categorias ----
  const [novaSigla, setNovaSigla] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [msgCat, setMsgCat] = useState<{ ok: boolean; texto: string } | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [ocupadoCat, setOcupadoCat] = useState(false);

  async function criarCategoria() {
    const sigla = novaSigla.trim().toUpperCase();
    if (!SIGLA_VALIDA.test(sigla)) return setMsgCat({ ok: false, texto: "Sigla com 2 a 6 letras/números (ex.: TAB)." });
    if (!novoNome.trim()) return setMsgCat({ ok: false, texto: "Informe o nome." });
    setOcupadoCat(true);
    try {
      await chamar("/api/categorias", "POST", { sigla, nome: novoNome });
      setMsgCat({ ok: true, texto: `Categoria ${sigla} criada. Agora crie as regras dos modelos dela.` });
      setNovaSigla("");
      setNovoNome("");
      router.refresh();
    } catch (e) {
      setMsgCat({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupadoCat(false);
    }
  }
  async function renomear(sigla: string) {
    setOcupadoCat(true);
    try {
      await chamar("/api/categorias", "PUT", { sigla, nome: nomeEditado });
      setEditando(null);
      router.refresh();
    } catch (e) {
      setMsgCat({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupadoCat(false);
    }
  }
  async function excluirCategoria(sigla: string) {
    setOcupadoCat(true);
    try {
      await chamar(`/api/categorias?sigla=${sigla}`, "DELETE");
      setMsgCat({ ok: true, texto: `Categoria ${sigla} excluída.` });
      router.refresh();
    } catch (e) {
      setMsgCat({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupadoCat(false);
    }
  }

  // ---- filtros de listas ----
  const [filtroRegra, setFiltroRegra] = useState("");
  const regrasFiltradas = regras.filter(
    (r) => !filtroRegra || r.prefixo.includes(filtroRegra.toUpperCase()) || r.categoria.includes(filtroRegra.toUpperCase()),
  );

  const totalOs = categorias.reduce((s, c) => s + c.os, 0);
  const out = categorias.find((c) => c.sigla === "OUT");
  const osOutComModelo = Math.max(0, (out?.os ?? 0) - osSemModelo);
  const pctOut = totalOs ? (100 * osOutComModelo) / totalOs : 0;
  const pOk = limparPrefixo(prefixo);

  return (
    <div className="space-y-6">
      {/* resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Categorias", fmt(categorias.length), ""],
          ["Regras cadastradas", fmt(regras.length), ""],
          ["Modelos em Outros", fmt(semCategoria.reduce((s, m) => s + m.modelos, 0)), ""],
          ["OS em Outros", `${fmt(osOutComModelo)} (${pctOut.toFixed(1).replace(".", ",")}%)`, osSemModelo ? `+ ${fmt(osSemModelo)} OS sem modelo (UNKNOWN), que não entram na Triagem` : ""],
        ].map(([rot, val, obs]) => (
          <div key={rot} className="rounded-xl border p-4" style={cartao}>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              {rot}
            </p>
            <p className="text-2xl font-semibold mt-1" style={{ color: "var(--ink)" }}>
              {val}
            </p>
            {obs && (
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                {obs}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-4 text-xs leading-relaxed" style={{ ...cartao, color: "var(--muted)" }}>
        <strong style={{ color: "var(--ink)" }}>Como o sistema decide a categoria de cada modelo:</strong> 1º a regra
        cadastrada aqui (a mais específica vence: &quot;RF28&quot; ganha de &quot;RF&quot;) · 2º a coluna BH da planilha GSPN ·
        3º o que ele já aprendeu com outras OS do mesmo modelo, da mesma família ou do mesmo começo de modelo (ex.: tudo
        que começa com UN é TV) · senão fica em <strong>Outros</strong>. A cada base
        importada ele aprende de novo e tira modelos de Outros sozinho.
      </div>

      {/* nova regra */}
      {podeEditar && (
        <div id="nova-regra" className="rounded-xl border p-5 scroll-mt-20" style={cartao}>
          <h2 className="font-semibold mb-1 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Wand2 size={17} style={{ color: "var(--accent2)" }} /> Nova regra: modelos que começam com...
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Ex.: <code>WF</code> e <code>WD</code> = Lava e Seca · <code>RF</code>, <code>RT</code>, <code>RS</code> = Refrigeradores ·{" "}
            <code>AR</code> = Ar Condicionado · <code>SM-R</code> = relógios/fones · também serve o modelo inteiro.
          </p>
          <div className="grid sm:grid-cols-[200px_1fr_auto] gap-3 items-end">
            <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              Começo do modelo
              <input
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value.toUpperCase())}
                placeholder="Ex: WF45"
                maxLength={30}
                className={`mt-1.5 font-mono ${campoClasse}`}
              />
            </label>
            <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              Categoria
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`mt-1.5 ${campoClasse}`}>
                <option value="">Escolha...</option>
                {escolhiveis.map((c) => (
                  <option key={c.sigla} value={c.sigla}>
                    {c.sigla} — {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={salvarRegra} disabled={salvando || !pOk || !categoria} className={botaoPrincipal}>
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Salvar regra
            </button>
          </div>

          {/* prévia */}
          {pOk && (
            <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface2)" }}>
              {carregandoPrevia ? (
                <span className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
                  <Loader2 size={14} className="animate-spin" /> Procurando modelos que começam com &quot;{pOk}&quot;...
                </span>
              ) : previa ? (
                <>
                  <p style={{ color: "var(--ink)" }}>
                    <strong>{fmt(previa.modelos)}</strong> modelo(s) e <strong>{fmt(previa.os)}</strong> OS começam com{" "}
                    <code>{pOk}</code>.{" "}
                    {Object.keys(previa.porCategoria).length > 0 && (
                      <span style={{ color: "var(--muted)" }}>
                        Hoje estão em:{" "}
                        {Object.entries(previa.porCategoria)
                          .sort((a, b) => b[1] - a[1])
                          .map(([s, n]) => `${s} (${fmt(n)})`)
                          .join(" · ")}
                      </span>
                    )}
                  </p>
                  {previa.regra && (
                    <p className="text-xs mt-1 text-amber-500">
                      Já existe a regra &quot;{previa.regra.prefixo}&quot; = {previa.regra.categoria}.{" "}
                      {previa.regra.prefixo === pOk ? "Salvar vai trocar a categoria dela." : "A nova regra, mais específica, vai valer para estes modelos."}
                    </p>
                  )}
                  {previa.exemplos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {previa.exemplos.map((m) => (
                        <span
                          key={m.modelo + m.categoria}
                          className="rounded-md px-2 py-0.5 text-[11px] font-mono border"
                          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                          title={`${fmt(m.qtd_os)} OS`}
                        >
                          {m.modelo} <span style={{ color: m.categoria === "OUT" ? "#f59e0b" : "var(--muted)" }}>{m.categoria}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {previa.modelos === 0 && (
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      Nenhum modelo na base ainda — a regra vale para as próximas importações.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}

          {msg && (
            <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-500" : "text-red-400"}`}>{msg.texto}</p>
          )}
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-6 items-start">
        {/* modelos em outros */}
        <div className="rounded-xl border overflow-hidden" style={cartao}>
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-semibold" style={{ color: "var(--ink)" }}>
              Modelos ainda em &quot;Outros&quot;
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Agrupados pelo começo do modelo. {podeEditar && "Clique em “Usar” para criar a regra."}
            </p>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-4 py-2.5 font-medium">Começo</th>
                  <th className="px-4 py-2.5 font-medium">Modelos / OS</th>
                  <th className="px-4 py-2.5 font-medium">Exemplos</th>
                  {podeEditar && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {semCategoria.map((m) => (
                  <tr key={m.prefixo} className="border-t align-top" style={{ borderColor: "var(--line)" }}>
                    <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "var(--ink)" }}>
                      {m.prefixo}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {fmt(m.modelos)} / {fmt(m.os)}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>
                      <span className="font-mono">{(m.exemplos ?? []).join(", ")}</span>
                      {m.descricao_gspn && <span className="block mt-0.5 italic">GSPN: {m.descricao_gspn}</span>}
                    </td>
                    {podeEditar && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => usarPrefixo(m.prefixo)}
                          className="text-xs font-medium hover:underline"
                          style={{ color: "var(--accent2)" }}
                        >
                          Usar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {semCategoria.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-emerald-500">
                      Nenhum modelo em Outros. 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* regras */}
        <div className="rounded-xl border overflow-hidden" style={cartao}>
          <div className="px-5 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold" style={{ color: "var(--ink)" }}>
              Regras cadastradas
            </h2>
            <div className="relative w-44">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
              <input
                value={filtroRegra}
                onChange={(e) => setFiltroRegra(e.target.value)}
                placeholder="Filtrar..."
                className={`${campoClasse} !py-1.5 pl-8 text-xs`}
              />
            </div>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-4 py-2.5 font-medium">Começa com</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Por</th>
                  {podeEditar && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {regrasFiltradas.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "var(--ink)" }}>
                      {r.prefixo}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                      <strong style={{ color: "var(--ink)" }}>{r.categoria}</strong> · {nomeCat.get(r.categoria)}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>
                      {(r.criado_por && nomesUsuarios[r.criado_por]) || "—"}
                    </td>
                    {podeEditar && (
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => usarPrefixo(r.prefixo, r.categoria)}
                          className="p-1 hover:opacity-70"
                          style={{ color: "var(--muted)" }}
                          aria-label="Alterar"
                          title="Alterar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setErroExcluir(null);
                            setExcluir(r);
                          }}
                          className="p-1 ml-1 text-red-400 hover:opacity-70"
                          aria-label="Excluir"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {regrasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>
                      {regras.length ? "Nenhuma regra com esse filtro." : "Nenhuma regra ainda — a categoria vem da planilha GSPN."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* categorias */}
      <div className="rounded-xl border overflow-hidden" style={cartao}>
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Tags size={17} style={{ color: "var(--accent2)" }} /> Categorias
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">Sigla</th>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Modelos</th>
                <th className="px-4 py-2.5 font-medium">OS</th>
                <th className="px-4 py-2.5 font-medium">Reparadas</th>
                <th className="px-4 py-2.5 font-medium">Regras</th>
                {podeEditar && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.sigla} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: c.sigla === "OUT" ? "#f59e0b" : "var(--ink)" }}>
                    {c.sigla}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {editando === c.sigla ? (
                      <span className="flex items-center gap-2">
                        <input
                          value={nomeEditado}
                          onChange={(e) => setNomeEditado(e.target.value)}
                          className={`${campoClasse} !py-1.5`}
                          maxLength={60}
                          autoFocus
                        />
                        <button type="button" disabled={ocupadoCat} onClick={() => renomear(c.sigla)} className="text-emerald-500" aria-label="Salvar">
                          <Check size={16} />
                        </button>
                        <button type="button" onClick={() => setEditando(null)} style={{ color: "var(--muted)" }} aria-label="Cancelar">
                          <X size={16} />
                        </button>
                      </span>
                    ) : (
                      c.nome
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>{fmt(c.modelos)}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>{fmt(c.os)}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>{fmt(c.reparadas)}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>{fmt(c.regras)}</td>
                  {podeEditar && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {editando !== c.sigla && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditando(c.sigla);
                            setNomeEditado(c.nome);
                          }}
                          className="p-1 hover:opacity-70"
                          style={{ color: "var(--muted)" }}
                          aria-label="Renomear"
                          title="Renomear"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {c.sigla !== "OUT" && c.os === 0 && c.regras === 0 && (
                        <button
                          type="button"
                          disabled={ocupadoCat}
                          onClick={() => excluirCategoria(c.sigla)}
                          className="p-1 ml-1 text-red-400 hover:opacity-70"
                          aria-label="Excluir"
                          title="Excluir (sem OS e sem regra)"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {podeEditar && (
          <div className="border-t p-5" style={{ borderColor: "var(--line)" }}>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--ink)" }}>
              Nova categoria
            </p>
            <div className="grid sm:grid-cols-[140px_1fr_auto] gap-3">
              <input
                value={novaSigla}
                onChange={(e) => setNovaSigla(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="Ex: TAB"
                maxLength={6}
                className={`font-mono ${campoClasse}`}
              />
              <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome (ex: Tablets)" maxLength={60} className={campoClasse} />
              <button type="button" onClick={criarCategoria} disabled={ocupadoCat} className={botaoPrincipal}>
                <Plus size={16} /> Adicionar
              </button>
            </div>
            {msgCat && <p className={`mt-3 text-sm ${msgCat.ok ? "text-emerald-500" : "text-red-400"}`}>{msgCat.texto}</p>}
          </div>
        )}
      </div>

      {excluir && (
        <PopupConfirmar
          titulo="Excluir regra"
          mensagem={
            <>
              Excluir a regra <strong>&quot;{excluir.prefixo}&quot; = {excluir.categoria}</strong>? Os modelos voltam para a
              categoria da planilha GSPN (ou a aprendida).
            </>
          }
          rotuloConfirmar="Excluir"
          perigo
          carregando={excluindo}
          erro={erroExcluir}
          onConfirmar={confirmarExcluir}
          onFechar={() => setExcluir(null)}
        />
      )}
    </div>
  );
}
