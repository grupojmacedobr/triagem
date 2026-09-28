import { NextResponse } from "next/server";
import { exigirGestorDeUsuarios } from "@/lib/api";

// Bloqueia ou desbloqueia o login (não apaga o cadastro nem o histórico).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const checagem = await exigirGestorDeUsuarios("bloquear usuários");
  if (!checagem.ok) return checagem.resposta;
  const { admin, perfil, userId } = checagem;

  if (params.id === userId) {
    return NextResponse.json({ error: "Você não pode bloquear o próprio usuário." }, { status: 400 });
  }

  const { data: alvo } = await admin.from("usuarios").select("id, is_master").eq("id", params.id).maybeSingle();
  if (!alvo) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if (alvo.is_master && !perfil.is_master) {
    return NextResponse.json({ error: "Só um Administrador pode bloquear outro Administrador." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const bloquear = body.bloquear !== false;

  const { error: authError } = await admin.auth.admin.updateUserById(alvo.id, {
    ban_duration: bloquear ? "876000h" : "none", // ~100 anos = até desbloquear
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const { data, error } = await admin
    .from("usuarios")
    .update({ bloqueado_em: bloquear ? new Date().toISOString() : null, bloqueado_por: bloquear ? userId : null })
    .eq("id", alvo.id)
    .select("id, bloqueado_em")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
