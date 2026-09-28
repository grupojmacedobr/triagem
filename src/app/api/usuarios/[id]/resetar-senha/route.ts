import { NextResponse } from "next/server";
import { SENHA_PADRAO } from "@/lib/auth";
import { exigirGestorDeUsuarios } from "@/lib/api";

// Volta a senha para a padrão e obriga a troca no próximo acesso.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const checagem = await exigirGestorDeUsuarios("resetar senha de usuários");
  if (!checagem.ok) return checagem.resposta;
  const { admin, perfil, userId } = checagem;

  const { data: alvo } = await admin.from("usuarios").select("id, usuario, is_master").eq("id", params.id).maybeSingle();
  if (!alvo) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if (alvo.is_master && !perfil.is_master) {
    return NextResponse.json({ error: "Só um Administrador pode resetar a senha de outro Administrador." }, { status: 403 });
  }

  const { error: authError } = await admin.auth.admin.updateUserById(alvo.id, { password: SENHA_PADRAO });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  await admin.from("usuarios").update({ must_change_password: true }).eq("id", alvo.id);

  // pedido de "esqueci minha senha" pendente dessa pessoa fica resolvido
  await admin
    .from("solicitacoes_reset_senha")
    .update({ status: "atendida", atendido_por: userId, atendido_em: new Date().toISOString() })
    .eq("usuario_id", alvo.id)
    .eq("status", "pendente");

  return NextResponse.json({ usuario: alvo.usuario, senhaTemporaria: SENHA_PADRAO });
}
