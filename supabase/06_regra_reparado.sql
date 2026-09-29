-- =====================================================================
--  SISTEMA DE TRIAGEM | Grupo J.Macedo
--  Instalação 06: nova regra de "OS reparada" (usada na Triagem)
--
--  Reparada = status Produto Entregue
--             E código de reparo (coluna BB) NÃO começa com X
--               (X = saiu sem conserto: cancelado, orçamento recusado, sem defeito...)
--             E tem peça lançada OU código de reparo começando com A
--
--  Rodar DEPOIS do 05. Pode rodar mais de uma vez.
-- =====================================================================

-- 1) A regra fica no banco: toda OS gravada já sai com "reparado" certo
create or replace function public.gspn_os_definir_reparado()
returns trigger language plpgsql set search_path = public as $$
begin
  new.reparado := coalesce(new.entregue, false)
                  and coalesce(upper(new.codigo_reparo), '') !~ '^X'
                  and (coalesce(new.qtd_pecas, 0) > 0 or coalesce(upper(new.codigo_reparo), '') ~ '^A');
  return new;
end;
$$;

drop trigger if exists gspn_os_reparado_trg on public.gspn_os;
create trigger gspn_os_reparado_trg
  before insert or update on public.gspn_os
  for each row execute function public.gspn_os_definir_reparado();

-- 2) Recalcula as OS que já estão na base
update public.gspn_os
   set reparado = coalesce(entregue, false)
                  and coalesce(upper(codigo_reparo), '') !~ '^X'
                  and (coalesce(qtd_pecas, 0) > 0 or coalesce(upper(codigo_reparo), '') ~ '^A')
 where reparado is distinct from (
         coalesce(entregue, false)
         and coalesce(upper(codigo_reparo), '') !~ '^X'
         and (coalesce(qtd_pecas, 0) > 0 or coalesce(upper(codigo_reparo), '') ~ '^A')
       );

-- Conferência: reparadas por letra do código de reparo
select coalesce(left(upper(codigo_reparo), 1), '(vazio)') as codigo, count(*) as entregues,
       count(*) filter (where reparado) as reparadas_usadas_na_triagem
from public.gspn_os where entregue
group by 1 order by 2 desc;
