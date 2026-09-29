import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { familiaModelo } from "@/lib/gspn";
import { analisar, extrairTermos, gruposParaBanco, termosDeBusca, type RespostaBanco } from "@/lib/triagem";

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

  const { data, error } = await supabase.rpc("triagem_buscar", {
    p_categorias: categorias,
    p_modelo: modelo,
    p_familia: familiaModelo(modelo),
    p_grupos: gruposParaBanco(termos),
    ...(filtroGarantia ? { p_garantias: filtroGarantia } : {}),
  });
  if (error) {
    return NextResponse.json(
      { error: `Erro na busca (${error.message}). Confira se os SQLs 02, 03 e 05 já foram rodados no Supabase.` },
      { status: 500 }
    );
  }

  const resultado = analisar(data as RespostaBanco, termos, modelo, undefined, categorias.length === 1 ? categorias[0] : "");

  resultado.garantias = filtroGarantia ?? ["LP", "OW"];

  const ids = resultado.exemplos.map((e) => e.os);
  if (ids.length) {
    const { data: detalhes } = await supabase.from("gspn_os").select("os, modelo, defeito, reparacao").in("os", ids);
    const mapa = new Map((detalhes ?? []).map((d) => [d.os, d]));
    resultado.exemplos = resultado.exemplos.map((e) => ({
      ...e,
      modelo: mapa.get(e.os)?.modelo ?? "",
      defeito: mapa.get(e.os)?.defeito ?? "",
      reparacao: mapa.get(e.os)?.reparacao ?? "",
    }));
  }

  return NextResponse.json(resultado);
}
