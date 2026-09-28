import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/api";
import { podeImportarBase } from "@/lib/usuarios";
import { PREFIXO_VALIDO, limparPrefixo } from "@/lib/categorias";

export const maxDuration = 60;

/** Nova regra (ou troca a categoria de uma que já existe): { prefixo, categoria } */
export async function POST(request: Request) {
  const checagem = await exigirPermissao(podeImportarBase, "cadastrar regras de categoria");
  if (!checagem.ok) return checagem.resposta;
  const { admin, userId } = checagem;
  const body = await request.json().catch(() => null);
  const prefixo = limparPrefixo(body?.prefixo);
  const categoria = String(body?.categoria || "").trim().toUpperCase();
  if (!PREFIXO_VALIDO.test(prefixo)) {
    return NextResponse.json({ error: "Começo do modelo inválido. Use letras, números, - / ou . (ex.: WF, RF28, SM-X)." }, { status: 400 });
  }
  const { data: cat } = await admin.from("categorias").select("sigla").eq("sigla", categoria).maybeSingle();
  if (!cat) return NextResponse.json({ error: "Escolha uma categoria válida." }, { status: 400 });

  const { error } = await admin
    .from("categoria_regras")
    .upsert({ prefixo, categoria, criado_por: userId, criado_em: new Date().toISOString() }, { onConflict: "prefixo" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // já reclassifica as OS da base que começam com esse prefixo
  const { data: n, error: erroAplicar } = await admin.rpc("aplicar_categorias", { p_prefixo: prefixo });
  if (erroAplicar) return NextResponse.json({ error: erroAplicar.message }, { status: 400 });
  return NextResponse.json({ ok: true, reclassificadas: Number(n) || 0 });
}

/** Excluir regra: ?id=uuid  (as OS voltam para a categoria da planilha / aprendida) */
export async function DELETE(request: Request) {
  const checagem = await exigirPermissao(podeImportarBase, "excluir regras de categoria");
  if (!checagem.ok) return checagem.resposta;
  const { admin } = checagem;
  const id = new URL(request.url).searchParams.get("id") || "";
  const { data: regra } = await admin.from("categoria_regras").select("prefixo").eq("id", id).maybeSingle();
  if (!regra) return NextResponse.json({ error: "Regra não encontrada." }, { status: 404 });
  const { error } = await admin.from("categoria_regras").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: n } = await admin.rpc("aplicar_categorias", { p_prefixo: regra.prefixo });
  return NextResponse.json({ ok: true, reclassificadas: Number(n) || 0 });
}
