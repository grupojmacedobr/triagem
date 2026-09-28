import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/usuarios";

/** Busca quem está logado + o perfil dele na tabela usuarios. */
export async function carregarPerfil(): Promise<{ userId: string | null; perfil: Perfil }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, perfil: null };

  const { data } = await supabase
    .from("usuarios")
    .select("nome, sobrenome, cargo, is_master")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, perfil: data };
}
