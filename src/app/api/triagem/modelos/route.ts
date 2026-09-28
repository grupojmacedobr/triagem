import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CAMPOS = "modelo, familia, categoria, qtd_os, qtd_entregues, qtd_reparadas";

/** Sugestões de SKU desde a 1ª letra: primeiro os que COMEÇAM com o texto, depois os que CONTÊM. */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toUpperCase().replace(/[%_,()*]/g, "") || "";
  const categorias = (url.searchParams.get("categorias") || "").split(",").filter(Boolean);
  if (q.length < 1) return NextResponse.json([]);

  const consulta = (padrao: string, limite: number) => {
    let c = supabase.from("gspn_modelos").select(CAMPOS).ilike("modelo", padrao);
    if (categorias.length) c = c.in("categoria", categorias);
    return c.order("qtd_reparadas", { ascending: false }).limit(limite);
  };

  const { data: comeca, error } = await consulta(`${q}%`, 15);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let lista = comeca ?? [];
  if (lista.length < 15 && q.length >= 2) {
    const { data: contem } = await consulta(`%${q}%`, 15);
    const vistos = new Set(lista.map((m) => m.modelo));
    lista = [...lista, ...(contem ?? []).filter((m) => !vistos.has(m.modelo))].slice(0, 15);
  }
  return NextResponse.json(lista);
}
