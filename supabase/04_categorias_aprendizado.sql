-- =====================================================================
--  SISTEMA DE TRIAGEM | Grupo J.Macedo
--  Instalação 04: Cadastro de Categorias + aprendizado automático
--                 + importação econômica (pula OS iguais) + unidades
--
--  Rodar DEPOIS do 03. Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Categorias (lista editável na tela Configurações > Cadastro Categorias)
create table if not exists public.categorias (
  sigla text primary key check (sigla ~ '^[A-Z0-9]{2,6}$'),
  nome text not null,
  ordem integer not null default 100,
  criado_em timestamptz not null default now()
);

insert into public.categorias (sigla, nome, ordem) values
  ('DTV', 'Televisores', 10), ('HHP', 'Celulares', 20), ('WSM', 'Lava e Seca', 30),
  ('REF', 'Refrigeradores', 40), ('ACN', 'Ar Condicionado', 50), ('NPC', 'Notebooks', 60),
  ('MON', 'Monitores', 70), ('CKT', 'Cooktop / Coifa', 80), ('AV', 'Áudio e Vídeo (Soundbar / Home Theater)', 90),
  ('DW', 'Lava-louças', 100), ('FOR', 'Fornos', 110), ('OUT', 'Outros', 999)
on conflict (sigla) do nothing;

-- 2) Regras: "modelo que começa com ... é da categoria ..."
create table if not exists public.categoria_regras (
  id uuid primary key default gen_random_uuid(),
  prefixo text not null unique check (prefixo = upper(prefixo) and length(prefixo) >= 1),
  categoria text not null references public.categorias (sigla) on update cascade,
  criado_por uuid references public.usuarios (id),
  criado_em timestamptz not null default now()
);

alter table public.categorias enable row level security;
alter table public.categoria_regras enable row level security;
drop policy if exists "categorias_select" on public.categorias;
create policy "categorias_select" on public.categorias for select to authenticated using (true);
drop policy if exists "categoria_regras_select" on public.categoria_regras;
create policy "categoria_regras_select" on public.categoria_regras for select to authenticated using (true);
revoke insert, update, delete on public.categorias from authenticated, anon;
revoke insert, update, delete on public.categoria_regras from authenticated, anon;

-- 3) Novas colunas da base GSPN
alter table public.gspn_os add column if not exists categoria_auto text;   -- o que a planilha (coluna BH) diz
alter table public.gspn_os add column if not exists hash text;             -- "impressão digital" da linha: igual = não regrava
alter table public.gspn_importacoes add column if not exists novos integer not null default 0;
alter table public.gspn_importacoes add column if not exists atualizados integer not null default 0;
alter table public.gspn_importacoes add column if not exists iguais integer not null default 0;

-- código da unidade sem zeros à esquerda (Santos vem "0003197760")
update public.gspn_os set asc_code = ltrim(asc_code, '0') where asc_code like '0%';
create index if not exists gspn_os_asc_code_idx on public.gspn_os (asc_code);
create index if not exists gspn_os_categoria_idx on public.gspn_os (categoria);

-- 4) Coluna BH (Service Product Description) -> sigla
create or replace function public.categoria_por_descricao(p_bh text)
returns text language sql immutable as $$
  select case
    when p_bh is null or btrim(p_bh) = '' then 'OUT'
    when upper(p_bh) like '%MONITOR%' then 'MON'
    when upper(p_bh) like '%MICROLED%' or upper(p_bh) like '%PROJECTOR%' then 'DTV'
    when upper(p_bh) like '%TV%' or upper(p_bh) like '%DISPLAY%' or upper(p_bh) like '%LFD%' then 'DTV'
    when upper(p_bh) like 'HHP%' then 'HHP'
    when upper(p_bh) like '%DISHWASHER%' then 'DW'
    when upper(p_bh) like '%WASHING%' or upper(p_bh) like '%DRYER%' then 'WSM'
    when upper(p_bh) like '%REFRIGERATOR%' or upper(p_bh) like '%WINE%' then 'REF'
    when upper(p_bh) like '%AIR CONDITIONER%' or upper(p_bh) like 'SAC%' or upper(p_bh) like 'RAM%' then 'ACN'
    when upper(p_bh) like '%NOTE PC%' or upper(p_bh) like '%NOTEBOOK%' then 'NPC'
    when upper(p_bh) like '%COOKTOP%' or upper(p_bh) like '%COIFA%' then 'CKT'
    when upper(p_bh) like '%HTS%' or upper(p_bh) like '%SOUNDBAR%' or upper(p_bh) like '%AUDIO%' then 'AV'
    when upper(p_bh) like '%FORNO%' or upper(p_bh) like '%OVEN%' or upper(p_bh) like '%MICROWAVE%' then 'FOR'
    else 'OUT'
  end;
$$;

-- 4b) "Começo" do modelo (letras iniciais): UN75TU7000 -> UN, SM-A155 -> SM-A, F-QN65 -> F-QN
create or replace function public.prefixo_modelo(p_modelo text)
returns text language sql immutable as $$
  select coalesce(nullif(substring(upper(coalesce(p_modelo, '')) from '^[A-Z]+-?[A-Z]*'), ''), left(upper(coalesce(p_modelo, '')), 3));
$$;
create index if not exists gspn_os_prefixo_idx on public.gspn_os (public.prefixo_modelo(modelo));

-- 5) Decide a categoria de uma OS:
--    regra cadastrada (a mais específica)  >  planilha (BH)  >  aprendido (mesmo modelo / mesma família /
--    mesmo começo de modelo, quando 90%+ das OS desse começo são de uma categoria só)  >  Outros
create or replace function public.categoria_resolvida(p_modelo text, p_familia text, p_auto text)
returns text language plpgsql stable set search_path = public as $$
declare
  r text;
begin
  if coalesce(p_modelo, '') <> '' then
    select cr.categoria into r
    from categoria_regras cr
    where upper(p_modelo) like cr.prefixo || '%'
    order by length(cr.prefixo) desc
    limit 1;
    if r is not null then return r; end if;
  end if;

  if p_auto is not null and p_auto <> 'OUT' then return p_auto; end if;

  if coalesce(p_modelo, '') not in ('', '-') and p_modelo not ilike 'UNKNOWN%' then
    select g.categoria_auto into r from gspn_os g
    where g.modelo = p_modelo and g.categoria_auto <> 'OUT'
    group by g.categoria_auto order by count(*) desc limit 1;
    if r is not null then return r; end if;

    if coalesce(p_familia, '') <> '' then
      select g.categoria_auto into r from gspn_os g
      where g.familia = p_familia and g.categoria_auto <> 'OUT'
      group by g.categoria_auto order by count(*) desc limit 1;
      if r is not null then return r; end if;
    end if;

    -- mesmo começo de modelo (ex.: tudo que começa com UN é TV), só se for quase unânime
    select x.cat into r from (
      select g.categoria_auto as cat, count(*) as n, sum(count(*)) over () as total
      from gspn_os g
      where public.prefixo_modelo(g.modelo) = public.prefixo_modelo(p_modelo) and g.categoria_auto <> 'OUT'
      group by g.categoria_auto
    ) x
    where x.n >= 20 and x.n >= 0.9 * x.total
    order by x.n desc limit 1;
    if r is not null then return r; end if;
  end if;

  return 'OUT';
end;
$$;

-- 6) Gatilho: toda OS gravada já sai com a categoria certa
create or replace function public.gspn_os_definir_categoria()
returns trigger language plpgsql set search_path = public as $$
begin
  new.categoria_auto := categoria_por_descricao(new.categoria_gspn);
  new.categoria := categoria_resolvida(new.modelo, new.familia, new.categoria_auto);
  return new;
end;
$$;

drop trigger if exists gspn_os_categoria_trg on public.gspn_os;
create trigger gspn_os_categoria_trg
  before insert or update of modelo, familia, categoria_gspn on public.gspn_os
  for each row execute function public.gspn_os_definir_categoria();

-- 7) Reaplica as categorias (usado ao criar/apagar regra e ao fim de cada importação)
--    p_prefixo = null -> só as OS que estão em Outros (aprendizado)
--    p_prefixo = ''   -> TODAS as OS
--    p_prefixo = 'HW-' -> só modelos que começam com HW-
create or replace function public.aplicar_categorias(p_prefixo text default null)
returns integer language plpgsql set search_path = public as $$
declare
  n integer;
begin
  update gspn_os g
     set categoria_auto = coalesce(g.categoria_auto, categoria_por_descricao(g.categoria_gspn)),
         categoria = x.nova
    from (
      select os, categoria_resolvida(modelo, familia, coalesce(categoria_auto, categoria_por_descricao(categoria_gspn))) as nova
      from gspn_os
      where case
              when p_prefixo is null then categoria = 'OUT' or categoria_auto is null
              when p_prefixo = '' then true
              else upper(modelo) like upper(p_prefixo) || '%'
            end
    ) x
   where g.os = x.os
     and (g.categoria is distinct from x.nova or g.categoria_auto is null);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.aplicar_categorias(text) from public, anon, authenticated;

-- 8) Resumo por categoria (tela Cadastro Categorias e Base GSPN)
create or replace view public.categoria_resumo with (security_invoker = on) as
select c.sigla, c.nome, c.ordem,
       coalesce(x.modelos, 0)::int as modelos,
       coalesce(x.os, 0)::int as os,
       coalesce(x.reparadas, 0)::int as reparadas,
       (select count(*)::int from public.categoria_regras r where r.categoria = c.sigla) as regras
from public.categorias c
left join (
  select categoria, count(distinct modelo) as modelos, count(*) as os, count(*) filter (where reparado) as reparadas
  from public.gspn_os group by categoria
) x on x.categoria = c.sigla;

-- 9) Modelos que ainda estão em Outros, agrupados pelo começo do modelo
create or replace view public.modelos_sem_categoria with (security_invoker = on) as
select public.prefixo_modelo(modelo) as prefixo,
       count(distinct modelo)::int as modelos,
       count(*)::int as os,
       (array_agg(distinct modelo))[1:4] as exemplos,
       max(categoria_gspn) as descricao_gspn
from public.gspn_os
where categoria = 'OUT'
  and coalesce(modelo, '') not in ('', '-')
  and modelo not ilike 'UNKNOWN%'
group by 1;

-- 10) Unidades (lojas) — guardado para análises futuras
create or replace view public.gspn_unidades with (security_invoker = on) as
select asc_code, max(asc_nome) as asc_nome, count(*)::int as os,
       count(*) filter (where reparado)::int as reparadas,
       min(data_solicitacao) as primeira_os, max(data_solicitacao) as ultima_os
from public.gspn_os
where coalesce(asc_code, '') <> ''
group by asc_code;

-- 11) Uso do banco (plano gratuito = 500 MB)
create or replace function public.uso_banco()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total_bytes', pg_database_size(current_database()),
    'gspn_bytes', pg_total_relation_size('public.gspn_os'),
    'limite_bytes', 500 * 1024 * 1024
  );
$$;
revoke execute on function public.uso_banco() from public, anon;
grant execute on function public.uso_banco() to authenticated;

-- 12) Reclassifica tudo o que já foi importado
select public.aplicar_categorias('') as os_reclassificadas;

-- Conferência
select sigla, nome, modelos, os from public.categoria_resumo order by ordem;
