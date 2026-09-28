import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Sugestões de SKU enquanto a pessoa digita (campo Modelo da Triagem). */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim().toUpperCase().replace(/[%_,()]/g, "") || "";
  if (q.length < 2) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("gspn_modelos")
    .select("modelo, familia, categoria, qtd_os, qtd_entregues, qtd_reparadas")
    .ilike("modelo", `%${q}%`)
    .order("qtd_reparadas", { ascending: false })
    .limit(15);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
