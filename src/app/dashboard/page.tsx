import Link from "next/link";
import { ClipboardCheck, Database, Palette, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import { carregarPerfil } from "@/lib/perfil";

const CARDS: { href: string | null; label: string; descricao: string; icone: typeof Users; cor: string; corClara: string }[] = [
  {
    href: "/triagem",
    label: "Triagem",
    descricao: "Informe o modelo, a categoria e o defeito: o sistema mostra as peças mais usadas em reparos parecidos.",
    icone: ClipboardCheck,
    cor: "#2563eb",
    corClara: "#60a5fa",
  },
  {
    href: "/usuarios",
    label: "Usuários",
    descricao: "Cadastrar, editar, bloquear e resetar a senha de quem acessa o sistema.",
    icone: Users,
    cor: "#059669",
    corClara: "#34d399",
  },
  {
    href: "/configuracoes/base-gspn",
    label: "Base GSPN",
    descricao: "Subir a planilha GSPN que abastece a Triagem com o histórico de reparos.",
    icone: Database,
    cor: "#0891b2",
    corClara: "#22d3ee",
  },
  {
    href: null,
    label: "Aparência",
    descricao: "Use o sol/lua no topo para alternar entre o tema azul e o claro, e a paleta para mudar a cor.",
    icone: Palette,
    cor: "#7c3aed",
    corClara: "#a78bfa",
  },
];

export default async function DashboardPage() {
  const { perfil } = await carregarPerfil();
  const primeiroNome = perfil?.nome ?? "";

  return (
    <AppShell titulo="Início" perfil={perfil}>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        {primeiroNome ? `Olá, ${primeiroNome}!` : "Painel inicial"}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Bem-vindo ao Sistema de Triagem do Grupo J.Macedo. As telas vão sendo adicionadas conforme forem definidas.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => {
          const Icone = card.icone;
          const conteudo = (
            <>
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: `linear-gradient(90deg, ${card.cor}, ${card.corClara})` }}
              />
              <div className="flex items-center gap-3 mb-2">
                <Icone size={26} strokeWidth={2} style={{ color: card.cor }} />
                <h2 className="font-medium" style={{ color: "var(--ink)" }}>
                  {card.label}
                </h2>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                {card.descricao}
              </p>
            </>
          );
          const estilo = {
            background: "linear-gradient(155deg, var(--surface2), var(--surface))",
            boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 22px rgba(0,0,0,0.18), 0 3px 8px rgba(0,0,0,0.12)",
            border: "1px solid var(--line)",
          };
          const classe = "relative rounded-xl pt-5 px-5 pb-5 overflow-hidden";
          return card.href ? (
            <Link key={card.label} href={card.href} className={`${classe} transition-transform hover:-translate-y-1`} style={estilo}>
              {conteudo}
            </Link>
          ) : (
            <div key={card.label} className={classe} style={estilo}>
              {conteudo}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
