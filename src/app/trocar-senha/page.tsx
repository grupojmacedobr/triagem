import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TrocarSenhaForm from "@/components/TrocarSenhaForm";

export default async function TrocarSenhaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="login-escuro min-h-screen w-full flex items-center justify-center bg-tri-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-tri-border bg-tri-panel/70 backdrop-blur-sm shadow-2xl px-8 py-10">
        <h1 className="text-lg font-semibold text-white text-center mb-2">Defina sua nova senha</h1>
        <p className="text-xs text-tri-silver/60 text-center mb-8">
          Este é seu primeiro acesso (ou uma senha temporária foi definida para você). Por segurança, crie uma
          nova senha com pelo menos 8 caracteres antes de continuar.
        </p>
        <TrocarSenhaForm />
      </div>
    </main>
  );
}
