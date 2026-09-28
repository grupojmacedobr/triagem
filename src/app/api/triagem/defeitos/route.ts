import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { textoBusca } from "@/lib/gspn";

/** Sugestões de defeito (descrições já cadastradas na base) enquanto a pessoa digita. */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const q = textoBusca(url.searchParams.get("q") || "");
  const categorias = (url.searchParams.get("categorias") || "").split(",").filter(Boolean);
  if (q.length < 2) return NextResponse.json([]);

  const { data, error } = await supabase.rpc("triagem_sugerir_defeitos", { p_texto: q, p_categorias: categorias });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
