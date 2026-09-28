import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/AppShell";
import ImportarGspn from "@/components/ImportarGspn";
import { carregarPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { podeImportarBase } from "@/lib/usuarios";
import { CATEGORIAS } from "@/lib/gspn";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

export default async function BaseGspnPage() {
  const { perfil } = await carregarPerfil();
  const supabase = createClient();

  const contar = async (filtro?: (q: any) => any) => {
    let q = supabase.from("gspn_os").select("os", { count: "exact", head: true });
    if (filtro) q = filtro(q);
    const { count } = await q;
    return count ?? 0;
  };

  const [total, entregues, comPeca, porCategoria, importacoes] = await Promise.all([
    contar(),
    contar((q) => q.eq("entregue", true)),
    contar((q) => q.eq("reparado", true)),
    Promise.all(CATEGORIAS.map(async (c) => ({ ...c, qtd: await contar((q) => q.eq("reparado", true).eq("categoria", c.sigla)) }))),
    supabase
      .from("gspn_importacoes")
      .select("id, arquivo, linhas, entregues, status, criado_em, criado_por")
      .order("criado_em", { ascending: false })
      .limit(10),
  ]);

  const { data: usuarios } = await supabase.from("usuarios").select("id, nome, sobrenome");
  const nomeUsuario = new Map((usuarios ?? []).map((u) => [u.id, `${u.nome} ${u.sobrenome}`]));
  const pode = podeImportarBase(perfil);

  const cards = [
    { rotulo: "OS na base", valor: total },
    { rotulo: "Produto Entregue", valor: entregues },
    { rotulo: "Reparadas (usadas na Triagem)", valor: comPeca },
  ];

  return (
    <AppShell titulo="Base GSPN" perfil={perfil}>
      <Link href="/configuracoes" className="inline-flex items-center gap-1.5 text-xs hover:opacity-80 mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} /> Voltar para Configurações
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.rotulo} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              {c.rotulo}
            </p>
            <p className="text-2xl font-semibold mt-1" style={{ color: "var(--ink)" }}>
              {c.valor.toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {pode ? (
          <ImportarGspn />
        ) : (
          <div className="rounded-xl border p-5 text-sm" style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--muted)" }}>
            Só Administrador, Diretor, Gerente ou Supervisor podem importar a Base GSPN.
          </div>
        )}

        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
          <h2 className="font-semibold mb-3" style={{ color: "var(--ink)" }}>
            Reparadas por categoria
          </h2>
          <div className="space-y-2">
            {porCategoria.map((c) => (
              <div key={c.sigla} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--muted)" }}>
                  <strong style={{ color: "var(--ink)" }}>{c.sigla}</strong> · {c.nome}
                </span>
                <span style={{ color: "var(--ink)" }}>{c.qtd.toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="font-semibold mt-8 mb-3" style={{ color: "var(--ink)" }}>
        Últimas importações
      </h2>
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Arquivo</th>
              <th className="px-4 py-3 font-medium">OS</th>
              <th className="px-4 py-3 font-medium">Entregues</th>
              <th className="px-4 py-3 font-medium">Por</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(importacoes.data ?? []).map((i) => (
              <tr key={i.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{formatarDataHoraBrasilia(i.criado_em)}</td>
                <td className="px-4 py-3" style={{ color: "var(--ink)" }}>{i.arquivo}</td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{(i.linhas ?? 0).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{(i.entregues ?? 0).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{nomeUsuario.get(i.criado_por) ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {i.status === "concluida" ? (
                    <span className="text-emerald-500">Concluída</span>
                  ) : i.status === "erro" ? (
                    <span className="text-red-400">Erro</span>
                  ) : (
                    <span className="text-amber-500">Em andamento</span>
                  )}
                </td>
              </tr>
            ))}
            {(importacoes.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  Nenhuma importação ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
