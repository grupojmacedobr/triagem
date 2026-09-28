/**
 * Lê a planilha GSPN "por trás" (Web Worker), para a tela não travar
 * mesmo com arquivos grandes. Manda o progresso para a tela.
 */
import { linhaParaOS, mapearColunas, type RegistroOS } from "@/lib/gspnPlanilha";

type Entrada = { arquivo: File };

const ctx = self as unknown as {
  postMessage: (m: unknown) => void;
  onmessage: ((e: MessageEvent<Entrada>) => void) | null;
};

ctx.onmessage = async (e) => {
  try {
    ctx.postMessage({ tipo: "fase", fase: "abrindo" });
    const XLSX = await import("xlsx");
    const buffer = await e.data.arquivo.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true, dense: true });
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    if (linhas.length < 2) throw new Error("A planilha está vazia.");

    const mapa = mapearColunas(linhas[0]);
    const total = linhas.length - 1;
    const porOs = new Map<string, RegistroOS>();
    for (let i = 1; i < linhas.length; i++) {
      const r = linhaParaOS(linhas[i], mapa);
      if (r) porOs.set(r.os, r);
      if (i % 2000 === 0) ctx.postMessage({ tipo: "lendo", lidas: i, total });
    }
    const registros = Array.from(porOs.values());
    if (!registros.length) throw new Error("Não encontrei nenhuma OS (coluna SO Nro.) na planilha.");
    ctx.postMessage({ tipo: "pronto", registros, linhas: total, avisos: mapa.avisos });
  } catch (err) {
    ctx.postMessage({ tipo: "erro", mensagem: (err as Error).message || String(err) });
  }
};
