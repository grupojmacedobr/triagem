import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/AppShell";
import CadastroCategorias from "@/components/CadastroCategorias";
import { carregarPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { podeImportarBase } from "@/lib/usuarios";
import type { CategoriaResumo, ModeloSemCategoria, RegraCategoria } from "@/lib/categorias";

export default async function CadastroCategoriasPage() {
  const { perfil } = await carregarPerfil();
  const supabase = createClient();

  const [resumo, regras, semCategoria, usuarios, semModelo] = await Promise.all([
    supabase.from("categoria_resumo").select("*").order("ordem"),
    supabase.from("categoria_regras").select("id, prefixo, categoria, criado_em, criado_por").order("prefixo"),
    supabase.from("modelos_sem_categoria").select("*").order("os", { ascending: false }).limit(300),
    supabase.from("usuarios").select("id, nome, sobrenome"),
    // OS sem modelo (UNKNOWN / "-"): não têm como ganhar categoria
    supabase
      .from("gspn_os")
      .select("os", { count: "exact", head: true })
      .eq("categoria", "OUT")
      .or("modelo.is.null,modelo.eq.,modelo.eq.-,modelo.ilike.UNKNOWN*"),
  ]);

  const nomesUsuarios = Object.fromEntries((usuarios.data ?? []).map((u) => [u.id, `${u.nome} ${u.sobrenome}`]));
  const faltaSql = !!resumo.error;

  return (
    <AppShell titulo="Cadastro Categorias" perfil={perfil}>
      <Link href="/configuracoes" className="inline-flex items-center gap-1.5 text-xs hover:opacity-80 mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} /> Voltar para Configurações
      </Link>
      {faltaSql ? (
        <div className="rounded-xl border p-5 text-sm text-amber-500" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
          Falta rodar o arquivo <strong>supabase/04_categorias_aprendizado.sql</strong> no Supabase (SQL Editor).
        </div>
      ) : (
        <CadastroCategorias
          categorias={(resumo.data ?? []) as CategoriaResumo[]}
          regras={(regras.data ?? []) as RegraCategoria[]}
          semCategoria={(semCategoria.data ?? []) as ModeloSemCategoria[]}
          nomesUsuarios={nomesUsuarios}
          osSemModelo={semModelo.count ?? 0}
          podeEditar={podeImportarBase(perfil)}
        />
      )}
    </AppShell>
  );
}
