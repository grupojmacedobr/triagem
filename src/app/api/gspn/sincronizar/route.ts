import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { exigirPermissao } from "@/lib/api";
import { podeImportarBase } from "@/lib/usuarios";
import { createAdminClient, temChaveSecreta } from "@/lib/supabase/server";
import {
  integracaoConfigurada,
  lerEstados,
  listarUnidadesRobo,
  MENSAGEM_SEM_CHAVE_INVENTARIO,
  reiniciarSincronizacao,
  sincronizarPasso,
  situacao,
} from "@/lib/sincronizarRobo";

/**
 * Sincronização com o robô GSPN (via Inventário).
 *
 * GET  -> chamado pela Vercel 1 vez por dia (vercel.json > crons). Só aceita com a senha CRON_SECRET.
 * POST -> tela Configurações > Base GSPN (precisa estar logado e poder importar a base):
 *   { acao: "status" }       -> lista das unidades do robô e como está cada uma
 *   { acao: "sincronizar" }  -> faz um pedaço (~40 s); a tela chama de novo enquanto "pendente"
 *   { acao: "reiniciar" }    -> na próxima sincronização relê a base inteira de todas as unidades
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function senhaCronOk(request: Request): boolean {
  const certa = process.env.CRON_SECRET || "";
  const recebida = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (certa.length < 16 || !recebida) return false;
  const a = Buffer.from(recebida);
  const b = Buffer.from(certa);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!senhaCronOk(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!temChaveSecreta()) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  if (!integracaoConfigurada()) return NextResponse.json({ error: MENSAGEM_SEM_CHAVE_INVENTARIO }, { status: 500 });
  try {
    const r = await sincronizarPasso(createAdminClient(), { prazoMs: 50000 });
    return NextResponse.json({ ok: true, pendente: r.pendente, mensagens: r.mensagens });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const checagem = await exigirPermissao(podeImportarBase, "sincronizar a Base GSPN");
  if (!checagem.ok) return checagem.resposta;
  const { admin, userId } = checagem;

  const body = await request.json().catch(() => null);
  const acao = body?.acao;

  if (!integracaoConfigurada()) {
    return NextResponse.json({ configurado: false, error: MENSAGEM_SEM_CHAVE_INVENTARIO, unidades: [] }, { status: acao === "status" ? 200 : 400 });
  }

  try {
    if (acao === "status") {
      const [lista, estados] = await Promise.all([listarUnidadesRobo(), lerEstados(admin)]);
      const unidades = lista.map((u) => {
        const estado = estados.get(u.unidade_id) ?? null;
        return { unidade: u, estado, situacao: situacao(u, estado ?? undefined) };
      });
      return NextResponse.json({ configurado: true, unidades, cronAtivo: !!process.env.CRON_SECRET });
    }
    if (acao === "sincronizar") {
      const r = await sincronizarPasso(admin, { prazoMs: 42000, criadoPor: userId });
      return NextResponse.json({ configurado: true, ...r });
    }
    if (acao === "reiniciar") {
      await reiniciarSincronizacao(admin);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ configurado: true, error: e instanceof Error ? e.message : String(e), unidades: [] }, { status: 400 });
  }
}
