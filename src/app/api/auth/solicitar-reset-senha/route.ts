import { NextResponse } from "next/server";
import { createAdminClient, temChaveSecreta } from "@/lib/supabase/server";

/**
 * "Esqueci minha senha" (tela de login, ninguém logado): só registra o
 * pedido para um administrador ver na tela Usuários e resetar.
 * Responde sempre a mesma mensagem, exista ou não o login digitado,
 * pra não revelar quais logins existem.
 */
export async function POST(request: Request) {
  const respostaGenerica = NextResponse.json({
    ok: true,
    mensagem: "Se esse usuário existir, avisamos o administrador. Aguarde o contato dele.",
  });

  const body = await request.json().catch(() => null);
  const login = typeof body?.usuario === "string" ? body.usuario.trim().toLowerCase() : "";
  if (!login || !temChaveSecreta()) return respostaGenerica;

  const admin = createAdminClient();
  const { data: alvo } = await admin.from("usuarios").select("id, bloqueado_em").eq("usuario", login).maybeSingle();
  if (!alvo || alvo.bloqueado_em) return respostaGenerica;

  const { data: pendente } = await admin
    .from("solicitacoes_reset_senha")
    .select("id")
    .eq("usuario_id", alvo.id)
    .eq("status", "pendente")
    .limit(1);

  if (!pendente || pendente.length === 0) {
    await admin.from("solicitacoes_reset_senha").insert({ usuario_id: alvo.id });
  }

  return respostaGenerica;
}
