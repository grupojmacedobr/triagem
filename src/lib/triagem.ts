/**
 * Lógica da Triagem — cópia fiel do protótipo validado no teste de acerto
 * (400 OS reais: peça certa no top 3 em 68%, tipo de peça no top 3 em 82%).
 *
 * Passo a passo:
 * 1. Quebra o defeito digitado em "termos": frases conhecidas viram
 *    CONCEITOS (com sinônimos) e o resto vira palavras soltas.
 * 2. O banco devolve as OS ENTREGUES que têm pelo menos um termo.
 * 3. Cada OS ganha uma nota: palavra rara vale mais que palavra comum.
 *    Entram as OS com nota >= 60% da melhor.
 * 4. Tipo de peça: conta no nível mais estreito com volume (modelo >
 *    família > categoria). Código da peça: vem do modelo/família.
 */
import { familiaModelo, normalizar, type PecaOS } from "@/lib/gspn";
import { GRUPOS_CONSUMO, traduzirPeca } from "@/lib/pecas";

// ---------- dicionário de sinônimos (editável) ----------
export const CONCEITOS: string[][] = [
  ["sem imagem", "tela preta", "sem video", "nao aparece imagem", "sem tela", "nao da imagem"],
  ["imagem escura", "imagem muito escura", "tela escura", "escura", "escurecida", "pouco brilho", "brilho baixo", "imagem fraca"],
  ["nao liga", "nao acende", "nao ligando", "morto", "morta", "sem energia", "nao da sinal de vida"],
  ["liga e desliga", "liga desliga", "ligando e desligando", "reinicia", "reiniciando", "desliga sozinh", "reboot"],
  ["linha", "linhas", "listra", "faixa", "risco"],
  ["mancha", "sombra", "manchas", "vazamento de luz", "clarao"],
  ["sem som", "sem audio", "nao sai som", "audio baixo", "som baixo"],
  ["quebrad", "trincad", "rachad", "estourad", "tela quebrada", "display quebrado"],
  ["barulho", "ruido", "trepidac", "trepida", "vibrac", "vibra", "zumbido", "estalo"],
  ["vazamento de agua", "vazando agua", "vaza agua", "vazamento agua", "goteja", "pingando", "escorrendo agua"],
  ["vazamento de gas", "vazamento gas", "sem gas", "falta de gas", "fluido"],
  ["nao refrigera", "nao gela", "nao esfria", "nao resfria", "nao congela", "pouca refrigeracao", "nao mantem temperatura", "refrigera pouco", "nao esta gelando"],
  ["nao centrifuga", "centrifug"],
  ["nao carrega", "nao esta carregando", "carregamento", "nao recebe carga"],
  ["umidade", "oxidac", "oxidad", "molhou", "liquido", "caiu na agua"],
  ["nao aquece", "nao esquenta", "nao seca", "nao secando"],
  ["nao drena", "nao escoa", "nao sai agua", "agua parada", "dreno", "drenag"],
  ["nao entra agua", "nao enche", "nao puxa agua"],
  ["porta", "trava", "fechadura", "nao trava"],
  ["wifi", "wi fi", "rede", "internet", "bluetooth", "conexao"],
  ["controle remoto", "controle"],
  ["touch", "toque", "touchscreen"],
  ["camera", "cameras"],
  ["bateria", "estufad", "inchad"],
  ["travando", "travado", "trava", "congela a tela", "lento", "lentidao"],
  ["gelo", "icemaker", "ice maker", "dispenser"],
];

const STOP = new Set(
  "a o e de da do das dos em no na nos nas com para por pra que um uma os as ao aos se ja foi esta estava ta tem ter mas porem pois cliente produto aparelho equipamento unidade relata relatou informa informou diz disse ele ela mesmo mesma apos quando muito pouco vez vezes anexo anexada anexado valida nf nota fiscal rrr favor tv televisao celular maquina geladeira ar condicionado as vezes".split(" ")
);
const KEEP = new Set(["nao", "sem"]);

const MAPA_CONCEITO = new Map<string, number>();
CONCEITOS.forEach((c, i) => c.forEach((v) => { if (!MAPA_CONCEITO.has(v)) MAPA_CONCEITO.set(v, i); }));
const VARIANTES_POR_TAMANHO = Array.from(MAPA_CONCEITO.keys()).sort((a, b) => b.length - a.length);

/** Tira plural e terminações comuns (centrifugando -> centrifug). */
export function raiz(t: string): string {
  for (const suf of ["mente", "coes", "cao", "oes", "ando", "endo", "indo", "ado", "ido", "ada", "ida", "ar", "er", "ir", "es", "s"]) {
    if (t.length > 5 && t.endsWith(suf)) return t.slice(0, -suf.length);
  }
  return t;
}

/** "codigo" = código de erro do aparelho (ex.: "erro DC", "erro 5C", "C101") — obrigatório na busca */
export type Termo = { tipo: "conceito" | "palavra" | "funciona" | "codigo"; rotulo: string; variantes: string[] };

/** Variantes de um código de erro: 5C = 5E, dC = dE, HC = HE (Samsung usa as duas formas). */
function variantesCodigo(cod: string): string[] {
  const v = new Set<string>(["erro" + cod, "error" + cod, "codigo" + cod]);
  const alt = /c$/.test(cod) ? cod.replace(/c$/, "e") : /e$/.test(cod) ? cod.replace(/e$/, "c") : "";
  if (alt) ["erro", "error", "codigo"].forEach((p) => v.add(p + alt));
  if (cod.length >= 3) { v.add(cod); if (alt) v.add(alt); }
  return Array.from(v);
}

export const MAX_TERMOS = 30;

export function extrairTermos(defeito: string): Termo[] {
  let t = " " + normalizar(defeito) + " ";
  const termos: Termo[] = [];
  // "tem som", "mas tem imagem", "liga normal": isso FUNCIONA — não é defeito, não entra na busca
  const funciona: string[] = [];
  t = t.replace(/ tem ([a-z0-9]+)/g, (_, w: string) => { if (w !== "defeito" && w !== "problema") funciona.push(w); return " "; });
  // "com som", "apenas com imagem"... também é o que FUNCIONA (mas "com oxidacao" continua sendo defeito)
  t = t.replace(/ (?:apenas |mas |so )?com (som|audio|imagem|video|energia|sinal|wifi|internet)(?= )/g, (_, w: string) => { funciona.push(w); return " "; });
  // códigos de erro: "erro dc", "erro 5c", "codigo c101", "e1" ...
  const codigos: Termo[] = [];
  t = t.replace(/ (?:erro|error|codigo|cod|falha) (?:de |do |no )?([a-z]{0,2}\d{0,3}[a-z]{0,2})(?= )/g, (m, cod: string) => {
    // código = tem número (5c, c101, e1) ou são 2 letras (dc, ue, hc, le)
    if (!cod || cod.length > 5 || STOP.has(cod) || !(/\d/.test(cod) || /^[a-z]{2}$/.test(cod))) return m;
    codigos.push({ tipo: "codigo", rotulo: "erro " + cod.toUpperCase(), variantes: variantesCodigo(cod) });
    return " ";
  });
  const usados = new Set<number>();
  for (const v of VARIANTES_POR_TAMANHO) {
    if (t.includes(" " + v)) {
      const ci = MAPA_CONCEITO.get(v)!;
      if (!usados.has(ci)) {
        usados.add(ci);
        termos.push({ tipo: "conceito", rotulo: v, variantes: CONCEITOS[ci] });
      }
      t = t.split(v).join(" ");
    }
  }
  for (const w of t.split(" ")) {
    if (!w || STOP.has(w) || KEEP.has(w) || w.length < 3) continue;
    termos.push({ tipo: "palavra", rotulo: w, variantes: [raiz(w)] });
  }
  return [...codigos, ...termos].slice(0, MAX_TERMOS).concat(funciona.map((w): Termo => ({ tipo: "funciona", rotulo: w, variantes: [] })));
}

/** Só os termos que vão pra busca (tira os "funciona"). */
export function termosDeBusca(termos: Termo[]): Termo[] {
  return termos.filter((t) => t.tipo !== "funciona");
}

/** Formato enviado ao banco: variantes sem espaço, separadas por "|". */
export function gruposParaBanco(termos: Termo[]): string[] {
  return termosDeBusca(termos).map((t) => Array.from(new Set(t.variantes.map((v) => v.replace(/ /g, "")))).join("|"));
}

// ---------- análise ----------
/**
 * Como a Triagem decide (resumo para quem for manter):
 *  1. Acha as OS reparadas cujo DEFEITO (texto) bate com o que foi digitado (com sinônimos).
 *  2. Descobre o DEFEITO PADRÃO (código IRIS, coluna AY) mais comum dessas OS na categoria.
 *     Ex.: "sem imagem" em TV -> AE1. Assim conta TODAS as OS do modelo com AE1, mesmo
 *     que o texto tenha sido escrito de outro jeito.
 *  3. Usa o nível mais específico com amostra confiável: modelo > família > série
 *     (série = mesmo modelo em outras polegadas/capacidades) > categoria.
 *  4. Mede as peças / conjuntos de peças usados nessas OS e a confiança da amostra.
 */
type Caso = { os: string; nivel: number; mascara: number; pecas: PecaOS[]; sintoma: string; viaIris?: boolean };

export type RespostaBanco = {
  totais: { n_modelo: number; n_familia: number; n_serie: number; n_categoria: number };
  casos: [string, number, number, string[], string][];
  historico: [number, string[], string, string][];
  pecas_info: Record<string, string>;
  perfil: [string, number][];
};

export type NivelBusca = "modelo" | "familia" | "serie" | "categoria";
const NIVEL_MIN: Record<NivelBusca, number> = { modelo: 3, familia: 2, serie: 1, categoria: 0 };
const NIVEIS: NivelBusca[] = ["modelo", "familia", "serie", "categoria"];

export type Confianca = "alta" | "media" | "baixa";
export function confiancaDe(n: number): Confianca {
  return n >= 50 ? "alta" : n >= 20 ? "media" : "baixa";
}

export type PecaSugerida = {
  codigo: string;
  descricao: string; // descrição original do GSPN (aparece ao passar o mouse)
  nome: string; // nome traduzido
  tipo: string;
  osComPeca: number; // OS parecidas que usaram essa peça
  percentual: number; // % das OS parecidas
  baseOs: number; // total de OS parecidas usadas no cálculo
  origem: "defeito-modelo" | "defeito-familia" | "tipo-provavel";
  usoHistorico: number; // OS do modelo/família (qualquer defeito) que usaram essa peça
  ids: string[]; // OS que usaram (para abrir ao clicar)
};

export type PecaKit = { codigo: string; descricao: string; nome: string; tipo: string };

export type KitPecas = {
  /** peças do conjunto (vazio = reparo sem troca de peça); por tipo quando não há código do modelo */
  pecas: PecaKit[];
  /** itens pequenos que costumam ir junto (fita, parafuso, etiqueta) */
  acompanham: PecaKit[];
  os: number;
  percentual: number;
  exemplos: string[];
  ids: string[];
  porTipo: boolean;
};

export type GuiaPeca = { o_que_e?: string | null; por_que?: string | null; como_confirmar?: string | null };

export type ResultadoTriagem = {
  termos: { tipo: Termo["tipo"]; rotulo: string; variantes: string[] }[];
  familia: string;
  serie: string;
  totais: RespostaBanco["totais"];
  casadosPorNivel: Record<NivelBusca, number>;
  /** defeito padrão (IRIS) identificado a partir do texto */
  defeito: { codigos: { codigo: string; nome?: string; guia?: string | null; percentual: number }[]; base: number };
  /** OS do modelo por defeito padrão (o que mais quebra neste modelo) */
  perfil: { codigo: string; nome?: string; os: number; percentual: number; destacado: boolean }[];
  perfilTotal: number;
  /** nível usado nas sugestões e confiança da amostra */
  nivelBase: NivelBusca | null;
  baseOs: number;
  viaTexto: number; // OS que bateram pelo texto
  viaIris: number; // OS incluídas pelo código IRIS
  confianca: Confianca;
  /** quando a amostra do modelo é pequena: o que a série inteira (outras polegadas) mostra, por tipo de peça */
  apoio: { nivel: NivelBusca; base: number; kits: KitPecas[] } | null;
  nivelTipo: NivelBusca;
  baseTipo: number;
  semPeca: number;
  tipos: { tipo: string; os: number; percentual: number }[];
  pecas: PecaSugerida[];
  combinacoes: { codigos: [string, string]; nomes: [string, string]; descricoes: [string, string]; os: number; percentual: number; ids: string[] }[];
  /** soluções com MAIS DE UMA peça (OS que usaram todas essas peças juntas) */
  conjuntos: { pecas: PecaKit[]; os: number; percentual: number; baseOs: number; ids: string[] }[];
  /** evidência na categoria: % das OS com o mesmo defeito que usaram cada tipo de peça */
  evidencia: { base: number; porGrupo: Record<string, number> };
  /** explicações do guia do triador por tipo de peça (preenchido no servidor) */
  guia?: Record<string, GuiaPeca>;
  garantias?: string[];
  kits: KitPecas[];
  kitNivel: NivelBusca | null;
  kitBase: number;
  exemplos: { os: string; modelo?: string; defeito?: string; reparacao?: string; garantia?: string; pecas: PecaOS[]; nivel: NivelBusca }[];
};

/** Itens de consumo que não mudam o "conserto" (não entram na chave do conjunto). */
const TIPOS_CONSUMO = GRUPOS_CONSUMO;
const MIN_KIT = 3;
const MIN_CONFIAVEL = 20;
const MAX_IDS = 400;

function montarKits(casos: Caso[], porTipo: boolean, limite = 5): KitPecas[] {
  const grupos = new Map<string, { pecas: PecaKit[]; os: string[]; consumo: Map<string, { p: PecaOS; n: number }> }>();
  for (const c of casos) {
    const principais = c.pecas.filter((p) => !TIPOS_CONSUMO.has(p.t));
    const itens = new Map<string, PecaKit>();
    for (const p of principais) {
      const k = porTipo ? p.t : p.c;
      if (!itens.has(k)) itens.set(k, { codigo: porTipo ? "" : p.c, descricao: porTipo ? "" : p.d, nome: porTipo ? p.t : p.n || p.t, tipo: p.t });
    }
    const chave = Array.from(itens.keys()).sort().join("|");
    let g = grupos.get(chave);
    if (!g) {
      g = { pecas: Array.from(itens.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v), os: [], consumo: new Map() };
      grupos.set(chave, g);
    }
    g.os.push(c.os);
    for (const p of c.pecas) {
      if (!TIPOS_CONSUMO.has(p.t)) continue;
      const k = porTipo ? p.t : p.c;
      const atual = g.consumo.get(k) ?? { p, n: 0 };
      atual.n++;
      g.consumo.set(k, atual);
    }
  }
  return Array.from(grupos.values())
    .filter((g) => g.os.length >= 2 || grupos.size === 1)
    .sort((a, b) => b.os.length - a.os.length || b.pecas.length - a.pecas.length)
    .slice(0, limite)
    .map((g) => ({
      pecas: g.pecas,
      acompanham: Array.from(g.consumo.values())
        .filter((x) => x.n >= Math.max(1, g.os.length / 2))
        .map(({ p }) => ({ codigo: porTipo ? "" : p.c, descricao: porTipo ? "" : p.d, nome: porTipo ? p.t : p.n || p.t, tipo: p.t })),
      os: g.os.length,
      percentual: casos.length ? (100 * g.os.length) / casos.length : 0,
      exemplos: g.os.slice(0, 5),
      ids: g.os.slice(0, MAX_IDS),
      porTipo,
    }));
}

const MIN_CODIGO = 3;
const MIN_TIPO = 15;
const CORTE = 0.6;
/** mínimo de OS parecidas antes de afrouxar o corte */
const MIN_ALVO = 30;
/** código IRIS entra quando representa pelo menos esta fração das OS que bateram o texto */
const MIN_PARTE_IRIS = 0.1;

/**
 * Escolhe as OS mais parecidas pelo texto do defeito.
 * Nota de cada OS = soma do peso (IDF) das palavras do defeito que ela contém.
 * Ficam as OS com nota >= 60% da melhor. Se isso der POUCAS OS (palavra rara a mais,
 * ex.: "liga e desliga SOZINHA"), vai descendo para as próximas notas até juntar
 * pelo menos `minimo` OS — assim uma palavra rara não descarta os casos principais.
 */
function selecionar(casos: Caso[], n: number, qtdTermos: number, minimo = MIN_ALVO, obrigatorios = 0): Caso[] {
  if (!casos.length || !qtdTermos) return [];
  // código de erro digitado (ex.: "erro DC"): só OS com esse código, se houver pelo menos 3
  if (obrigatorios) {
    const com = casos.filter((c) => (c.mascara & obrigatorios) === obrigatorios);
    if (com.length >= MIN_KIT) casos = com;
  }
  const df = new Array(qtdTermos).fill(0);
  for (const c of casos) for (let i = 0; i < qtdTermos; i++) if (c.mascara & (1 << i)) df[i]++;
  const idf = df.map((d) => Math.log((n + 1) / (1 + d)) + 0.1);
  const nota = (c: Caso) => idf.reduce((s, v, i) => ((c.mascara & (1 << i)) ? s + v : s), 0);
  const notas = casos.map(nota);
  const max = Math.max(...notas);
  if (max <= 0) return [];
  let corte = CORTE * max;
  const niveis = Array.from(new Set(notas.filter((x) => x > 0 && x < corte))).sort((a, b) => b - a);
  let qtd = notas.filter((x) => x >= corte).length;
  for (const nv of niveis) {
    if (qtd >= minimo) break;
    corte = nv;
    qtd = notas.filter((x) => x >= corte).length;
  }
  return casos
    .map((c, i) => ({ c, n: notas[i] }))
    .filter((x) => x.n >= corte)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.c);
}

function nomeNivel(n: number): NivelBusca {
  return n >= 3 ? "modelo" : n === 2 ? "familia" : n === 1 ? "serie" : "categoria";
}

/** Série do modelo: UN50TU8000 -> UN**TU8000 (igual à função serie_modelo do banco). */
export function serieModelo(familia: string): string {
  return /^[A-Z]{2}\d{2}[A-Z]/.test(familia) ? familia.replace(/^([A-Z]{2})\d{2}/, "$1**") : familia;
}

export function analisar(
  resposta: RespostaBanco,
  todosTermos: Termo[],
  modelo: string,
  excluirOs?: string,
  categoria = "",
): ResultadoTriagem {
  const termos = termosDeBusca(todosTermos);
  const info = resposta.pecas_info || {};
  // peças: o banco manda só os códigos; a descrição vem do dicionário e é traduzida aqui
  const cacheP = new Map<string, PecaOS>();
  const peca = (c: string): PecaOS => {
    let p = cacheP.get(c);
    if (!p) {
      const d = info[c] || "";
      const t = traduzirPeca(d, categoria);
      p = { c, d, t: t.grupo, n: t.nome, q: 1 };
      cacheP.set(c, p);
    }
    return p;
  };
  const listaPecas = (cods: string[] | null) => Array.from(new Set(cods || [])).map(peca);

  const casos: Caso[] = resposta.casos
    .filter((c) => c[0] !== excluirOs)
    .map(([os, nivel, mascara, cods, sintoma]) => ({ os, nivel, mascara, pecas: listaPecas(cods), sintoma: sintoma || "" }));
  const historico: Caso[] = (resposta.historico || [])
    .filter((h) => h[2] !== excluirOs)
    .map(([nivel, cods, os, sintoma]) => ({ os, nivel, mascara: 0, pecas: listaPecas(cods), sintoma: sintoma || "", viaIris: true }));

  const totais = resposta.totais;
  const N: Record<NivelBusca, number> = {
    modelo: totais.n_modelo, familia: totais.n_familia, serie: totais.n_serie ?? totais.n_familia, categoria: totais.n_categoria,
  };

  // 1) OS que batem pelo texto, em cada nível
  const casados = {} as Record<NivelBusca, Caso[]>;
  const obrigatorios = termos.reduce((m, t, i) => (t.tipo === "codigo" ? m | (1 << i) : m), 0);
  for (const nv of NIVEIS) casados[nv] = selecionar(casos.filter((c) => c.nivel >= NIVEL_MIN[nv]), N[nv], termos.length, MIN_ALVO, obrigatorios);
  const viaTextoPorNivel = Object.fromEntries(NIVEIS.map((nv) => [nv, casados[nv].length])) as Record<NivelBusca, number>;

  // 2) defeito padrão (IRIS): códigos mais comuns entre as OS que bateram o texto
  //    (usa a categoria, que tem mais volume; se for pequena, o maior nível disponível)
  const refIris = [...NIVEIS].reverse().find((nv) => casados[nv].length >= MIN_CONFIAVEL) ?? "categoria";
  const contIris = new Map<string, number>();
  for (const c of casados[refIris]) if (c.sintoma) contIris.set(c.sintoma, (contIris.get(c.sintoma) || 0) + 1);
  const baseIris = casados[refIris].length;
  // códigos genéricos (XX = outros, HLB = "código de erro no display") não servem para juntar OS
  const GENERICO = /XX$|^HLB$/;
  const codigosIris = Array.from(contIris.entries())
    .filter(([cod, n]) => !GENERICO.test(cod) && n >= 3)
    .sort((a, b) => b[1] - a[1])
    .filter(([, n], i) => n / Math.max(1, baseIris) >= (i === 0 ? MIN_PARTE_IRIS * 3 : MIN_PARTE_IRIS * 2.5))
    .slice(0, 3);
  const setIris = new Set(codigosIris.map(([c]) => c));

  // 3) completa modelo / família / série com TODAS as OS do mesmo defeito padrão
  for (const nv of ["modelo", "familia", "serie"] as const) {
    if (!setIris.size) break;
    const ja = new Set(casados[nv].map((c) => c.os));
    for (const h of historico) {
      if (h.nivel >= NIVEL_MIN[nv] && setIris.has(h.sintoma) && !ja.has(h.os)) {
        casados[nv].push(h);
        ja.add(h.os);
      }
    }
  }

  // 4) nível base (o mais específico com amostra confiável)
  const comCodigo: NivelBusca[] = ["modelo", "familia"];
  // modelo com amostra confiável; senão a família (mesmo aparelho, outras cores/regiões) se tiver mais OS
  let nivelBase: NivelBusca | null =
    comCodigo.find((nv) => casados[nv].length >= MIN_CONFIAVEL) ??
    ([...comCodigo].sort((a, b) => casados[b].length - casados[a].length).find((nv) => casados[nv].length >= MIN_KIT) ?? null);
  const porTipoBase = !nivelBase;
  if (!nivelBase) nivelBase = (["serie", "categoria"] as const).find((nv) => casados[nv].length >= MIN_KIT) ?? null;
  const base = nivelBase ? casados[nivelBase] : [];
  const confianca = confiancaDe(base.length);

  // apoio da série quando a amostra do modelo/família é pequena (tipos de peça, outras polegadas)
  let apoio: ResultadoTriagem["apoio"] = null;
  if (nivelBase && !porTipoBase && base.length < MIN_CONFIAVEL) {
    for (const nv of ["serie", "categoria"] as const) {
      if (casados[nv].length >= MIN_CONFIAVEL) {
        apoio = { nivel: nv, base: casados[nv].length, kits: montarKits(casados[nv], true, 4) };
        break;
      }
    }
  }

  // 5) tipos de peça (nível mais estreito com volume)
  const nivelTipo =
    NIVEIS.find((nv) => casados[nv].length >= MIN_TIPO) ??
    NIVEIS.reduce((m, nv) => (casados[nv].length > casados[m].length ? nv : m), "modelo" as NivelBusca);
  const selTipo = casados[nivelTipo];
  const contTipo = new Map<string, number>();
  let semPeca = 0;
  for (const c of selTipo) {
    if (!c.pecas.length) semPeca++;
    for (const t of new Set(c.pecas.map((p) => p.t))) contTipo.set(t, (contTipo.get(t) || 0) + 1);
  }
  const tipos = Array.from(contTipo.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, os]) => ({ tipo, os, percentual: selTipo.length ? (100 * os) / selTipo.length : 0 }));

  // uso histórico de cada código (modelo + família, qualquer defeito)
  const hist: Record<"modelo" | "familia", PecaOS[][]> = { modelo: [], familia: [] };
  for (const h of historico) {
    if (h.nivel >= 3) hist.modelo.push(h.pecas);
    if (h.nivel >= 2) hist.familia.push(h.pecas);
  }
  const usoHist = new Map<string, number>();
  for (const pecas of hist.familia) for (const c of pecas) usoHist.set(c.c, (usoHist.get(c.c) || 0) + 1);

  // 6) peças (códigos) no nível base
  const pecas: PecaSugerida[] = [];
  const vistos = new Set<string>();
  if (nivelBase && !porTipoBase) {
    const idsPorCod = new Map<string, string[]>();
    for (const c of base) for (const p of c.pecas) {
      const l = idsPorCod.get(p.c) ?? [];
      l.push(c.os);
      idsPorCod.set(p.c, l);
    }
    for (const [cod, ids] of Array.from(idsPorCod.entries()).sort((a, b) => b[1].length - a[1].length)) {
      const p = peca(cod);
      pecas.push({
        codigo: cod, descricao: p.d, nome: p.n || p.t, tipo: p.t, osComPeca: ids.length, percentual: (100 * ids.length) / base.length,
        baseOs: base.length, origem: nivelBase === "modelo" ? "defeito-modelo" : "defeito-familia",
        usoHistorico: usoHist.get(cod) || 0, ids: ids.slice(0, MAX_IDS),
      });
      vistos.add(cod);
    }
  }
  // completa com o código mais usado do modelo/família para cada tipo provável
  for (const { tipo, os } of tipos.slice(0, 6)) {
    for (const nv of ["modelo", "familia"] as const) {
      const cont = new Map<string, number>();
      for (const lista of hist[nv]) for (const p of lista) if (p.t === tipo) cont.set(p.c, (cont.get(p.c) || 0) + 1);
      if (cont.size) {
        const cod = Array.from(cont.entries()).sort((a, b) => b[1] - a[1])[0][0];
        if (!vistos.has(cod)) {
          const p = peca(cod);
          pecas.push({
            codigo: cod, descricao: p.d, nome: p.n || tipo, tipo, osComPeca: os, percentual: selTipo.length ? (100 * os) / selTipo.length : 0,
            baseOs: selTipo.length, origem: "tipo-provavel", usoHistorico: usoHist.get(cod) || 0,
            ids: selTipo.filter((c) => c.pecas.some((x) => x.t === tipo)).map((c) => c.os).slice(0, MAX_IDS),
          });
          vistos.add(cod);
        }
        break;
      }
    }
  }

  // 7) peças trocadas juntas (pares) e soluções com mais de 1 peça, no nível base
  const conjCod = nivelBase && !porTipoBase ? base : [];
  const pares = new Map<string, string[]>();
  for (const c of conjCod) {
    const cods = Array.from(new Set(c.pecas.map((p) => p.c))).sort();
    for (let i = 0; i < cods.length; i++) for (let j = i + 1; j < cods.length; j++) {
      const k = cods[i] + "|" + cods[j];
      const l = pares.get(k) ?? [];
      l.push(c.os);
      pares.set(k, l);
    }
  }
  const combinacoes = Array.from(pares.entries())
    .filter(([, l]) => l.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([k, l]) => {
      const codigos = k.split("|") as [string, string];
      return {
        codigos,
        nomes: [peca(codigos[0]).n || "", peca(codigos[1]).n || ""] as [string, string],
        descricoes: [peca(codigos[0]).d, peca(codigos[1]).d] as [string, string],
        os: l.length,
        percentual: (100 * l.length) / Math.max(1, conjCod.length),
        ids: l.slice(0, MAX_IDS),
      };
    });

  const conjuntos: ResultadoTriagem["conjuntos"] = [];
  if (conjCod.length >= MIN_CODIGO) {
    const cont = new Map<string, string[]>();
    for (const c of conjCod) {
      const cods = Array.from(new Set(c.pecas.map((p) => p.c))).sort();
      if (cods.length < 2 || cods.length > 6) continue;
      const total = 1 << cods.length;
      for (let m = 1; m < total; m++) {
        let bits = 0;
        for (let x = m; x; x &= x - 1) bits++;
        if (bits < 2 || bits > 4) continue;
        const k = cods.filter((_, i) => m & (1 << i)).join("|");
        const l = cont.get(k) ?? [];
        l.push(c.os);
        cont.set(k, l);
      }
    }
    let lista = Array.from(cont.entries()).filter(([, l]) => l.length >= 2);
    // tira o conjunto menor quando existe um maior (que o contém) usado em quase as mesmas OS
    lista = lista.filter(([k, l]) => {
      const cods = k.split("|");
      return !lista.some(([k2, l2]) => k2 !== k && k2.split("|").length > cods.length && cods.every((c) => k2.split("|").includes(c)) && l2.length >= 0.8 * l.length);
    });
    lista.sort((a, b) => b[1].length - a[1].length || b[0].split("|").length - a[0].split("|").length);
    for (const [k, l] of lista.slice(0, 5)) {
      conjuntos.push({
        pecas: k.split("|").map((cod) => {
          const p = peca(cod);
          return { codigo: cod, descricao: p.d, nome: p.n || p.t, tipo: p.t };
        }),
        os: l.length,
        percentual: (100 * l.length) / conjCod.length,
        baseOs: conjCod.length,
        ids: l.slice(0, MAX_IDS),
      });
    }
  }

  // 8) conjunto mais provável (kit)
  const kits = nivelBase && base.length >= MIN_KIT ? montarKits(base, porTipoBase) : [];
  const kitNivel = kits.length ? nivelBase : null;
  const kitBase = kits.length ? base.length : 0;

  // 9) evidência na categoria (mesmo defeito): % que usou cada tipo de peça
  const refEv = casados.categoria.length >= MIN_CONFIAVEL ? casados.categoria : casados[refIris];
  const porGrupo: Record<string, number> = {};
  for (const c of refEv) for (const g of new Set(c.pecas.map((p) => p.t))) porGrupo[g] = (porGrupo[g] || 0) + 1;
  for (const g of Object.keys(porGrupo)) porGrupo[g] = (100 * porGrupo[g]) / Math.max(1, refEv.length);

  // 10) perfil de defeitos do modelo (todas as OS reparadas do modelo, por código IRIS)
  const perfilTotal = (resposta.perfil || []).reduce((s, [, n]) => s + n, 0);
  const perfil = (resposta.perfil || []).map(([codigo, n]) => ({
    codigo, os: n, percentual: perfilTotal ? (100 * n) / perfilTotal : 0, destacado: setIris.has(codigo),
  }));

  // 11) exemplos (até 10): com modelo informado, SEMPRE do mesmo modelo completo.
  //     Primeiro as OS do conjunto mais comum (até 6), depois as alternativas.
  const exemplos: ResultadoTriagem["exemplos"] = [];
  const chaveKit = (c: Caso) =>
    Array.from(new Set(c.pecas.filter((p) => !TIPOS_CONSUMO.has(p.t)).map((p) => (kits[0]?.porTipo ? p.t : p.c)))).sort().join("|");
  const ordemKit = (c: Caso) => {
    const ch = chaveKit(c);
    const i = kits.findIndex((k) => k.pecas.map((p) => (k.porTipo ? p.tipo : p.codigo)).sort().join("|") === ch);
    return i < 0 ? 99 : i;
  };
  const fonteEx = modelo ? casados.modelo : nivelBase ? base : [];
  const LIMITE_POR_CONJUNTO = [6, 2, 1, 1, 1];
  const porKit = new Map<number, number>();
  const jaFoi = new Set<string>();
  for (const passada of [1, 2]) {
    for (const c of fonteEx) {
      if (exemplos.length >= 10) break;
      if (jaFoi.has(c.os)) continue;
      const k = ordemKit(c);
      if (passada === 1 && (porKit.get(k) || 0) >= (LIMITE_POR_CONJUNTO[k] ?? 1)) continue;
      porKit.set(k, (porKit.get(k) || 0) + 1);
      jaFoi.add(c.os);
      exemplos.push({ os: c.os, pecas: c.pecas, nivel: nomeNivel(c.nivel) });
    }
  }
  const ordemEx = new Map(fonteEx.map((c) => [c.os, ordemKit(c)]));
  exemplos.sort((a, b) => (ordemEx.get(a.os) ?? 99) - (ordemEx.get(b.os) ?? 99));

  const familia = familiaModelo(modelo);
  return {
    termos: todosTermos.map((t) => ({ tipo: t.tipo, rotulo: t.rotulo, variantes: t.variantes })),
    familia,
    serie: serieModelo(familia),
    totais,
    casadosPorNivel: Object.fromEntries(NIVEIS.map((nv) => [nv, casados[nv].length])) as Record<NivelBusca, number>,
    defeito: {
      codigos: codigosIris.map(([codigo, n]) => ({ codigo, percentual: (100 * n) / Math.max(1, baseIris) })),
      base: baseIris,
    },
    perfil,
    perfilTotal,
    nivelBase,
    baseOs: base.length,
    viaTexto: nivelBase ? Math.min(viaTextoPorNivel[nivelBase], base.length) : 0,
    viaIris: nivelBase ? Math.max(0, base.length - viaTextoPorNivel[nivelBase]) : 0,
    confianca,
    apoio,
    nivelTipo,
    baseTipo: selTipo.length,
    semPeca,
    tipos: tipos.slice(0, 10),
    pecas: pecas.slice(0, 12),
    combinacoes,
    conjuntos,
    evidencia: { base: refEv.length, porGrupo },
    kits,
    kitNivel,
    kitBase,
    exemplos,
  };
}
