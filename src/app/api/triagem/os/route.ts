import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { traduzirPeca } from "@/lib/pecas";
import type { PecaOS } from "@/lib/gspn";

const CAMPOS =
  "os, asc_code, asc_nome, modelo, categoria, categoria_gspn, status, data_solicitacao, reparo_finalizado, garantia, tipo_defeito, sintoma, defeito, reparacao, codigo_reparo, pecas";

/** Detalhes das OS da base GSPN (para abrir ao clicar). { ids: string[] } — até 200 por vez. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ids: string[] = (Array.isArray(body?.ids) ? body.ids : []).map((x: unknown) => String(x)).filter(Boolean).slice(0, 200);
  if (!ids.length) return NextResponse.json({ os: [] });

  const { data, error } = await supabase.from("gspn_os").select(CAMPOS).in("os", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ordem = new Map(ids.map((id, i) => [id, i]));
  const os = (data ?? [])
    .map((r) => ({
      ...r,
      pecas: ((r.pecas as PecaOS[]) || []).map((p) => {
        const t = traduzirPeca(p.d, r.categoria || "");
        return { ...p, t: t.grupo, n: t.nome };
      }),
    }))
    .sort((a, b) => (ordem.get(a.os) ?? 0) - (ordem.get(b.os) ?? 0));
  return NextResponse.json({ os });
}
