import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/AppShell";
import UserForm from "@/components/UserForm";
import { carregarPerfil } from "@/lib/perfil";
import { podeGerenciarUsuarios } from "@/lib/usuarios";
import { SENHA_PADRAO } from "@/lib/auth";

export default async function NovoUsuarioPage() {
  const { perfil } = await carregarPerfil();
  const pode = podeGerenciarUsuarios(perfil);

  return (
    <AppShell titulo="Novo usuário" perfil={perfil}>
      <Link href="/usuarios" className="inline-flex items-center gap-1.5 text-xs hover:opacity-80 mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} />
        Voltar para usuários
      </Link>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Novo usuário
      </h1>

      {pode ? (
        <>
          <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
            O usuário (login) é sugerido a partir do nome e sobrenome. A senha inicial é sempre{" "}
            <strong style={{ color: "var(--ink)" }}>{SENHA_PADRAO}</strong> e a troca é obrigatória no primeiro acesso.
          </p>
          <UserForm />
        </>
      ) : (
        <p className="text-sm mt-4" style={{ color: "var(--muted)" }}>
          Só Administrador, Diretor ou Gerente podem cadastrar usuários.
        </p>
      )}
    </AppShell>
  );
}
