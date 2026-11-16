import type { SupabaseClient } from "@supabase/supabase-js";
import { colunasUsadasNormalizadas, linhaParaOS, mapearSomentePorNome, normCabecalho, type RegistroOS } from "@/lib/gspnPlanilha";
import { gravarRegistros } from "@/lib/gravarOs";

/**
 * SINCRONIZAÇÃO AUTOMÁTICA COM O ROBÔ GSPN (via Sistema de Inventário) — SQL 08
 *
 * O robô do PC salva a base_ordens_servico de cada unidade no OneDrive (AUTOMAÇÃO\ROBÔ - ...\BASE DE DADOS)
 * e o robô do Inventário envia essa base para o Inventário. O Inventário entrega a base pela rota
 * /api/integracao/base-os (com chave). Aqui a Triagem:
 *   1) pergunta ao Inventário a lista das unidades e quando cada base foi enviada;
 *   2) para cada unidade com base nova, baixa SÓ as colunas que a Triagem usa, em páginas;
 *   3) grava só as OS novas ou que mudaram (mesma regra da importação de planilha);
 *   4) guarda onde parou (tabela gspn_sincronizacao) — se o tempo acabar, continua na próxima chamada.
 * 1ª vez de cada unidade = base inteira. Depois = só o que mudou (Change Date dos últimos dias).
 * 1 vez por semana a base inteira de novo (segurança).
 *
 * Variáveis na Vercel (projeto triagem):
 *   INVENTARIO_BASE_OS_CHAVE  = a mesma chave da integração do Inventário (INTEGRACAO_BASE_OS_CHAVE)
 *   INVENTARIO_BASE_OS_URL    = (opcional) endereço da rota; padrão abaixo
 */
export const URL_PADRAO_INVENTARIO = "https://jm-inventario.vercel.app/api/integracao/base-os";
const POR_PAGINA = 1500; // máximo da rota do Inventário
const GRUPO_GRAVACAO = 500; // OS por gravação no banco
const DIAS_MARGEM = 3; // busca incremental: Change Date desde (última sincronização - 3 dias)
const DIAS_BASE_INTEIRA = 7; // a cada 7 dias relê a base inteira
const FOLGA_MS = 9000; // não começa uma página nova se faltar menos que isso do prazo

export type UnidadeRobo = {
  unidade_id: string;
  nome: string;
  asc: string | null;
  base_atualizada_em: string | null;
  enviado_em: string | null;
  os: number | null;
};

export type EstadoSinc = {
  unidade_id: string;
  asc_code: string | null;
  nome: string | null;
  base_atualizada_em: string | null;
  enviado_em: string | null;
  alvo_enviado_em: string | null;
  desde: string | null;
  pagina: number;
  paginas: number | null;
  total: number | null;
  linhas: number;
  entregues: number;
  novos: number;
  atualizados: number;
  iguais: number;
  importacao_id: string | null;
  ultima_ok: string | null;
  ultima_completa: string | null;
  ultimo_erro: string | null;
  erro_em: string | null;
};

export function integracaoConfigurada(): boolean {
  return !!process.env.INVENTARIO_BASE_OS_CHAVE;
}

export const MENSAGEM_SEM_CHAVE_INVENTARIO =
  "Falta cadastrar a chave da integração (INVENTARIO_BASE_OS_CHAVE) na Vercel do projeto triagem. Veja o passo a passo no README.";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chama a rota do Inventário (com nova tentativa se estiver ocupada). */
async function chamarInventario(params: Record<string, string>): Promise<any> {
  const chave = process.env.INVENTARIO_BASE_OS_CHAVE;
  if (!chave) throw new Error(MENSAGEM_SEM_CHAVE_INVENTARIO);
  const url = new URL(process.env.INVENTARIO_BASE_OS_URL || URL_PADRAO_INVENTARIO);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let ultimoErro = "";
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    let r: Response;
    try {
      r = await fetch(url, { headers: { "x-chave-integracao": chave }, cache: "no-store" });
    } catch (e) {
      ultimoErro = `sem resposta do Inventário (${e instanceof Error ? e.message : e})`;
      await esperar(2000 * tentativa);
      continue;
    }
    const corpo = await r.json().catch(() => null);
    if (r.ok) return corpo;
    ultimoErro = corpo?.erro || `erro ${r.status}`;
    if (r.status === 401) throw new Error("O Inventário recusou a chave (INVENTARIO_BASE_OS_CHAVE diferente da INTEGRACAO_BASE_OS_CHAVE do Inventário).");
    if (r.status === 404 || r.status === 400) throw new Error(`Inventário: ${ultimoErro}`);
    // 429 (muitas chamadas), 500, 503: espera e tenta de novo
    await esperar(r.status === 429 ? 15000 : 3000 * tentativa);
  }
  throw new Error(`Inventário: ${ultimoErro}`);
}

export async function listarUnidadesRobo(): Promise<UnidadeRobo[]> {
  const r = await chamarInventario({});
  const lista = Array.isArray(r?.unidades) ? r.unidades : [];
  return lista.map((u: any) => ({
    unidade_id: String(u.unidade_id),
    nome: String(u.nome ?? ""),
    asc: u.asc ? String(u.asc) : null,
    base_atualizada_em: u.base_atualizada_em ?? null,
    enviado_em: u.enviado_em ?? null,
    os: u.os ?? null,
  }));
}

export async function lerEstados(admin: SupabaseClient): Promise<Map<string, EstadoSinc>> {
  const { data, error } = await admin.from("gspn_sincronizacao").select("*");
  if (error) {
    if (/gspn_sincronizacao/.test(error.message) || error.code === "42P01" || error.code === "PGRST205") {
      throw new Error("Falta rodar o SQL 08 (supabase/08_sincronizacao_robo.sql) no Supabase.");
    }
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((e: EstadoSinc) => [e.unidade_id, e]));
}

const ms = (d: string | null | undefined) => (d ? new Date(d).getTime() || 0 : 0);
const diaIso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Esta unidade tem algo para fazer? */
export function situacao(u: UnidadeRobo, st: EstadoSinc | undefined): "andamento" | "nova" | "em_dia" {
  if (st && st.pagina > 0) return "andamento";
  if (!st || !st.enviado_em || ms(st.enviado_em) !== ms(u.enviado_em)) return "nova";
  return "em_dia";
}

/** Escolhe as colunas que existem na base do robô (nomes exatos) — pede uma linha só para ver o cabeçalho. */
async function colunasDaUnidade(unidadeId: string): Promise<string[]> {
  const r = await chamarInventario({ unidade: unidadeId, pagina: "1", por_pagina: "1" });
  const todas: string[] = Array.isArray(r?.colunas) ? r.colunas.map(String) : [];
  const querem = new Set(colunasUsadasNormalizadas());
  const escolhidas: string[] = [];
  const vistas = new Set<string>();
  for (const c of todas) {
    const n = normCabecalho(c);
    if (querem.has(n) && !vistas.has(n)) {
      vistas.add(n);
      escolhidas.push(c);
    }
  }
  const temObrigatorias = ["so nro.", "modelo", "status"].every((n) => vistas.has(n));
  if (!temObrigatorias) throw new Error("A base do robô não tem as colunas SO Nro. / Modelo / Status.");
  return escolhidas;
}

export type ResultadoPasso = {
  pendente: boolean; // ainda falta coisa (chamar de novo)
  mensagens: string[];
  unidades: { unidade: UnidadeRobo; estado: EstadoSinc | null; situacao: "andamento" | "nova" | "em_dia" }[];
};

/**
 * Faz o máximo possível dentro do prazo (em ms) e devolve se ainda ficou coisa pendente.
 * Pode ser chamada várias vezes seguidas: continua de onde parou.
 */
export async function sincronizarPasso(
  admin: SupabaseClient,
  opcoes: { prazoMs: number; criadoPor?: string | null },
): Promise<ResultadoPasso> {
  const inicio = Date.now();
  const resta = () => opcoes.prazoMs - (Date.now() - inicio);
  const mensagens: string[] = [];

  const lista = await listarUnidadesRobo();
  const estados = await lerEstados(admin);

  for (const u of lista) {
    if (resta() < FOLGA_MS) break;
    let st = estados.get(u.unidade_id);
    if (situacao(u, st) === "em_dia") continue;

    try {
      // ---- começar esta unidade ----
      if (!st || st.pagina <= 0) {
        const completaVencida = !st?.ultima_completa || Date.now() - ms(st.ultima_completa) > DIAS_BASE_INTEIRA * 86400000;
        const desde = !completaVencida && st?.ultima_ok ? diaIso(ms(st.ultima_ok) - DIAS_MARGEM * 86400000) : null;
        const rotulo = desde ? `desde ${desde.split("-").reverse().join("/")}` : "base inteira";
        const { data: imp, error: eImp } = await admin
          .from("gspn_importacoes")
          .insert({ arquivo: `Robô GSPN · ${u.nome} (${rotulo})`.slice(0, 200), criado_por: opcoes.criadoPor ?? null })
          .select("id")
          .single();
        if (eImp) throw new Error(eImp.message);
        st = {
          unidade_id: u.unidade_id,
          asc_code: u.asc,
          nome: u.nome,
          base_atualizada_em: st?.base_atualizada_em ?? null,
          enviado_em: st?.enviado_em ?? null,
          alvo_enviado_em: u.enviado_em,
          desde,
          pagina: 1,
          paginas: null,
          total: null,
          linhas: 0,
          entregues: 0,
          novos: 0,
          atualizados: 0,
          iguais: 0,
          importacao_id: imp.id,
          ultima_ok: st?.ultima_ok ?? null,
          ultima_completa: st?.ultima_completa ?? null,
          ultimo_erro: null,
          erro_em: null,
        };
        await salvarEstado(admin, st);
      }

      const colunas = await colunasDaUnidade(u.unidade_id);

      // ---- páginas ----
      while (resta() > FOLGA_MS) {
        const params: Record<string, string> = {
          unidade: u.unidade_id,
          pagina: String(st.pagina),
          por_pagina: String(POR_PAGINA),
          colunas: colunas.join(","),
        };
        if (st.desde) params.desde = st.desde;
        const r = await chamarInventario(params);
        const nomes: string[] = Array.isArray(r?.colunas) ? r.colunas : [];
        const linhas: unknown[][] = Array.isArray(r?.linhas) ? r.linhas : [];
        const mapa = mapearSomentePorNome(nomes);

        // linha -> OS (se a mesma OS vier repetida, vale a última)
        const porOs = new Map<string, RegistroOS>();
        for (const l of linhas) {
          const reg = linhaParaOS(l, mapa);
          if (reg) porOs.set(reg.os, reg);
        }
        const registros = [...porOs.values()];
        for (let i = 0; i < registros.length; i += GRUPO_GRAVACAO) {
          const c = await gravarRegistros(admin, registros.slice(i, i + GRUPO_GRAVACAO), st.importacao_id);
          st.novos += c.novos;
          st.atualizados += c.atualizados;
          st.iguais += c.iguais;
        }
        st.linhas += linhas.length;
        st.entregues += registros.filter((x) => x.entregue).length;
        st.total = Number(r?.total) || 0;
        st.paginas = Number(r?.paginas) || 1;

        if (st.pagina >= st.paginas) {
          await concluirUnidade(admin, st, r?.base_atualizada_em ?? u.base_atualizada_em, mensagens);
          break;
        }
        st.pagina += 1;
        await salvarEstado(admin, st);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      mensagens.push(`${u.nome}: ${msg}`);
      if (st) {
        st.ultimo_erro = msg.slice(0, 500);
        st.erro_em = new Date().toISOString();
        await salvarEstado(admin, st).catch(() => null);
      }
      // falta SQL / chave errada: não adianta tentar as outras unidades
      if (/SQL 08|recusou a chave|INVENTARIO_BASE_OS_CHAVE/.test(msg)) break;
    }
    estados.set(u.unidade_id, st as EstadoSinc);
  }

  const unidades = lista.map((u) => {
    const estado = estados.get(u.unidade_id) ?? null;
    return { unidade: u, estado, situacao: situacao(u, estado ?? undefined) };
  });
  // pendente = alguma unidade ainda com trabalho e SEM erro nesta rodada (com erro, para e mostra)
  const pendente = unidades.some((x) => x.situacao !== "em_dia" && !(x.estado?.erro_em && ms(x.estado.erro_em) >= inicio));
  return { pendente, mensagens, unidades };
}

async function salvarEstado(admin: SupabaseClient, st: EstadoSinc) {
  const { error } = await admin.from("gspn_sincronizacao").upsert({ ...st, atualizado_em: new Date().toISOString() }, { onConflict: "unidade_id" });
  if (error) throw new Error(error.message);
}

async function concluirUnidade(admin: SupabaseClient, st: EstadoSinc, baseAtualizadaEm: string | null, mensagens: string[]) {
  // aprendizado das categorias só quando entrou OS nova ou mudou alguma
  if (st.novos + st.atualizados > 0) await admin.rpc("aplicar_categorias", { p_prefixo: null });
  if (st.importacao_id) {
    await admin
      .from("gspn_importacoes")
      .update({
        status: "concluida",
        linhas: st.linhas,
        entregues: st.entregues,
        novos: st.novos,
        atualizados: st.atualizados,
        iguais: st.iguais,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", st.importacao_id);
  }
  const agora = new Date().toISOString();
  st.enviado_em = st.alvo_enviado_em;
  st.base_atualizada_em = baseAtualizadaEm;
  st.ultima_ok = agora;
  if (!st.desde) st.ultima_completa = agora;
  st.pagina = 0;
  st.ultimo_erro = null;
  st.erro_em = null;
  await salvarEstado(admin, st);
  mensagens.push(`${st.nome}: ${st.novos} novas, ${st.atualizados} atualizadas, ${st.iguais} iguais.`);
}

/** "Sincronizar a base inteira de novo": zera as marcas, a próxima rodada relê tudo. */
export async function reiniciarSincronizacao(admin: SupabaseClient) {
  const { error } = await admin
    .from("gspn_sincronizacao")
    .update({ enviado_em: null, ultima_completa: null, pagina: 0 })
    .neq("unidade_id", "");
  if (error) throw new Error(error.message);
}
