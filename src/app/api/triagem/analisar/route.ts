import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { familiaModelo } from "@/lib/gspn";
import { analisar, extrairTermos, gruposParaBanco, serieModelo, termosDeBusca, type GuiaPeca, type RespostaBanco } from "@/lib/triagem";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const modelo = String(body?.modelo || "").trim().toUpperCase();
  const defeito = String(body?.defeito || "").trim();
  // siglas vêm da tabela "categorias" (Cadastro Categorias); aqui só confere o formato
  const categorias: string[] = (Array.isArray(body?.categorias) ? body.categorias : [])
    .map((c: unknown) => String(c).toUpperCase())
    .filter((c: string) => /^[A-Z0-9]{2,6}$/.test(c))
    .slice(0, 30);

  // garantia (coluna AL): LP = em garantia, OW = fora. As duas marcadas = sem filtro.
  const garantias: string[] = (Array.isArray(body?.garantias) ? body.garantias : [])
    .map((g: unknown) => String(g).toUpperCase())
    .filter((g: string) => g === "LP" || g === "OW");
  if (Array.isArray(body?.garantias) && garantias.length === 0) {
    return NextResponse.json({ error: "Marque pelo menos uma opção de garantia (LP ou OW)." }, { status: 400 });
  }
  const filtroGarantia = garantias.length === 1 ? garantias : null;

  if (!defeito) return NextResponse.json({ error: "Descreva o defeito." }, { status: 400 });
  if (categorias.length === 0) {
    return NextResponse.json({ error: "Escolha pelo menos uma categoria." }, { status: 400 });
  }

  const termos = extrairTermos(defeito);
  if (termosDeBusca(termos).length === 0) {
    return NextResponse.json(
      { error: "Não encontrei palavras úteis no defeito. Descreva com mais detalhes (ex: \"sem imagem, tem som\")." },
      { status: 400 }
    );
  }

  const familia = familiaModelo(modelo);
  const { data, error } = await supabase.rpc("triagem_buscar", {
    p_categorias: categorias,
    p_modelo: modelo,
    p_familia: familia,
    p_grupos: gruposParaBanco(termos),
    p_garantias: filtroGarantia,
    p_serie: familia ? serieModelo(familia) : null,
  });
  if (error) {
    return NextResponse.json(
      { error: `Erro na busca (${error.message}). Confira se o SQL 07 já foi rodado no Supabase.` },
      { status: 500 }
    );
  }

  const resultado = analisar(data as RespostaBanco, termos, modelo, undefined, categorias.length === 1 ? categorias[0] : "");

  // nomes dos defeitos padrão (IRIS) e guia do triador
  const codigos = Array.from(new Set([...resultado.defeito.codigos.map((c) => c.codigo), ...resultado.perfil.map((p) => p.codigo)])).filter(Boolean);
  const grupos = Array.from(
    new Set([
      ...resultado.kits.flatMap((k) => k.pecas.map((p) => p.tipo)),
      ...resultado.pecas.map((p) => p.tipo),
      ...resultado.conjuntos.flatMap((c) => c.pecas.map((p) => p.tipo)),
      ...(resultado.apoio?.kits ?? []).flatMap((k) => k.pecas.map((p) => p.tipo)),
    ]),
  );
  const [sint, aprend, guia] = await Promise.all([
    codigos.length ? supabase.from("sintomas_iris").select("categoria, codigo, nome, guia").in("codigo", codigos).in("categoria", categorias) : { data: [] },
    codigos.length ? supabase.from("sintomas_aprendidos").select("categoria, codigo, nome_sugerido").in("codigo", codigos).in("categoria", categorias) : { data: [] },
    grupos.length ? supabase.from("guia_pecas").select("categoria, grupo, o_que_e, por_que, como_confirmar").in("grupo", grupos).in("categoria", [...categorias, "*"]) : { data: [] },
  ]);
  const ordemCat = (c: string) => (categorias.indexOf(c) < 0 ? 99 : categorias.indexOf(c));
  const nomeIris = new Map<string, { nome: string; guia: string | null }>();
  for (const r of [...(sint.data ?? [])].sort((a, b) => ordemCat(a.categoria) - ordemCat(b.categoria))) {
    if (!nomeIris.has(r.codigo)) nomeIris.set(r.codigo, { nome: r.nome, guia: r.guia });
  }
  for (const r of aprend.data ?? []) if (!nomeIris.has(r.codigo) && r.nome_sugerido) nomeIris.set(r.codigo, { nome: r.nome_sugerido, guia: null });
  resultado.defeito.codigos = resultado.defeito.codigos.map((c) => ({ ...c, nome: nomeIris.get(c.codigo)?.nome, guia: nomeIris.get(c.codigo)?.guia }));
  resultado.perfil = resultado.perfil.map((p) => ({ ...p, nome: p.codigo ? nomeIris.get(p.codigo)?.nome : "Sem código" }));
  const mapaGuia: Record<string, GuiaPeca> = {};
  for (const r of [...(guia.data ?? [])].sort((a, b) => (a.categoria === "*" ? 1 : 0) - (b.categoria === "*" ? 1 : 0) || ordemCat(a.categoria) - ordemCat(b.categoria))) {
    if (!mapaGuia[r.grupo]) mapaGuia[r.grupo] = { o_que_e: r.o_que_e, por_que: r.por_que, como_confirmar: r.como_confirmar };
  }
  resultado.guia = mapaGuia;

  resultado.garantias = filtroGarantia ?? ["LP", "OW"];

  const ids = resultado.exemplos.map((e) => e.os);
  if (ids.length) {
    const { data: detalhes } = await supabase.from("gspn_os").select("os, modelo, defeito, reparacao, garantia").in("os", ids);
    const mapa = new Map((detalhes ?? []).map((d) => [d.os, d]));
    resultado.exemplos = resultado.exemplos.map((e) => ({
      ...e,
      modelo: mapa.get(e.os)?.modelo ?? "",
      defeito: mapa.get(e.os)?.defeito ?? "",
      reparacao: mapa.get(e.os)?.reparacao ?? "",
      garantia: mapa.get(e.os)?.garantia ?? "",
    }));
  }

  return NextResponse.json(resultado);
}
