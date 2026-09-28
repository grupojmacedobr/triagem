import Link from "next/link";
import { Database, Tags } from "lucide-react";
import AppShell from "@/components/AppShell";
import { carregarPerfil } from "@/lib/perfil";

const TILES = [
  {
    href: "/configuracoes/base-gspn",
    titulo: "Base GSPN",
    descricao: "Subir a planilha GSPN que abastece a Triagem (ordens de serviço, defeitos e peças usadas).",
    icone: Database,
    cor: "#2563eb",
    clara: "#60a5fa",
  },
  {
    href: "/configuracoes/categorias",
    titulo: "Cadastro Categorias",
    descricao: "Dizer a categoria dos modelos (ex.: tudo que começa com WF é Lava e Seca) e acompanhar o que ainda está em Outros.",
    icone: Tags,
    cor: "#7c3aed",
    clara: "#a78bfa",
  },
];

export default async function ConfiguracoesPage() {
  const { perfil } = await carregarPerfil();
  return (
    <AppShell titulo="Configurações" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Escolha uma opção.
      </p>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl">
        {TILES.map((t) => {
          const Icone = t.icone;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="relative rounded-xl pt-5 px-5 pb-5 overflow-hidden transition-transform hover:-translate-y-1"
              style={{
                background: "linear-gradient(155deg, var(--surface2), var(--surface))",
                boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                border: "1px solid var(--line)",
              }}
            >
              <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${t.cor}, ${t.clara})` }} />
              <div className="flex items-center gap-3 mb-2">
                <Icone size={26} style={{ color: t.cor }} />
                <span className="text-lg font-bold" style={{ color: "var(--ink)" }}>
                  {t.titulo}
                </span>
              </div>
              <p className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>
                {t.descricao}
              </p>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
