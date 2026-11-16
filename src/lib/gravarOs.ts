import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistroOS } from "@/lib/gspnPlanilha";

/**
 * Grava OS na tabela gspn_os — usado pela importação de planilha (tela Base GSPN)
 * e pela sincronização automática com o robô (Inventário).
 * Só grava as OS novas ou que mudaram (compara a "impressão digital" = hash).
 */

// "categoria" NÃO vai daqui: o banco decide (regra cadastrada > planilha > aprendido > Outros)
const COLUNAS = [
  "os", "asc_code", "asc_nome", "modelo", "familia", "categoria_gspn", "status", "entregue",
  "data_solicitacao", "reparo_finalizado", "garantia", "tipo_defeito", "sintoma", "defeito", "defeito_busca",
  "reparacao", "codigo_reparo", "reparado", "pecas", "qtd_pecas", "hash",
] as const;

export type ContagemGravacao = { novos: number; atualizados: number; iguais: number };

/** Grava um grupo pequeno (até ~500 OS) de uma vez. */
export async function gravarRegistros(
  admin: SupabaseClient,
  registros: RegistroOS[],
  importacaoId: string | null,
): Promise<ContagemGravacao> {
  const validos = registros.filter((r) => r && typeof r.os === "string" && r.os && r.os.length <= 40);
  const cont: ContagemGravacao = { novos: 0, atualizados: 0, iguais: 0 };
  if (validos.length === 0) return cont;

  // 1) quais dessas OS já existem e com qual "impressão digital"
  const { data: existentes, error: erroLeitura } = await admin
    .from("gspn_os")
    .select("os, hash")
    .in("os", validos.map((r) => r.os));
  if (erroLeitura) throw new Error(erroLeitura.message);
  const hashAtual = new Map((existentes ?? []).map((e) => [e.os as string, e.hash as string | null]));

  const agora = new Date().toISOString();
  const linhas: Record<string, unknown>[] = [];
  for (const r of validos) {
    if (!hashAtual.has(r.os)) cont.novos++;
    else if (hashAtual.get(r.os) !== r.hash) cont.atualizados++;
    else {
      cont.iguais++;
      continue; // não mudou: não gasta escrita no banco
    }
    const linha: Record<string, unknown> = { importacao_id: importacaoId, atualizado_em: agora };
    for (const c of COLUNAS) linha[c] = (r as Record<string, unknown>)[c] ?? null;
    linha.pecas = Array.isArray(r.pecas) ? r.pecas : [];
    linha.entregue = !!r.entregue;
    linha.reparado = !!r.reparado;
    linha.qtd_pecas = Number(r.qtd_pecas) || 0;
    linha.familia = r.familia || "";
    linha.defeito_busca = r.defeito_busca || "";
    linhas.push(linha);
  }

  if (linhas.length) {
    const { error } = await admin.from("gspn_os").upsert(linhas, { onConflict: "os" });
    if (error) throw new Error(error.message);
  }
  return cont;
}
