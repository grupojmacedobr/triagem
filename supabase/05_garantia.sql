-- =====================================================================
--  SISTEMA DE TRIAGEM | Grupo J.Macedo
--  Instalação 05: filtro de GARANTIA na Triagem (coluna AL do GSPN)
--                 LP = em garantia · OW = fora de garantia
--
--  Rodar DEPOIS do 04. Pode rodar mais de uma vez.
-- =====================================================================

-- índice para o filtro
create index if not exists gspn_os_garantia_idx on public.gspn_os (garantia) where reparado;

-- Busca da Triagem com filtro de garantia.
--   p_garantias = null  -> todas (LP, OW e as sem informação)
--   p_garantias = '{LP}' -> só em garantia
--   p_garantias = '{OW}' -> só fora de garantia
drop function if exists public.triagem_buscar(text[], text, text, text[]);
drop function if exists public.triagem_buscar(text[], text, text, text[], text[]);

create function public.triagem_buscar(
  p_categorias text[],
  p_modelo text,
  p_familia text,
  p_grupos text[],
  p_garantias text[] default null
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
      and (p_garantias is null or upper(g.garantia) = any (p_garantias))
      and (g.categoria = any (coalesce(p_categorias, '{}')) or g.modelo = p_modelo or (p_familia <> '' and g.familia = p_familia))
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

grant execute on function public.triagem_buscar(text[], text, text, text[], text[]) to authenticated;

-- Conferência: OS reparadas por garantia
select coalesce(nullif(garantia, ''), '(vazio)') as garantia, count(*) as reparadas
from public.gspn_os where reparado group by 1 order by 2 desc;
