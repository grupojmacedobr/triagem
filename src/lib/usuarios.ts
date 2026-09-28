export type Perfil = {
  nome: string;
  sobrenome: string;
  cargo: string;
  is_master: boolean;
} | null;

/** Cargos que podem cadastrar, editar, bloquear e resetar senha (além do Administrador). */
export const CARGOS_GESTAO_USUARIOS = ["Gerente", "Diretor"] as const;

export function podeGerenciarUsuarios(perfil: { cargo: string; is_master: boolean } | null): boolean {
  if (!perfil) return false;
  if (perfil.is_master) return true;
  return (CARGOS_GESTAO_USUARIOS as readonly string[]).includes(perfil.cargo);
}
