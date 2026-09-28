-- =====================================================================
--  SISTEMA DE TRIAGEM | Grupo J.Macedo
--  Instalação 02: Base GSPN (ordens de serviço) + busca da Triagem
--
--  Como usar: Supabase > SQL Editor > New query > colar TUDO > Run.
--  Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- 1) Histórico de importações da planilha GSPN
create table if not exists public.gspn_importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo text not null,
  linhas integer not null default 0,
  entregues integer not null default 0,
  status text not null default 'em andamento' check (status in ('em andamento', 'concluida', 'erro')),
  criado_por uuid references public.usuarios (id),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

-- 2) Uma linha por Ordem de Serviço (SO Nro.). Reimportar a mesma OS atualiza.
create table if not exists public.gspn_os (
  os text primary key,                 -- B  SO Nro.
  asc_code text,                       -- D
  asc_nome text,                       -- E  (loja)
  modelo text,                         -- J  SKU completo
  familia text,                        -- modelo "agrupado" (sem cor/região)
  categoria_gspn text,                 -- BH Service Product Description
  categoria text,                      -- sigla: DTV, HHP, WSM, REF, ACN, NPC, CKT, MON, OUT
  status text,                         -- M
  entregue boolean not null default false,  -- status = Produto Entregue
  data_solicitacao date,               -- Q
  reparo_finalizado date,              -- AB
  garantia text,                       -- AL
  tipo_defeito text,                   -- AM
  sintoma text,                        -- AY Código de Sintoma (iris)
  defeito text,                        -- AU Descrição do defeito (original)
  defeito_busca text,                  -- defeito normalizado e sem espaços (usado na busca)
  reparacao text,                      -- AT Descrição Reparação
  codigo_reparo text,                  -- BB Código de Reparo (A.. = reparo feito, X.. = sem reparo)
  reparado boolean not null default false,  -- entregue E (tem peça OU código de reparo A..)
  pecas jsonb not null default '[]',   -- [{c: código, d: descrição, t: tipo, q: qtd}]
  qtd_pecas smallint not null default 0,
  importacao_id uuid references public.gspn_importacoes (id) on delete set null,
  atualizado_em timestamptz not null default now()
);

-- (para quem rodou uma versão anterior deste SQL)
alter table public.gspn_os add column if not exists codigo_reparo text;
alter table public.gspn_os add column if not exists reparado boolean not null default false;

drop index if exists public.gspn_os_categoria_idx;
create index if not exists gspn_os_categoria_rep_idx on public.gspn_os (categoria) where reparado;
create index if not exists gspn_os_modelo_idx on public.gspn_os (modelo);
create index if not exists gspn_os_familia_idx on public.gspn_os (familia);

alter table public.gspn_os enable row level security;
alter table public.gspn_importacoes enable row level security;

drop policy if exists "gspn_os_select" on public.gspn_os;
create policy "gspn_os_select" on public.gspn_os for select to authenticated using (true);
drop policy if exists "gspn_importacoes_select" on public.gspn_importacoes;
create policy "gspn_importacoes_select" on public.gspn_importacoes for select to authenticated using (true);

-- escrita só pelo servidor (tela Configurações > Base GSPN)
revoke insert, update, delete on public.gspn_os from authenticated, anon;
revoke insert, update, delete on public.gspn_importacoes from authenticated, anon;

-- 3) Lista de modelos (SKU) para o campo com sugestões da Triagem
drop view if exists public.gspn_modelos;
create view public.gspn_modelos with (security_invoker = on) as
select modelo, familia, categoria, count(*)::int as qtd_os,
       count(*) filter (where entregue)::int as qtd_entregues,
       count(*) filter (where reparado)::int as qtd_reparadas
from public.gspn_os
where modelo is not null and modelo <> '' and modelo not ilike 'UNKNOWN%'
group by modelo, familia, categoria;

-- 4) Busca da Triagem.
--    Recebe os "grupos" de palavras do defeito (cada grupo = variantes
--    separadas por |, já sem acento/espaço) e devolve, numa resposta só,
--    as OS ENTREGUES E REPARADAS que batem em pelo menos um grupo, marcando quais
--    grupos bateram (mascara) e o nível: 2 = mesmo modelo,
--    1 = mesma família, 0 = mesma categoria.
create or replace function public.triagem_buscar(
  p_categoria text,
  p_modelo text,
  p_familia text,
  p_grupos text[]
) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select g.os, g.pecas,
           case when g.modelo = p_modelo then 2 when g.familia = p_familia then 1 else 0 end as nivel,
           (
             select coalesce(sum(1 << (i - 1)), 0)::int
             from generate_subscripts(p_grupos, 1) as i
             where exists (
               select 1 from unnest(string_to_array(p_grupos[i], '|')) as v
               where v <> '' and g.defeito_busca like '%' || v || '%'
             )
           ) as mascara
    from public.gspn_os g
    where g.reparado
      and (g.categoria = p_categoria or g.modelo = p_modelo or (p_familia <> '' and g.familia = p_familia))
  ),
  totais as (
    select count(*) filter (where nivel = 2)::int as n_modelo,
           count(*) filter (where nivel >= 1)::int as n_familia,
           count(*)::int as n_categoria
    from base
  )
  select jsonb_build_object(
    'totais', (select to_jsonb(t) from totais t),
    'casos', coalesce((
      select jsonb_agg(jsonb_build_array(b.os, b.nivel, b.mascara, b.pecas))
      from base b where b.mascara > 0
    ), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_array(b.nivel, b.pecas, b.os))
      from base b where b.nivel >= 1 and jsonb_array_length(b.pecas) > 0
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.triagem_buscar(text, text, text, text[]) to authenticated;

-- Conferência
select 'gspn_os' as tabela, count(*) as linhas from public.gspn_os
union all
select 'gspn_importacoes', count(*) from public.gspn_importacoes;
