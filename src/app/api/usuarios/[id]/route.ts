import { NextResponse } from "next/server";
import { CARGOS, usuarioParaEmailTecnico } from "@/lib/auth";
import { exigirGestorDeUsuarios } from "@/lib/api";

// Edita o cadastro (nome, sobrenome, e-mail, telefone, cargo e login).
// Se o login mudar, atualiza também o e-mail técnico do Supabase.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const checagem = await exigirGestorDeUsuarios("editar usuários");
  if (!checagem.ok) return checagem.resposta;
  const { admin, perfil } = checagem;

  const { data: alvo } = await admin.from("usuarios").select("id, usuario, is_master").eq("id", params.id).maybeSingle();
  if (!alvo) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if (alvo.is_master && !perfil.is_master) {
    return NextResponse.json({ error: "Só um Administrador pode alterar outro Administrador." }, { status: 403 });
  }

  const body = await request.json();
  const nome = (body.nome || "").trim();
  const sobrenome = (body.sobrenome || "").trim();
  const email = (body.email || "").trim();
  const telefone = (body.telefone || "").trim();
  const cargo = body.cargo;
  const usuarioDesejado = (body.usuario || "").trim().toLowerCase();

  if (!nome || !sobrenome || !email || !cargo || !usuarioDesejado) {
    return NextResponse.json({ error: "Preencha nome, sobrenome, e-mail, cargo e usuário." }, { status: 400 });
  }
  if (!(CARGOS as readonly string[]).includes(cargo)) {
    return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
  }

  if (usuarioDesejado !== alvo.usuario) {
    const { data: existente } = await admin
      .from("usuarios")
      .select("id")
      .eq("usuario", usuarioDesejado)
      .neq("id", alvo.id)
      .maybeSingle();
    if (existente) return NextResponse.json({ error: "Esse usuário (login) já está em uso." }, { status: 409 });

    const { error: authError } = await admin.auth.admin.updateUserById(alvo.id, {
      email: usuarioParaEmailTecnico(usuarioDesejado),
      email_confirm: true,
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data, error } = await admin
    .from("usuarios")
    .update({ nome, sobrenome, email, telefone, cargo, usuario: usuarioDesejado })
    .eq("id", alvo.id)
    .select("id, nome, sobrenome, usuario, email, telefone, cargo, is_master")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
