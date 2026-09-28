-- =====================================================================
--  SISTEMA DE TRIAGEM | Grupo J.Macedo
--  Instalação 01: usuários, cargos, bloqueio e "esqueci minha senha"
--  (mesma estrutura do Sistema Allied)
--
--  Como usar: Supabase > SQL Editor > New query > colar TUDO > Run.
--  Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- 1) Perfil de cada pessoa com acesso (id = auth.users.id)
create table if not exists public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  sobrenome text not null,
  usuario text not null unique,          -- login no padrão nome.sobrenome
  email text not null,                   -- e-mail de contato de verdade
  telefone text,
  cargo text not null,
  is_master boolean not null default false,          -- Administrador
  must_change_password boolean not null default true,-- troca obrigatória no 1º acesso
  bloqueado_em timestamptz,
  bloqueado_por uuid references public.usuarios (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists usuarios_set_updated_at on public.usuarios;
create trigger usuarios_set_updated_at
  before update on public.usuarios
  for each row execute function public.set_updated_at();

alter table public.usuarios enable row level security;

-- qualquer pessoa logada pode LER a lista (tela Usuários)
drop policy if exists "usuarios_select_autenticados" on public.usuarios;
create policy "usuarios_select_autenticados"
  on public.usuarios for select to authenticated using (true);

-- cada pessoa só atualiza a PRÓPRIA linha...
drop policy if exists "usuarios_update_proprio" on public.usuarios;
create policy "usuarios_update_proprio"
  on public.usuarios for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ...e só a coluna must_change_password (ninguém vira Administrador sozinho).
-- Cadastro/edição/bloqueio passam pelo servidor, com a chave secreta.
revoke insert, update, delete on public.usuarios from authenticated, anon;
grant update (must_change_password) on public.usuarios to authenticated;

-- 2) Pedidos de "Esqueci minha senha" feitos na tela de login
create table if not exists public.solicitacoes_reset_senha (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'atendida')),
  criado_em timestamptz not null default now(),
  atendido_por uuid references public.usuarios (id),
  atendido_em timestamptz
);

create index if not exists solicitacoes_reset_senha_pendente_idx
  on public.solicitacoes_reset_senha (usuario_id) where status = 'pendente';

alter table public.solicitacoes_reset_senha enable row level security;

drop policy if exists "solicitacoes_reset_senha_select_autenticados" on public.solicitacoes_reset_senha;
create policy "solicitacoes_reset_senha_select_autenticados"
  on public.solicitacoes_reset_senha for select to authenticated using (true);

revoke insert, update, delete on public.solicitacoes_reset_senha from authenticated, anon;

-- 3) Transforma o login que já existe (manuel.bastos) em ADMINISTRADOR.
--    Nome e sobrenome podem ser corrigidos depois pela tela Usuários.
insert into public.usuarios (id, nome, sobrenome, usuario, email, cargo, is_master, must_change_password)
select u.id, 'Manuel', 'Bastos', 'manuel.bastos', u.email, 'Diretor', true, false
from auth.users u
where u.email = 'manuel.bastos@jmacedo.internal'
on conflict (id) do update set is_master = true;

-- Conferência: deve aparecer o manuel.bastos como Administrador
select usuario, nome, sobrenome, cargo, is_master as administrador from public.usuarios;
