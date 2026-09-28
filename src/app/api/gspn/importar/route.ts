import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/api";
import { podeImportarBase } from "@/lib/usuarios";
import type { RegistroOS } from "@/lib/gspnPlanilha";

export const maxDuration = 60;

const COLUNAS = [
  "os", "asc_code", "asc_nome", "modelo", "familia", "categoria_gspn", "categoria", "status", "entregue",
  "data_solicitacao", "reparo_finalizado", "garantia", "tipo_defeito", "sintoma", "defeito", "defeito_busca",
  "reparacao", "codigo_reparo", "reparado", "pecas", "qtd_pecas",
] as const;

/**
 * Importação da Base GSPN em 3 passos (o navegador lê a planilha e manda em lotes):
 *  { acao: "iniciar", arquivo }                     -> cria o registro da importação
 *  { acao: "lote", importacao_id, registros: [...] } -> grava/atualiza até 500 OS
 *  { acao: "concluir", importacao_id, linhas, entregues } -> fecha a importação
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
    if (!body.importacao_id || registros.length === 0 || registros.length > 1000) {
      return NextResponse.json({ error: "Lote inválido." }, { status: 400 });
    }
    const agora = new Date().toISOString();
    const linhas = registros
      .filter((r) => r && typeof r.os === "string" && r.os)
      .map((r) => {
        const linha: Record<string, unknown> = { importacao_id: body.importacao_id, atualizado_em: agora };
        for (const c of COLUNAS) linha[c] = (r as Record<string, unknown>)[c] ?? null;
        linha.pecas = Array.isArray(r.pecas) ? r.pecas : [];
        linha.entregue = !!r.entregue;
        linha.reparado = !!r.reparado;
        linha.qtd_pecas = Number(r.qtd_pecas) || 0;
        linha.familia = r.familia || "";
        linha.defeito_busca = r.defeito_busca || "";
        return linha;
      });
    const { error } = await admin.from("gspn_os").upsert(linhas, { onConflict: "os" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ gravados: linhas.length });
  }

  if (body.acao === "concluir" || body.acao === "erro") {
    const { error } = await admin
      .from("gspn_importacoes")
      .update({
        status: body.acao === "erro" ? "erro" : "concluida",
        linhas: Number(body.linhas) || 0,
        entregues: Number(body.entregues) || 0,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", body.importacao_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
}
