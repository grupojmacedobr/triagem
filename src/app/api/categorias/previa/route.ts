import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PREFIXO_VALIDO, limparPrefixo } from "@/lib/categorias";

/** Quantos modelos / OS começam com o prefixo e em que categoria estão hoje. ?prefixo=WF */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const prefixo = limparPrefixo(new URL(request.url).searchParams.get("prefixo"));
  if (!PREFIXO_VALIDO.test(prefixo)) return NextResponse.json({ modelos: 0, os: 0, porCategoria: {}, exemplos: [], regra: null });

  const [{ data, error }, { data: regras }] = await Promise.all([
    supabase.from("gspn_modelos").select("modelo, categoria, qtd_os").ilike("modelo", `${prefixo}%`).order("qtd_os", { ascending: false }).limit(3000),
    supabase.from("categoria_regras").select("prefixo, categoria"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const porCategoria: Record<string, number> = {};
  const modelos = new Set<string>();
  let os = 0;
  for (const m of data ?? []) {
    modelos.add(m.modelo);
    os += m.qtd_os;
    porCategoria[m.categoria ?? "OUT"] = (porCategoria[m.categoria ?? "OUT"] || 0) + m.qtd_os;
  }
  // regra que já vale para esse começo (a mais específica)
  const regra =
    (regras ?? [])
      .filter((r) => prefixo.startsWith(r.prefixo))
      .sort((a, b) => b.prefixo.length - a.prefixo.length)[0] ?? null;

  return NextResponse.json({
    modelos: modelos.size,
    os,
    porCategoria,
    exemplos: (data ?? []).slice(0, 12),
    regra,
  });
}
