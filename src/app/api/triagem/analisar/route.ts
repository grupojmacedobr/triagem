import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { familiaModelo, CATEGORIAS } from "@/lib/gspn";
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
  const categoria = String(body?.categoria || "").trim().toUpperCase();
  const defeito = String(body?.defeito || "").trim();

  if (!defeito) return NextResponse.json({ error: "Descreva o defeito." }, { status: 400 });
  if (!CATEGORIAS.some((c) => c.sigla === categoria)) {
    return NextResponse.json({ error: "Escolha a categoria do produto." }, { status: 400 });
  }

  const termos = extrairTermos(defeito);
  if (termosDeBusca(termos).length === 0) {
    return NextResponse.json(
      { error: "Não encontrei palavras úteis no defeito. Descreva com mais detalhes (ex: \"sem imagem, tem som\")." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("triagem_buscar", {
    p_categoria: categoria,
    p_modelo: modelo,
    p_familia: familiaModelo(modelo),
    p_grupos: gruposParaBanco(termos),
  });
  if (error) {
    return NextResponse.json(
      { error: `Erro na busca (${error.message}). Confira se o SQL 02_gspn.sql já foi rodado no Supabase.` },
      { status: 500 }
    );
  }

  const resultado = analisar(data as RespostaBanco, termos, modelo);

  // completa os exemplos com o texto do defeito e o modelo
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
