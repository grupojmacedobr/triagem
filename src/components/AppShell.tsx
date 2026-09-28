"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardCheck, Database, Home, LogOut, Menu, ShieldCheck, SlidersHorizontal, Tags, UserPlus, Users, X, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil } from "@/lib/usuarios";
import Avatar from "@/components/Avatar";
import BotaoTema from "@/components/BotaoTema";
import ColorPickerSistema from "@/components/ColorPickerSistema";
import InactivityGuard from "@/components/InactivityGuard";
import LogoTriagem from "@/components/LogoTriagem";

type ItemMenu = { href: string; label: string; icone: typeof Home; emBreve?: boolean };

const ITENS_PRINCIPAIS: ItemMenu[] = [
  { href: "/dashboard", label: "Início", icone: Home },
  { href: "/triagem", label: "Triagem", icone: ClipboardCheck },
];

type GrupoMenu = { id: string; label: string; icone: typeof Home; itens: ItemMenu[] };

const GRUPOS: GrupoMenu[] = [
  {
    id: "configuracoes",
    label: "Configurações",
    icone: SlidersHorizontal,
    itens: [
      { href: "/configuracoes/base-gspn", label: "Base GSPN", icone: Database },
      { href: "/configuracoes/categorias", label: "Cadastro Categorias", icone: Tags },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icone: ShieldCheck,
    itens: [
      { href: "/usuarios", label: "Usuários", icone: Users },
      { href: "/usuarios/novo", label: "Novo usuário", icone: UserPlus },
    ],
  },
];

const ESTILO_ATIVO = {
  background: "var(--surface2)",
  color: "var(--ink)",
  boxShadow: "inset 3px 0 0 var(--accent2)",
};

/** Moldura de todas as telas internas: menu lateral + barra do topo. */
export default function AppShell({
  titulo,
  perfil,
  children,
}: {
  titulo: string;
  perfil: Perfil;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GRUPOS.map((g) => [g.id, g.itens.some((i) => pathname?.startsWith(i.href))]))
  );

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  const nomeCompleto = perfil ? `${perfil.nome} ${perfil.sobrenome}` : "";
  const cargoExibido = perfil?.is_master ? "Administrador" : perfil?.cargo || "";

  function LinkMenu({ item, sub = false }: { item: ItemMenu; sub?: boolean }) {
    const Icone = item.icone;
    const ativo = pathname === item.href;
    if (item.emBreve) {
      return (
        <span
          className={`flex items-center gap-2.5 px-3 ${sub ? "py-2" : "py-2.5"} rounded-lg text-sm cursor-not-allowed opacity-60`}
          style={{ color: "var(--muted)" }}
          title="Em construção"
        >
          <Icone size={sub ? 15 : 17} />
          {item.label}
          <span
            className="ml-auto text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
            style={{ background: "var(--surface2)", color: "var(--accent2)" }}
          >
            em breve
          </span>
        </span>
      );
    }
    return (
      <Link
        href={item.href}
        onClick={() => setMenuAberto(false)}
        className={`flex items-center gap-2.5 px-3 ${sub ? "py-2" : "py-2.5"} rounded-lg text-sm transition hover:bg-[var(--surface2)]`}
        style={ativo ? ESTILO_ATIVO : { color: "var(--muted)" }}
      >
        <Icone size={sub ? 15 : 17} />
        {item.label}
      </Link>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)" }}>
      <InactivityGuard />

      {menuAberto && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMenuAberto(false)} />
      )}

      {/* menu lateral */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col border-r transition-transform duration-200 md:translate-x-0 ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-5">
          <Link href="/dashboard" onClick={() => setMenuAberto(false)} className="flex-1 min-w-0">
            <LogoTriagem className="w-full max-w-[190px] h-auto" />
          </Link>
          <button
            type="button"
            onClick={() => setMenuAberto(false)}
            className="md:hidden shrink-0 ml-2"
            style={{ color: "var(--muted)" }}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {ITENS_PRINCIPAIS.map((item) => (
            <LinkMenu key={item.href} item={item} />
          ))}

          {GRUPOS.map((g) => {
            const Icone = g.icone;
            const aberto = abertos[g.id];
            return (
              <div key={g.id} className="pt-1">
                <button
                  type="button"
                  onClick={() => setAbertos((a) => ({ ...a, [g.id]: !a[g.id] }))}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition hover:bg-[var(--surface2)]"
                  style={{ color: "var(--muted)" }}
                >
                  <Icone size={17} />
                  {g.label}
                  <ChevronDown size={15} className={`ml-auto transition-transform ${aberto ? "rotate-180" : ""}`} />
                </button>
                {aberto && (
                  <div className="mt-1 ml-4 pl-3 border-l space-y-1" style={{ borderColor: "var(--line)" }}>
                    {g.itens.map((item) => (
                      <LinkMenu key={item.href} item={item} sub />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t space-y-1" style={{ borderColor: "var(--line)" }}>
          <BotaoTema comTexto />
          <button
            type="button"
            onClick={sair}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <LogOut size={17} />
            Sair
          </button>
        </div>
      </aside>

      {/* área principal */}
      <div className="md:pl-64">
        <header
          className="h-16 flex items-center gap-3 px-4 md:px-6 border-b sticky top-0 z-20"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className="md:hidden"
            style={{ color: "var(--muted)" }}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <h1 className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
            {titulo}
          </h1>

          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-2.5 pr-1">
            <Avatar nome={nomeCompleto} tamanho={32} />
            <div className="leading-tight">
              <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                {nomeCompleto || "—"}
              </p>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {cargoExibido}
              </p>
            </div>
          </div>

          <ColorPickerSistema />
          <BotaoTema />
        </header>

        <main className="px-4 md:px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
