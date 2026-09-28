/**
 * O Supabase exige e-mail para login, mas no sistema a pessoa entra com
 * "nome.sobrenome". Então cada usuário ganha um e-mail técnico interno
 * (nome.sobrenome@jmacedo.internal) só para o Supabase. O e-mail de
 * contato de verdade fica em public.usuarios.email.
 */
export const AUTH_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || "jmacedo.internal";

/** Remove acentos, espaços e símbolos. Ex: "João" -> "joao" */
export function slugifyNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

/** Ex: "João" + "Silva Santos" -> "joao.silvasantos" */
export function gerarUsuario(nome: string, sobrenome: string): string {
  const n = slugifyNome(nome);
  const s = slugifyNome(sobrenome);
  return s ? `${n}.${s}` : n;
}

export function usuarioParaEmailTecnico(usuario: string): string {
  const limpo = usuario.trim().toLowerCase();
  return limpo.includes("@") ? limpo : `${limpo}@${AUTH_EMAIL_DOMAIN}`;
}

/** Senha inicial de todo usuário novo (troca obrigatória no 1º acesso). */
export const SENHA_PADRAO = "Triagem001";

export const CARGOS = [
  "Diretor",
  "Gerente",
  "Supervisor",
  "Técnico",
  "Triagem",
  "Operacional",
  "Estoque",
] as const;

export type Cargo = (typeof CARGOS)[number];
