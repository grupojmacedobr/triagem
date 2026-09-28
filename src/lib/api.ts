import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createClient, MENSAGEM_SEM_CHAVE_SECRETA, temChaveSecreta } from "@/lib/supabase/server";
import { podeGerenciarUsuarios } from "@/lib/usuarios";

type Resultado =
  | { ok: true; userId: string; admin: SupabaseClient; perfil: { cargo: string; is_master: boolean } }
  | { ok: false; resposta: NextResponse };

/**
 * Confere, no servidor, se quem chamou está logado e pode gerenciar
 * usuários (Administrador, Diretor ou Gerente). Devolve o cliente admin.
 */
export async function exigirGestorDeUsuarios(acao: string): Promise<Resultado> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, resposta: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (!temChaveSecreta()) {
    return { ok: false, resposta: NextResponse.json({ error: MENSAGEM_SEM_CHAVE_SECRETA }, { status: 500 }) };
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).maybeSingle();

  if (!perfil || !podeGerenciarUsuarios(perfil)) {
    return {
      ok: false,
      resposta: NextResponse.json({ error: `Seu cargo não tem permissão para ${acao}.` }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, admin, perfil };
}
