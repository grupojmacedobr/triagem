import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

// Força toda consulta a ir direto no banco (sem cache do Next.js),
// senão a tela pode mostrar dado antigo depois de uma alteração.
function fetchSemCache(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: "no-store" });
}

/** Cliente Supabase para páginas e rotas do servidor, usando a sessão do cookie. */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch: fetchSemCache },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // chamado a partir de uma página: ignorado, o middleware renova a sessão
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // idem
        }
      },
    },
  });
}

export const MENSAGEM_SEM_CHAVE_SECRETA =
  "A chave secreta do Supabase (SUPABASE_SERVICE_ROLE_KEY) ainda não foi cadastrada na Vercel. Cadastre em Settings > Environment Variables e faça um novo deploy.";

export function temChaveSecreta(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Cliente com a chave SECRETA — só roda no servidor (cadastro de usuário,
 * reset de senha, bloqueio). Nunca é enviado pro navegador.
 */
export function createAdminClient() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error(MENSAGEM_SEM_CHAVE_SECRETA);
  return createSupabaseClient(SUPABASE_URL, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchSemCache },
  });
}
