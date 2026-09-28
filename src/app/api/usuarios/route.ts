import { NextResponse } from "next/server";
import { CARGOS, SENHA_PADRAO, gerarUsuario, usuarioParaEmailTecnico } from "@/lib/auth";
import { exigirGestorDeUsuarios } from "@/lib/api";

/**
 * Cadastro de usuário:
 * - só Administrador, Diretor ou Gerente
 * - gera o login (nome.sobrenome) sem repetir
 * - cria o acesso no Supabase com a senha padrão
 * - cria o perfil em public.usuarios com troca de senha obrigatória
 */
export async function POST(request: Request) {
  const checagem = await exigirGestorDeUsuarios("cadastrar usuários");
  if (!checagem.ok) return checagem.resposta;
  const { admin } = checagem;

  const body = await request.json();
  const nome = (body.nome || "").trim();
  const sobrenome = (body.sobrenome || "").trim();
  const email = (body.email || "").trim();
  const telefone = (body.telefone || "").trim();
  const cargo = body.cargo;
  const usuarioDesejado = (body.usuario || "").trim().toLowerCase();

  if (!nome || !sobrenome || !email || !cargo) {
    return NextResponse.json({ error: "Preencha nome, sobrenome, e-mail e cargo." }, { status: 400 });
  }
  if (!(CARGOS as readonly string[]).includes(cargo)) {
    return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
  }

  const base = usuarioDesejado || gerarUsuario(nome, sobrenome);
  let usuarioFinal = base;
  let sufixo = 1;
  while (true) {
    const { data: existente } = await admin.from("usuarios").select("id").eq("usuario", usuarioFinal).maybeSingle();
    if (!existente) break;
    sufixo += 1;
    usuarioFinal = `${base}${sufixo}`;
  }

  const { data: novo, error: authError } = await admin.auth.admin.createUser({
    email: usuarioParaEmailTecnico(usuarioFinal),
    password: SENHA_PADRAO,
    email_confirm: true,
  });

  if (authError || !novo?.user) {
    return NextResponse.json({ error: authError?.message || "Não foi possível criar o acesso." }, { status: 400 });
  }

  const { error: perfilError } = await admin.from("usuarios").insert({
    id: novo.user.id,
    nome,
    sobrenome,
    usuario: usuarioFinal,
    email,
    telefone,
    cargo,
    must_change_password: true,
    is_master: false,
  });

  if (perfilError) {
    await admin.auth.admin.deleteUser(novo.user.id); // desfaz o login se o perfil falhou
    return NextResponse.json({ error: perfilError.message }, { status: 400 });
  }

  return NextResponse.json({ usuario: usuarioFinal, senhaTemporaria: SENHA_PADRAO });
}
