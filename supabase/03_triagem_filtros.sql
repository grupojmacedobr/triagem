-- =====================================================================
--  SISTEMA DE TRIAGEM | Grupo J.Macedo
--  Instalação 03: busca em VÁRIAS categorias ao mesmo tempo
--                 + sugestões de defeito enquanto digita
--
--  Rodar DEPOIS do 02_gspn.sql. Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Busca da Triagem (nova versão: aceita várias categorias)
drop function if exists public.triagem_buscar(text, text, text, text[]);
drop function if exists public.triagem_buscar(text[], text, text, text[]);

create function public.triagem_buscar(
  p_categorias text[],
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

grant execute on function public.triagem_buscar(text[], text, text, text[]) to authenticated;

-- 2) Sugestões de defeito enquanto digita.
--    Pega as descrições cadastradas, corta a "sujeira" administrativa
--    (NF anexada, taxa, visitas, R$, contato...) e junta as iguais
--    (ex: "NÃO LIGA", "NAO LIGA" e "NÃO LIGANF ANEXADA" viram uma só).
drop function if exists public.triagem_sugerir_defeitos(text, text[]);
create function public.triagem_sugerir_defeitos(
  p_texto text,          -- o que foi digitado, já sem acento e sem espaço
  p_categorias text[]
) returns table (texto text, qtd int)
language sql
stable
security invoker
set search_path = public
as $$
  with limpo as (
    select trim(both ' -/.,;:[]*' from regexp_replace(
             upper(g.defeito),
             '(\s-\s|NF\s*(VALID|ANEX|EM\s*ANEX|APRES|OK|ENVIAD)|\d+\s*VISITA|VISITAS?\M|TAXA|RRR|R\$|CONTATO|CLIENTE|PAGOU|VENDID|OR[CÇ]AMENTO|OS\s*ANTIGA|\(|NOTA\s*FISCAL|PRODUTO\s*(SEM|OK)|TX\s*PAG|\*|SEGUIR\s*COM|COBRAR|APROVAD|GARANTIA).*$',
             '', 'i')) as texto
    from public.gspn_os g
    where g.reparado
      and g.defeito is not null
      and g.defeito_busca like '%' || p_texto || '%'
      and (coalesce(cardinality(p_categorias), 0) = 0 or g.categoria = any (p_categorias))
  ),
  agrupado as (
    select texto,
           lower(translate(texto, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')) as chave
    from limpo
    where length(texto) between 3 and 60
  )
  select mode() within group (order by texto) as texto, count(*)::int as qtd
  from agrupado
  where replace(regexp_replace(chave, '[^a-z0-9]+', '', 'g'), ' ', '') like '%' || p_texto || '%'
  group by regexp_replace(chave, '[^a-z0-9]+', ' ', 'g')
  having count(*) >= 2
  order by (min(chave) like replace(p_texto, ' ', '') || '%') desc, count(*) desc
  limit 8;
$$;

grant execute on function public.triagem_sugerir_defeitos(text, text[]) to authenticated;

-- Conferência: deve listar sugestões para "nao liga" em TV
select * from public.triagem_sugerir_defeitos('naoliga', array['DTV']);
