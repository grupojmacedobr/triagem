import { grupoPeca } from "@/lib/pecas";

/**
 * Regras da Base GSPN — as MESMAS usadas no teste de acerto (backtest).
 * Tradutor de peças reaproveitado do Samsung Contigo (lib/classificacao.js).
 */

/** Sem acento, minúsculo, só letras/números separados por 1 espaço. */
export function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Texto usado na busca: normalizado e SEM espaços ("BARULHOCESTO", "ÁGUARRR" continuam achando "barulho"/"agua"). */
export function textoBusca(texto: unknown): string {
  return normalizar(texto).replace(/ /g, "");
}

/** Agrupa variações de cor/região do mesmo aparelho. Ex: UN50CU7700GXZD -> UN50CU7700, SM-A155MZKDZTO -> SM-A155 */
export function familiaModelo(modelo: unknown): string {
  let m = String(modelo ?? "").toUpperCase().trim();
  if (!m || m.startsWith("UNKNOWN")) return "";
  const cel = m.match(/^(SM-[A-Z]\d{3})/);
  if (cel) return cel[1];
  m = m.split("/")[0];
  if (m.startsWith("NP") && m.includes("-")) return m.split("-")[0];
  return m.slice(0, 10);
}

export type SiglaCategoria = "DTV" | "HHP" | "WSM" | "REF" | "ACN" | "NPC" | "CKT" | "MON" | "OUT";

export const CATEGORIAS: { sigla: SiglaCategoria; nome: string }[] = [
  { sigla: "DTV", nome: "Televisores" },
  { sigla: "HHP", nome: "Celulares" },
  { sigla: "WSM", nome: "Lava e Seca" },
  { sigla: "REF", nome: "Refrigeradores" },
  { sigla: "ACN", nome: "Ar Condicionado" },
  { sigla: "NPC", nome: "Notebooks" },
  { sigla: "MON", nome: "Monitores" },
  { sigla: "CKT", nome: "Cooktop" },
  { sigla: "OUT", nome: "Outros" },
];

/** Coluna BH (Service Product Description) -> sigla. */
export function categoriaSigla(bh: unknown): SiglaCategoria {
  const d = String(bh ?? "").toUpperCase();
  if (d.includes("MONITOR")) return "MON";
  if (d.includes("TV") || d.includes("DISPLAY") || d.includes("LFD")) return "DTV";
  if (d.startsWith("HHP")) return "HHP";
  if (d.includes("WASHING") || d.includes("DRYER")) return "WSM";
  if (d.includes("REFRIGERATOR") || d.includes("WINE")) return "REF";
  if (d.includes("AIR CONDITIONER") || d.startsWith("SAC") || d.startsWith("RAM")) return "ACN";
  if (d.includes("NOTE PC") || d.includes("NOTEBOOK")) return "NPC";
  if (d.includes("COOKTOP")) return "CKT";
  return "OUT";
}

/** Descrição técnica da peça -> tipo geral (o nome traduzido fica em src/lib/pecas.ts). */
export function tipoPeca(descricao: unknown, categoria = ""): string {
  return grupoPeca(descricao, categoria);
}

/** c = código (part number), d = descrição do GSPN, t = tipo geral, q = quantidade, n = nome traduzido */
export type PecaOS = { c: string; d: string; t: string; q: number; n?: string };
