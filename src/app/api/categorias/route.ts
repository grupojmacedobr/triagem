import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/api";
import { podeImportarBase } from "@/lib/usuarios";
import { SIGLA_VALIDA } from "@/lib/categorias";

/** Nova categoria: { sigla, nome } */
export async function POST(request: Request) {
  const checagem = await exigirPermissao(podeImportarBase, "cadastrar categorias");
  if (!checagem.ok) return checagem.resposta;
  const body = await request.json().catch(() => null);
  const sigla = String(body?.sigla || "").trim().toUpperCase();
  const nome = String(body?.nome || "").trim().slice(0, 60);
  if (!SIGLA_VALIDA.test(sigla)) {
    return NextResponse.json({ error: "A sigla deve ter de 2 a 6 letras/números, sem espaço (ex.: TAB, WATCH)." }, { status: 400 });
  }
  if (!nome) return NextResponse.json({ error: "Informe o nome da categoria." }, { status: 400 });

  const { admin } = checagem;
  const { data: maior } = await admin.from("categorias").select("ordem").neq("sigla", "OUT").order("ordem", { ascending: false }).limit(1);
  const ordem = ((maior?.[0]?.ordem as number) ?? 100) + 10;
  const { error } = await admin.from("categorias").insert({ sigla, nome, ordem });
  if (error) {
    const msg = error.code === "23505" ? `Já existe a categoria ${sigla}.` : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/** Renomear: { sigla, nome } */
export async function PUT(request: Request) {
  const checagem = await exigirPermissao(podeImportarBase, "alterar categorias");
  if (!checagem.ok) return checagem.resposta;
  const body = await request.json().catch(() => null);
  const sigla = String(body?.sigla || "").trim().toUpperCase();
  const nome = String(body?.nome || "").trim().slice(0, 60);
  if (!sigla || !nome) return NextResponse.json({ error: "Informe a sigla e o nome." }, { status: 400 });
  const { error } = await checagem.admin.from("categorias").update({ nome }).eq("sigla", sigla);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** Excluir (só se não tiver OS nem regra): ?sigla=XXX */
export async function DELETE(request: Request) {
  const checagem = await exigirPermissao(podeImportarBase, "excluir categorias");
  if (!checagem.ok) return checagem.resposta;
  const sigla = (new URL(request.url).searchParams.get("sigla") || "").toUpperCase();
  if (!sigla || sigla === "OUT") return NextResponse.json({ error: "Essa categoria não pode ser excluída." }, { status: 400 });
  const { admin } = checagem;
  const [{ count: os }, { count: regras }] = await Promise.all([
    admin.from("gspn_os").select("os", { count: "exact", head: true }).eq("categoria", sigla),
    admin.from("categoria_regras").select("id", { count: "exact", head: true }).eq("categoria", sigla),
  ]);
  if ((os ?? 0) > 0 || (regras ?? 0) > 0) {
    return NextResponse.json(
      { error: `A categoria ${sigla} ainda tem ${os ?? 0} OS e ${regras ?? 0} regra(s). Mude as regras antes de excluir.` },
      { status: 400 },
    );
  }
  const { error } = await admin.from("categorias").delete().eq("sigla", sigla);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
