/** Regras de formato do Cadastro Categorias (usadas na tela e no servidor). */
export const SIGLA_VALIDA = /^[A-Z0-9]{2,6}$/;
/** Começo de modelo: letras, números, "-", "/" e "." (sem % e _ para não virar curinga). */
export const PREFIXO_VALIDO = /^[A-Z0-9][A-Z0-9\-/.]{0,29}$/;

export function limparPrefixo(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/\s+/g, "").trim();
}

export type CategoriaResumo = { sigla: string; nome: string; ordem: number; modelos: number; os: number; reparadas: number; regras: number };
export type RegraCategoria = { id: string; prefixo: string; categoria: string; criado_em: string; criado_por: string | null };
export type ModeloSemCategoria = { prefixo: string; modelos: number; os: number; exemplos: string[]; descricao_gspn: string | null };
