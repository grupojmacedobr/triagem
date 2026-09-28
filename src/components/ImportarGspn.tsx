"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { linhaParaOS, mapearColunas, type RegistroOS } from "@/lib/gspnPlanilha";

const TAMANHO_LOTE = 500;
const ENVIOS_SIMULTANEOS = 3;

type Etapa =
  | { tipo: "parado" }
  | { tipo: "lendo" }
  | { tipo: "enviando"; enviados: number; total: number }
  | { tipo: "ok"; linhas: number; entregues: number; comPeca: number; porCategoria: [string, number][]; segundos: number }
  | { tipo: "erro"; mensagem: string };

async function chamar(corpo: unknown) {
  const res = await fetch("/api/gspn/importar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Falha no servidor (${res.status}).`);
  return data;
}

export default function ImportarGspn() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "parado" });
  const ocupado = etapa.tipo === "lendo" || etapa.tipo === "enviando";

  async function importar() {
    if (!arquivo) return;
    const inicio = Date.now();
    setEtapa({ tipo: "lendo" });
    await new Promise((r) => setTimeout(r, 50)); // deixa a tela mostrar "lendo"

    let registros: RegistroOS[] = [];
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true, dense: true });
      const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
      if (linhas.length < 2) throw new Error("A planilha está vazia.");
      const mapa = mapearColunas(linhas[0]);
      const porOs = new Map<string, RegistroOS>();
      for (const l of linhas.slice(1)) {
        const r = linhaParaOS(l, mapa);
        if (r) porOs.set(r.os, r);
      }
      registros = Array.from(porOs.values());
      if (!registros.length) throw new Error("Não encontrei nenhuma OS (coluna SO Nro.) na planilha.");
    } catch (e) {
      setEtapa({ tipo: "erro", mensagem: `Não consegui ler a planilha: ${(e as Error).message}` });
      return;
    }

    let importacaoId = "";
    try {
      importacaoId = (await chamar({ acao: "iniciar", arquivo: arquivo.name })).importacao_id;
      const lotes: RegistroOS[][] = [];
      for (let i = 0; i < registros.length; i += TAMANHO_LOTE) lotes.push(registros.slice(i, i + TAMANHO_LOTE));

      let enviados = 0;
      setEtapa({ tipo: "enviando", enviados: 0, total: registros.length });
      let proximo = 0;
      async function trabalhador() {
        while (proximo < lotes.length) {
          const lote = lotes[proximo++];
          let tentativa = 0;
          for (;;) {
            try {
              await chamar({ acao: "lote", importacao_id: importacaoId, registros: lote });
              break;
            } catch (e) {
              if (++tentativa >= 3) throw e;
              await new Promise((r) => setTimeout(r, 1500 * tentativa));
            }
          }
          enviados += lote.length;
          setEtapa({ tipo: "enviando", enviados, total: registros.length });
        }
      }
      await Promise.all(Array.from({ length: ENVIOS_SIMULTANEOS }, trabalhador));

      const entregues = registros.filter((r) => r.entregue).length;
      await chamar({ acao: "concluir", importacao_id: importacaoId, linhas: registros.length, entregues });

      const cont = new Map<string, number>();
      for (const r of registros) if (r.reparado) cont.set(r.categoria, (cont.get(r.categoria) || 0) + 1);
      setEtapa({
        tipo: "ok",
        linhas: registros.length,
        entregues,
        comPeca: registros.filter((r) => r.reparado).length,
        porCategoria: Array.from(cont.entries()).sort((a, b) => b[1] - a[1]),
        segundos: Math.round((Date.now() - inicio) / 1000),
      });
      setArquivo(null);
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      if (importacaoId) chamar({ acao: "erro", importacao_id: importacaoId }).catch(() => {});
      setEtapa({ tipo: "erro", mensagem: (e as Error).message });
    }
  }

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <h2 className="font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Importar planilha GSPN
      </h2>
      <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
        Use a exportação padrão do GSPN (.xlsx). OS que já existem são atualizadas (pela coluna SO Nro.), as novas são
        adicionadas. Pode subir uma loja por vez.
      </p>

      <label
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          ocupado ? "opacity-60 cursor-wait" : "cursor-pointer hover:border-[var(--accent2)]"
        }`}
        style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
      >
        <FileSpreadsheet size={30} style={{ color: "var(--accent2)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {arquivo ? arquivo.name : "Clique para escolher a planilha"}
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {arquivo ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB` : "Arquivos grandes (30 MB+) levam cerca de 1 minuto"}
        </span>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={ocupado}
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null);
            setEtapa({ tipo: "parado" });
          }}
        />
      </label>

      <button
        type="button"
        onClick={importar}
        disabled={!arquivo || ocupado}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 transition"
        style={{ boxShadow: "0 0 30px var(--accent-glow)" }}
      >
        {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {ocupado ? "Importando..." : "Importar"}
      </button>

      {etapa.tipo === "lendo" && (
        <p className="mt-4 text-sm flex items-center gap-2" style={{ color: "var(--muted)" }}>
          <Loader2 size={15} className="animate-spin" /> Lendo a planilha... (a tela pode ficar parada alguns segundos, é normal)
        </p>
      )}

      {etapa.tipo === "enviando" && (
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--muted)" }}>
            <span>Enviando para o banco...</span>
            <span>
              {etapa.enviados.toLocaleString("pt-BR")} de {etapa.total.toLocaleString("pt-BR")} OS
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(100 * etapa.enviados) / etapa.total}%`, background: "var(--accent)" }}
            />
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
            Não feche esta página até terminar.
          </p>
        </div>
      )}

      {etapa.tipo === "ok" && (
        <div className="mt-4 rounded-lg border px-4 py-3" style={{ borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.08)" }}>
          <p className="text-sm font-medium flex items-center gap-2 text-emerald-500">
            <CheckCircle2 size={16} /> Importação concluída em {etapa.segundos}s
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--ink)" }}>
            {etapa.linhas.toLocaleString("pt-BR")} OS lidas · {etapa.entregues.toLocaleString("pt-BR")} com Produto Entregue ·{" "}
            {etapa.comPeca.toLocaleString("pt-BR")} reparadas (usadas na Triagem)
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {etapa.porCategoria.map(([c, n]) => `${c}: ${n.toLocaleString("pt-BR")}`).join(" · ")}
          </p>
        </div>
      )}

      {etapa.tipo === "erro" && (
        <p className="mt-4 text-sm flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <XCircle size={16} className="shrink-0 mt-0.5" /> {etapa.mensagem}
        </p>
      )}
    </div>
  );
}
