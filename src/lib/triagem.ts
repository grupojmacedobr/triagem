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
  ["sem imagem", "tela preta", "tela escura", "sem video", "nao aparece imagem", "sem tela", "imagem escura", "nao da imagem"],
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

export type Termo = { tipo: "conceito" | "palavra" | "funciona"; rotulo: string; variantes: string[] };

export const MAX_TERMOS = 30;

export function extrairTermos(defeito: string): Termo[] {
  let t = " " + normalizar(defeito) + " ";
  const termos: Termo[] = [];
  // "tem som", "mas tem imagem", "liga normal": isso FUNCIONA — não é defeito, não entra na busca
  const funciona: string[] = [];
  t = t.replace(/ tem ([a-z0-9]+)/g, (_, w: string) => { if (w !== "defeito" && w !== "problema") funciona.push(w); return " "; });
  // "com som", "apenas com imagem"... também é o que FUNCIONA (mas "com oxidacao" continua sendo defeito)
  t = t.replace(/ (?:apenas |mas |so )?com (som|audio|imagem|video|energia|sinal|wifi|internet)(?= )/g, (_, w: string) => { funciona.push(w); return " "; });
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
  return [...termos.slice(0, MAX_TERMOS), ...funciona.map((w): Termo => ({ tipo: "funciona", rotulo: w, variantes: [] }))];
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
type Caso = { os: string; nivel: number; mascara: number; pecas: PecaOS[] };
export type RespostaBanco = {
  totais: { n_modelo: number; n_familia: number; n_categoria: number };
  casos: [string, number, number, PecaOS[]][];
  historico: [number, PecaOS[], string][];
};

export type NivelBusca = "modelo" | "familia" | "categoria";
const NIVEL_MIN: Record<NivelBusca, number> = { modelo: 2, familia: 1, categoria: 0 };

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
};

export type ResultadoTriagem = {
  termos: { tipo: Termo["tipo"]; rotulo: string; variantes: string[] }[];
  familia: string;
  totais: RespostaBanco["totais"];
  casadosPorNivel: Record<NivelBusca, number>;
  nivelTipo: NivelBusca;
  baseTipo: number;
  semPeca: number;
  tipos: { tipo: string; os: number; percentual: number }[];
  pecas: PecaSugerida[];
  combinacoes: { codigos: [string, string]; nomes: [string, string]; descricoes: [string, string]; os: number }[];
  /** garantias usadas no filtro (LP / OW) */
  garantias?: string[];
  /** conjuntos completos de peças que resolveram OS parecidas (o mais comum primeiro) */
  kits: KitPecas[];
  kitNivel: NivelBusca | null;
  kitBase: number; // OS parecidas usadas para montar os conjuntos
  exemplos: { os: string; modelo?: string; defeito?: string; reparacao?: string; pecas: PecaOS[]; nivel: NivelBusca }[];
};

export type PecaKit = { codigo: string; descricao: string; nome: string; tipo: string };

export type KitPecas = {
  /** peças do conjunto (vazio = reparo sem troca de peça); no nível categoria, só o tipo */
  pecas: PecaKit[];
  /** itens pequenos que costumam ir junto (fita, parafuso, etiqueta) */
  acompanham: PecaKit[];
  os: number;
  percentual: number;
  exemplos: string[];
  porTipo: boolean; // true = conjunto por tipo de peça (quando não há histórico do modelo/família)
};

/** Itens de consumo que não mudam o "conserto" (não entram na chave do conjunto). */
const TIPOS_CONSUMO = GRUPOS_CONSUMO;
const MIN_KIT = 3;

function montarKits(casos: Caso[], porTipo: boolean): KitPecas[] {
  const grupos = new Map<string, { pecas: KitPecas["pecas"]; os: string[]; consumo: Map<string, { p: PecaOS; n: number }> }>();
  for (const c of casos) {
    const principais = c.pecas.filter((p) => !TIPOS_CONSUMO.has(p.t));
    const itens = new Map<string, KitPecas["pecas"][number]>();
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
    .slice(0, 5)
    .map((g) => ({
      pecas: g.pecas,
      acompanham: Array.from(g.consumo.values())
        .filter((x) => x.n >= Math.max(1, g.os.length / 2))
        .map(({ p }) => ({ codigo: porTipo ? "" : p.c, descricao: porTipo ? "" : p.d, nome: porTipo ? p.t : p.n || p.t, tipo: p.t })),
      os: g.os.length,
      percentual: casos.length ? (100 * g.os.length) / casos.length : 0,
      exemplos: g.os.slice(0, 5),
      porTipo,
    }));
}

const MIN_CODIGO = 3;
const MIN_TIPO = 15;
const CORTE = 0.6;

function selecionar(casos: Caso[], n: number, qtdTermos: number): Caso[] {
  if (!casos.length || !qtdTermos) return [];
  const df = new Array(qtdTermos).fill(0);
  for (const c of casos) for (let i = 0; i < qtdTermos; i++) if (c.mascara & (1 << i)) df[i]++;
  const idf = df.map((d) => Math.log((n + 1) / (1 + d)) + 0.1);
  const nota = (c: Caso) => idf.reduce((s, v, i) => ((c.mascara & (1 << i)) ? s + v : s), 0);
  const notas = casos.map(nota);
  const max = Math.max(...notas);
  if (max <= 0) return [];
  return casos.filter((_, i) => notas[i] >= CORTE * max);
}

function nomeNivel(n: number): NivelBusca {
  return n === 2 ? "modelo" : n === 1 ? "familia" : "categoria";
}

/** Traduz as peças na hora (bases antigas também ganham os nomes novos). */
function traduzir(pecas: PecaOS[] | null, categoria: string): PecaOS[] {
  return (pecas || []).map((p) => {
    const t = traduzirPeca(p.d, categoria);
    return { ...p, t: t.grupo, n: t.nome };
  });
}

export function analisar(
  resposta: RespostaBanco,
  todosTermos: Termo[],
  modelo: string,
  excluirOs?: string,
  categoria = "",
): ResultadoTriagem {
  const termos = termosDeBusca(todosTermos);
  const casos: Caso[] = resposta.casos.filter((c) => c[0] !== excluirOs).map(([os, nivel, mascara, pecas]) => ({
    os, nivel, mascara, pecas: traduzir(pecas, categoria),
  }));
  resposta = { ...resposta, historico: resposta.historico.map(([n, pecas, os]) => [n, traduzir(pecas, categoria), os]) };
  const totais = resposta.totais;
  const N: Record<NivelBusca, number> = { modelo: totais.n_modelo, familia: totais.n_familia, categoria: totais.n_categoria };

  const casados = {} as Record<NivelBusca, Caso[]>;
  (["modelo", "familia", "categoria"] as NivelBusca[]).forEach((nv) => {
    casados[nv] = selecionar(casos.filter((c) => c.nivel >= NIVEL_MIN[nv]), N[nv], termos.length);
  });

  // 1) tipos de peça
  const niveisOrdem: NivelBusca[] = ["modelo", "familia", "categoria"];
  // o nível mais estreito com volume; se nenhum tiver, o que tiver MAIS OS parecidas
  const nivelTipo =
    niveisOrdem.find((nv) => casados[nv].length >= MIN_TIPO) ??
    niveisOrdem.reduce((m, nv) => (casados[nv].length > casados[m].length ? nv : m), "modelo" as NivelBusca);
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

  // histórico do modelo/família (qualquer defeito), pra achar o código de cada tipo
  const hist: Record<"modelo" | "familia", PecaOS[][]> = { modelo: [], familia: [] };
  for (const [nivel, pecas, os] of resposta.historico) {
    if (os === excluirOs) continue;
    if (nivel === 2) hist.modelo.push(pecas);
    if (nivel >= 1) hist.familia.push(pecas);
  }
  const usoHist = new Map<string, number>();
  for (const pecas of hist.familia) for (const c of new Set(pecas.map((p) => p.c))) usoHist.set(c, (usoHist.get(c) || 0) + 1);

  const info = new Map<string, PecaOS>();
  const guardar = (p: PecaOS) => { if (!info.has(p.c)) info.set(p.c, p); };

  // 2) códigos pelo defeito, no nível mais estreito com casos
  const pecas: PecaSugerida[] = [];
  const vistos = new Set<string>();
  for (const nv of ["modelo", "familia"] as const) {
    const s = casados[nv];
    if (s.length >= MIN_CODIGO) {
      const cont = new Map<string, number>();
      for (const c of s) for (const p of c.pecas) { guardar(p); }
      for (const c of s) for (const cod of new Set(c.pecas.map((p) => p.c))) cont.set(cod, (cont.get(cod) || 0) + 1);
      for (const [cod, q] of Array.from(cont.entries()).sort((a, b) => b[1] - a[1])) {
        const p = info.get(cod)!;
        pecas.push({
          codigo: cod, descricao: p.d, nome: p.n || p.t, tipo: p.t, osComPeca: q, percentual: (100 * q) / s.length, baseOs: s.length,
          origem: nv === "modelo" ? "defeito-modelo" : "defeito-familia", usoHistorico: usoHist.get(cod) || 0,
        });
        vistos.add(cod);
      }
      break;
    }
  }

  // 3) completa com o código mais usado do modelo/família para cada tipo provável
  for (const { tipo, os } of tipos.slice(0, 6)) {
    for (const nv of ["modelo", "familia"] as const) {
      const cont = new Map<string, number>();
      for (const lista of hist[nv]) for (const p of lista) if (p.t === tipo) { guardar(p); cont.set(p.c, (cont.get(p.c) || 0) + 1); }
      if (cont.size) {
        const cod = Array.from(cont.entries()).sort((a, b) => b[1] - a[1])[0][0];
        if (!vistos.has(cod)) {
          const p = info.get(cod)!;
          pecas.push({
            codigo: cod, descricao: p.d, nome: p.n || tipo, tipo, osComPeca: os, percentual: selTipo.length ? (100 * os) / selTipo.length : 0,
            baseOs: selTipo.length, origem: "tipo-provavel", usoHistorico: usoHist.get(cod) || 0,
          });
          vistos.add(cod);
        }
        break;
      }
    }
  }

  // combinações (peças trocadas juntas) no conjunto usado pros códigos
  const conjCod = casados.modelo.length >= MIN_CODIGO ? casados.modelo : casados.familia;
  const pares = new Map<string, number>();
  for (const c of conjCod) {
    for (const p of c.pecas) guardar(p);
    const cods = Array.from(new Set(c.pecas.map((p) => p.c))).sort();
    for (let i = 0; i < cods.length; i++) for (let j = i + 1; j < cods.length; j++) {
      const k = cods[i] + "|" + cods[j];
      pares.set(k, (pares.get(k) || 0) + 1);
    }
  }
  const combinacoes = Array.from(pares.entries())
    .filter(([, q]) => q >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, os]) => {
      const codigos = k.split("|") as [string, string];
      const nomeDe = (c: string) => info.get(c)?.n || info.get(c)?.t || "";
      return {
        codigos,
        nomes: [nomeDe(codigos[0]), nomeDe(codigos[1])] as [string, string],
        descricoes: [info.get(codigos[0])?.d || "", info.get(codigos[1])?.d || ""] as [string, string],
        os,
      };
    });

  // conjuntos completos de peças (o "kit" que resolveu): mesmo modelo > mesma família > categoria (por tipo)
  let kitNivel: NivelBusca | null = null;
  let kits: KitPecas[] = [];
  for (const nv of ["modelo", "familia"] as const) {
    if (casados[nv].length >= MIN_KIT) {
      kits = montarKits(casados[nv], false);
      if (kits.length) {
        kitNivel = nv;
        break;
      }
    }
  }
  if (!kitNivel && casados.categoria.length >= MIN_KIT) {
    kits = montarKits(casados.categoria, true);
    if (kits.length) kitNivel = "categoria";
  }
  const kitBase = kitNivel ? casados[kitNivel].length : 0;

  // exemplos: prioriza o mesmo modelo, depois família, depois categoria
  const exemplos: ResultadoTriagem["exemplos"] = [];
  const jaFoi = new Set<string>();
  // com modelo informado, os exemplos são SEMPRE do mesmo modelo completo
  const niveisExemplo: NivelBusca[] = modelo ? ["modelo"] : ["modelo", "familia", "categoria"];
  for (const nv of niveisExemplo) {
    for (const c of casados[nv]) {
      if (modelo && c.nivel !== 2) continue;
      if (exemplos.length >= 10) break;
      if (jaFoi.has(c.os)) continue;
      jaFoi.add(c.os);
      exemplos.push({ os: c.os, pecas: c.pecas, nivel: nomeNivel(c.nivel) });
    }
  }

  return {
    termos: todosTermos.map((t) => ({ tipo: t.tipo, rotulo: t.rotulo, variantes: t.variantes })),
    familia: familiaModelo(modelo),
    totais,
    casadosPorNivel: { modelo: casados.modelo.length, familia: casados.familia.length, categoria: casados.categoria.length },
    nivelTipo,
    baseTipo: selTipo.length,
    semPeca,
    tipos: tipos.slice(0, 10),
    pecas: pecas.slice(0, 12),
    combinacoes,
    kits,
    kitNivel,
    kitBase,
    exemplos,
  };
}
