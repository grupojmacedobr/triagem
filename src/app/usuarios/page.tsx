import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import TabelaUsuarios from "@/components/TabelaUsuarios";
import PainelSolicitacoesResetSenha, { type SolicitacaoResetSenhaLinha } from "@/components/PainelSolicitacoesResetSenha";
import { podeGerenciarUsuarios } from "@/lib/usuarios";
import { carregarPerfil } from "@/lib/perfil";

export default async function UsuariosPage() {
  const supabase = createClient();
  const { userId, perfil } = await carregarPerfil();

  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("id, nome, sobrenome, usuario, email, telefone, cargo, is_master, must_change_password, bloqueado_em")
    .order("nome", { ascending: true });

  const podeGerenciar = podeGerenciarUsuarios(perfil);

  let solicitacoesPendentes: SolicitacaoResetSenhaLinha[] = [];
  if (podeGerenciar) {
    const { data: pendentes } = await supabase
      .from("solicitacoes_reset_senha")
      .select("id, criado_em, usuario_id")
      .eq("status", "pendente")
      .order("criado_em", { ascending: true });

    if (pendentes && pendentes.length > 0) {
      const mapa = new Map((usuarios ?? []).map((u) => [u.id, u]));
      solicitacoesPendentes = pendentes.flatMap((p) => {
        const dono = mapa.get(p.usuario_id);
        if (!dono) return [];
        return [
          { id: p.id, criado_em: p.criado_em, usuario_id: p.usuario_id, nome: dono.nome, sobrenome: dono.sobrenome, usuario: dono.usuario },
        ];
      });
    }
  }

  return (
    <AppShell titulo="Usuários" perfil={perfil}>
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
          Não consegui ler a lista de usuários ({error.message}). Confira se o SQL de instalação já foi rodado no Supabase.
        </p>
      )}

      <PainelSolicitacoesResetSenha solicitacoes={solicitacoesPendentes} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {usuarios?.length ?? 0} usuário(s) cadastrado(s)
        </p>
        {podeGerenciar && (
          <Link
            href="/usuarios/novo"
            className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] text-white text-sm font-medium px-4 py-2.5 transition"
            style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
          >
            + Novo usuário
          </Link>
        )}
      </div>

      <TabelaUsuarios usuarios={usuarios ?? []} podeGerenciar={podeGerenciar} souMaster={!!perfil?.is_master} meuId={userId ?? ""} />
    </AppShell>
  );
}
