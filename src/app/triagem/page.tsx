import AppShell from "@/components/AppShell";
import TriagemPainel from "@/components/TriagemPainel";
import { carregarPerfil } from "@/lib/perfil";

export default async function TriagemPage() {
  const { perfil } = await carregarPerfil();
  return (
    <AppShell titulo="Triagem" perfil={perfil}>
      <TriagemPainel />
    </AppShell>
  );
}
