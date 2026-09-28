/**
 * Lê a planilha GSPN (exportação padrão Samsung) e transforma cada linha
 * numa OS pronta pra gravar. Acha as colunas pelo NOME do cabeçalho; se
 * não achar, usa a letra padrão (J = Modelo, AU = Descrição do defeito...).
 */
import { categoriaSigla, familiaModelo, textoBusca, tipoPeca, type PecaOS } from "@/lib/gspn";

export function normCabecalho(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function letraParaIndice(letra: string): number {
  let n = 0;
  for (const ch of letra) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const CAMPOS: Record<string, { nomes: string[]; letra: string; obrigatorio?: boolean }> = {
  os: { nomes: ["so nro."], letra: "B", obrigatorio: true },
  asc_code: { nomes: ["asc code"], letra: "D" },
  asc_nome: { nomes: ["asc name"], letra: "E" },
  modelo: { nomes: ["modelo"], letra: "J", obrigatorio: true },
  status: { nomes: ["status"], letra: "M", obrigatorio: true },
  data_solicitacao: { nomes: ["data de solicitacao"], letra: "Q" },
  reparo_finalizado: { nomes: ["reparo finalizado"], letra: "AB" },
  garantia: { nomes: ["in out warranty flag"], letra: "AL" },
  tipo_defeito: { nomes: ["tipo de defeito"], letra: "AM" },
  reparacao: { nomes: ["descricao reparacao"], letra: "AT" },
  codigo_reparo: { nomes: ["codigo de reparo"], letra: "BB" },
  defeito: { nomes: ["descricao do defeito"], letra: "AU", obrigatorio: true },
  sintoma: { nomes: ["codigo de sintoma (iris)"], letra: "AY" },
  categoria_gspn: { nomes: ["service product description"], letra: "BH", obrigatorio: true },
};

// 10 peças: código / descrição / quantidade (letras padrão do layout GSPN)
const PECAS_LETRAS = [
  ["BJ", "BO", "BL"], ["BS", "BX", "BU"], ["CB", "CG", "CD"], ["CK", "CP", "CM"], ["CT", "CY", "CV"],
  ["DC", "DH", "DE"], ["DL", "DQ", "DN"], ["DU", "DZ", "DW"], ["ED", "EI", "EF"], ["EM", "ER", "EO"],
];

export type MapaColunas = { campos: Record<string, number>; pecas: { cod: number; desc: number; qtd: number }[]; avisos: string[] };

export function mapearColunas(cabecalho: unknown[]): MapaColunas {
  const h = cabecalho.map(normCabecalho);
  const avisos: string[] = [];
  const campos: Record<string, number> = {};
  for (const [campo, def] of Object.entries(CAMPOS)) {
    let i = def.nomes.map((n) => h.indexOf(n)).find((x) => x >= 0) ?? -1;
    if (i < 0) {
      i = letraParaIndice(def.letra);
      if (def.obrigatorio) avisos.push(`Coluna "${def.nomes[0]}" não encontrada pelo nome; usando a coluna ${def.letra}.`);
    }
    campos[campo] = i;
  }
  const pecas = PECAS_LETRAS.map(([c, d, q], k) => {
    const suf = String(k + 1).padStart(2, "0");
    const iC = h.indexOf("codigo da peca" + suf);
    const iD = h.indexOf("pecas description " + suf);
    const iQ = h.indexOf("quantidade" + suf);
    return {
      cod: iC >= 0 ? iC : letraParaIndice(c),
      desc: iD >= 0 ? iD : letraParaIndice(d),
      qtd: iQ >= 0 ? iQ : letraParaIndice(q),
    };
  });
  return { campos, pecas, avisos };
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/ /g, " ").trim();
  return s === "" ? null : s;
}

function data(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = texto(v);
  if (!s) return null;
  const m = s.match(/^(\d{2})[/.](\d{2})[/.](\d{4})/);
  if (m && m[3] !== "0000") return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

export type RegistroOS = {
  os: string;
  asc_code: string | null;
  asc_nome: string | null;
  modelo: string | null;
  familia: string;
  categoria_gspn: string | null;
  categoria: string;
  status: string | null;
  entregue: boolean;
  data_solicitacao: string | null;
  reparo_finalizado: string | null;
  garantia: string | null;
  tipo_defeito: string | null;
  sintoma: string | null;
  defeito: string | null;
  defeito_busca: string;
  reparacao: string | null;
  codigo_reparo: string | null;
  reparado: boolean;
  pecas: PecaOS[];
  qtd_pecas: number;
};

export function linhaParaOS(linha: unknown[], mapa: MapaColunas): RegistroOS | null {
  const v = (campo: string) => linha[mapa.campos[campo]];
  const osBruto = texto(v("os"));
  if (!osBruto) return null;
  const os = osBruto.replace(/\.0+$/, "");
  const modelo = texto(v("modelo"))?.toUpperCase() ?? null;
  const status = texto(v("status"));
  const defeito = texto(v("defeito"));
  const bh = texto(v("categoria_gspn"));

  const pecas: PecaOS[] = [];
  for (const p of mapa.pecas) {
    const c = texto(linha[p.cod])?.toUpperCase();
    if (!c) continue;
    const d = texto(linha[p.desc]) ?? "";
    const q = Number(linha[p.qtd]) || 1;
    pecas.push({ c, d, t: tipoPeca(d), q });
  }

  const entregue = (status || "").toLowerCase() === "produto entregue";
  const codigoReparo = texto(v("codigo_reparo"))?.toUpperCase() ?? null;

  return {
    os,
    asc_code: texto(v("asc_code"))?.replace(/\.0+$/, "") ?? null,
    asc_nome: texto(v("asc_nome")),
    modelo,
    familia: familiaModelo(modelo),
    categoria_gspn: bh,
    categoria: categoriaSigla(bh),
    status,
    entregue,
    data_solicitacao: data(v("data_solicitacao")),
    reparo_finalizado: data(v("reparo_finalizado")),
    garantia: texto(v("garantia")),
    tipo_defeito: texto(v("tipo_defeito")),
    sintoma: texto(v("sintoma")),
    defeito,
    defeito_busca: textoBusca(defeito),
    reparacao: texto(v("reparacao")),
    codigo_reparo: codigoReparo,
    // "Produto Entregue" também inclui aparelho devolvido SEM conserto (recusa de
    // orçamento, falta de retorno). Reparado = teve peça OU código de reparo A..
    reparado: entregue && (pecas.length > 0 || /^A/.test(codigoReparo || "")),
    pecas,
    qtd_pecas: pecas.length,
  };
}
