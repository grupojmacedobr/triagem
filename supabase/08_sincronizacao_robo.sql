-- =====================================================================
--  SISTEMA DE TRIAGEM | Grupo J.Macedo
--  Instalação 08: SINCRONIZAÇÃO AUTOMÁTICA COM O ROBÔ GSPN (via Inventário)
--
--  A Triagem passa a buscar sozinha a base de OS de cada unidade que o
--  robô salva no OneDrive (AUTOMAÇÃO\ROBÔ - ...\BASE DE DADOS) e o
--  Sistema de Inventário disponibiliza na rota /api/integracao/base-os.
--
--  - gspn_sincronizacao: 1 linha por unidade do robô — qual versão da
--    base já foi lida, onde parou (página), contadores e último erro.
--  - Só o servidor grava (chave secreta). Usuário logado só lê.
--
--  Rodar DEPOIS do 07. Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists public.gspn_sincronizacao (
  unidade_id text primary key,             -- id da unidade no Inventário
  asc_code text,
  nome text,
  base_atualizada_em text,                 -- data da base no robô (já lida)
  enviado_em timestamptz,                  -- versão da base já lida (envio do robô)
  alvo_enviado_em timestamptz,             -- versão sendo lida agora
  desde date,                              -- null = base inteira; senão só OS alteradas desde esta data
  pagina integer not null default 0,       -- 0 = parada; >0 = próxima página a buscar
  paginas integer,
  total integer,
  linhas integer not null default 0,
  entregues integer not null default 0,
  novos integer not null default 0,
  atualizados integer not null default 0,
  iguais integer not null default 0,
  importacao_id uuid references public.gspn_importacoes (id) on delete set null,
  ultima_ok timestamptz,                   -- última sincronização concluída
  ultima_completa timestamptz,             -- última vez que leu a base inteira
  ultimo_erro text,
  erro_em timestamptz,
  atualizado_em timestamptz not null default now()
);

alter table public.gspn_sincronizacao enable row level security;
drop policy if exists "gspn_sincronizacao_select" on public.gspn_sincronizacao;
create policy "gspn_sincronizacao_select" on public.gspn_sincronizacao for select to authenticated using (true);
revoke insert, update, delete on public.gspn_sincronizacao from authenticated, anon;

-- Conferência (deve mostrar 1 linha com ok = 1)
select 'tabela gspn_sincronizacao criada' as item,
       (to_regclass('public.gspn_sincronizacao') is not null)::int as ok;
