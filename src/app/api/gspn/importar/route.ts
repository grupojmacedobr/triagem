import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/api";
import { podeImportarBase } from "@/lib/usuarios";
import type { RegistroOS } from "@/lib/gspnPlanilha";

export const maxDuration = 60;

// "categoria" NÃO vai daqui: o banco decide (regra cadastrada > planilha > aprendido > Outros)
const COLUNAS = [
  "os", "asc_code", "asc_nome", "modelo", "familia", "categoria_gspn", "status", "entregue",
  "data_solicitacao", "reparo_finalizado", "garantia", "tipo_defeito", "sintoma", "defeito", "defeito_busca",
  "reparacao", "codigo_reparo", "reparado", "pecas", "qtd_pecas", "hash",
] as const;

const LOTE_MAXIMO = 500;

/**
 * Importação da Base GSPN em partes (o navegador lê a planilha e manda em lotes pequenos):
 *  { acao: "iniciar", arquivo }                      -> cria o registro da importação
 *  { acao: "lote", importacao_id, registros: [...] } -> grava só as OS novas ou que mudaram
 *  { acao: "concluir", importacao_id, linhas, entregues, novos, atualizados, iguais }
 *        -> fecha a importação e roda o "aprendizado" das categorias
 */
export async function POST(request: Request) {
  const checagem = await exigirPermissao(podeImportarBase, "importar a Base GSPN");
  if (!checagem.ok) return checagem.resposta;
  const { admin, userId } = checagem;

  const body = await request.json().catch(() => null);
  if (!body?.acao) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });

  if (body.acao === "iniciar") {
    const { data, error } = await admin
      .from("gspn_importacoes")
      .insert({ arquivo: String(body.arquivo || "planilha.xlsx").slice(0, 200), criado_por: userId })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ importacao_id: data.id });
  }

  if (body.acao === "lote") {
    const registros: RegistroOS[] = Array.isArray(body.registros) ? body.registros : [];
    if (!body.importacao_id || registros.length === 0 || registros.length > LOTE_MAXIMO) {
      return NextResponse.json({ error: "Lote inválido." }, { status: 400 });
    }
    const validos = registros.filter((r) => r && typeof r.os === "string" && r.os && r.os.length <= 40);

    // 1) quais dessas OS já existem e com qual "impressão digital"
    const { data: existentes, error: erroLeitura } = await admin
      .from("gspn_os")
      .select("os, hash")
      .in("os", validos.map((r) => r.os));
    if (erroLeitura) return NextResponse.json({ error: erroLeitura.message }, { status: 400 });
    const hashAtual = new Map((existentes ?? []).map((e) => [e.os as string, e.hash as string | null]));

    let novos = 0;
    let atualizados = 0;
    let iguais = 0;
    const agora = new Date().toISOString();
    const linhas: Record<string, unknown>[] = [];
    for (const r of validos) {
      if (!hashAtual.has(r.os)) novos++;
      else if (hashAtual.get(r.os) !== r.hash) atualizados++;
      else {
        iguais++;
        continue; // não mudou: não gasta escrita no banco
      }
      const linha: Record<string, unknown> = { importacao_id: body.importacao_id, atualizado_em: agora };
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
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ novos, atualizados, iguais });
  }

  if (body.acao === "concluir" || body.acao === "erro") {
    const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
    let reclassificadas = 0;
    if (body.acao === "concluir") {
      // aprendizado: OS que estavam em "Outros" ganham a categoria que o sistema já conhece
      const { data } = await admin.rpc("aplicar_categorias", { p_prefixo: null });
      reclassificadas = Number(data) || 0;
    }
    const { error } = await admin
      .from("gspn_importacoes")
      .update({
        status: body.acao === "erro" ? "erro" : "concluida",
        linhas: n(body.linhas),
        entregues: n(body.entregues),
        novos: n(body.novos),
        atualizados: n(body.atualizados),
        iguais: n(body.iguais),
        concluido_em: new Date().toISOString(),
      })
      .eq("id", body.importacao_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, reclassificadas });
  }

  return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
}
