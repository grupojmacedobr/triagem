/**
 * Endereço e chave PÚBLICA do Supabase (projeto "triagem").
 * Essas duas podem ficar no código sem problema: são as mesmas que o
 * navegador de qualquer pessoa enxerga. Se um dia mudar de projeto,
 * basta cadastrar NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * na Vercel que elas passam por cima destes valores.
 *
 * A chave SECRETA (SUPABASE_SERVICE_ROLE_KEY) NUNCA fica aqui — só na
 * Vercel (Settings > Environment Variables).
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pfjhbmxrpjrzuxtbcadb.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_jh0K2xgFQBfXqqG7xDtiQg_DSKAuZNM";
