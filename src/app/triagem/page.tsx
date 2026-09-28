import AppShell from "@/components/AppShell";
import TriagemPainel from "@/components/TriagemPainel";
import { carregarPerfil } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS } from "@/lib/gspn";

export default async function TriagemPage() {
  const { perfil } = await carregarPerfil();
  const supabase = createClient();
  // categorias do Cadastro Categorias (se a tabela ainda não existir, usa a lista padrão)
  const { data } = await supabase.from("categorias").select("sigla, nome").order("ordem");
  const lista = data && data.length ? data : CATEGORIAS;
  return (
    <AppShell titulo="Triagem" perfil={perfil}>
      <TriagemPainel listaCategorias={lista} />
    </AppShell>
  );
}
