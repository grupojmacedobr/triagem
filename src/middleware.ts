import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

/**
 * Porteiro do sistema (roda antes de cada página):
 * - sem login -> manda para /login
 * - já logado abrindo /login -> manda para /dashboard
 * - senha temporária (must_change_password) -> obriga /trocar-senha
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // "Esqueci minha senha" é chamado sem ninguém logado
  const isPublic = path === "/login" || path === "/api/auth/solicitar-reset-senha";
  const isTrocarSenha = path === "/trocar-senha";

  if (!user && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && !isTrocarSenha && !path.startsWith("/api/")) {
    const { data: perfil } = await supabase
      .from("usuarios")
      .select("must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (perfil?.must_change_password) {
      const url = request.nextUrl.clone();
      url.pathname = "/trocar-senha";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // ignora arquivos estáticos (imagens, ícones) para não travar o carregamento deles
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
