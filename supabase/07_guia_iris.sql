-- =====================================================================
--  SISTEMA DE TRIAGEM | Grupo J.Macedo
--  Instalação 07: defeito padrão (código IRIS) + guia do triador
--                 + busca por modelo, família, SÉRIE e categoria
--
--  - sintomas_iris: nome amigável e orientação de triagem de cada
--    código de sintoma (coluna AY do GSPN). Ex.: DTV AE1 = Sem imagem.
--  - guia_pecas: o que é cada tipo de peça, por que falha e como
--    confirmar antes de pedir (usado na explicação para o triador).
--  - triagem_buscar: agora também traz as OS da mesma SÉRIE (todas as
--    polegadas / capacidades), o código IRIS de cada OS e o perfil de
--    defeitos do modelo.
--
--  Rodar DEPOIS do 06. Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Série do modelo: UN50TU8000 -> UN**TU8000 (mesma linha, outras polegadas)
create or replace function public.serie_modelo(p_familia text)
returns text language sql immutable as $$
  select case when coalesce(p_familia, '') ~ '^[A-Z]{2}[0-9]{2}[A-Z]'
              then regexp_replace(p_familia, '^([A-Z]{2})[0-9]{2}', '\1**')
              else coalesce(p_familia, '') end;
$$;
create index if not exists gspn_os_serie_idx on public.gspn_os (public.serie_modelo(familia)) where reparado;
create index if not exists gspn_os_sintoma_idx on public.gspn_os (upper(sintoma)) where reparado;

-- 2) Códigos de sintoma IRIS (defeito padrão informado pelo técnico)
create table if not exists public.sintomas_iris (
  categoria text not null,
  codigo text not null,
  nome text not null,
  guia text,                       -- o que perguntar / testar na triagem
  primary key (categoria, codigo)
);
alter table public.sintomas_iris enable row level security;
drop policy if exists "sintomas_iris_select" on public.sintomas_iris;
create policy "sintomas_iris_select" on public.sintomas_iris for select to authenticated using (true);
revoke insert, update, delete on public.sintomas_iris from authenticated, anon;

insert into public.sintomas_iris (categoria, codigo, nome, guia) values
  -- TVs e monitores
  ('DTV','AA1','Não liga','Confirme se o LED de standby acende e se a TV responde ao controle. Sem LED: suspeite da placa de fonte / placa principal. LED aceso e tela preta: teste da lanterna para separar luz de fundo (LED) de painel.'),
  ('DTV','AA3','Liga e desliga','Pergunte se desliga sozinha após alguns segundos ou minutos e se reinicia em ciclo. Na base, a maioria dos reparos foi troca do painel/tela; placa principal vem em seguida.'),
  ('DTV','AA4','Não liga (intermitente)','Verifique se às vezes liga. Teste com outra tomada e sem dispositivos HDMI/USB conectados.'),
  ('DTV','AB8','Sem imagem – sem luz de fundo','Tela totalmente escura com som: faça o teste da lanterna bem perto da tela. Se aparecer imagem fraca, a luz de fundo (barras de LED) está apagada.'),
  ('DTV','AE1','Sem imagem','Confirme se há som, se o menu aparece e faça o teste da lanterna. Imagem fraca com lanterna = barras de LED; nada aparece = painel ou placa principal.'),
  ('DTV','AE3','Linhas na tela','Verifique se as linhas aparecem também no menu da TV (autodiagnóstico > teste de imagem). Se aparecem no teste, o defeito é no painel (Open Cell).'),
  ('DTV','AE4','Linhas na tela (verticais / faixas)','Use o teste de imagem do autodiagnóstico. Linhas fixas em qualquer entrada indicam painel; se mudam ou somem, suspeite da placa principal / T-Con.'),
  ('DTV','AE7','Manchas na tela','Verifique se as manchas são claras (luz de fundo / difusor) ou escuras (painel). Pergunte sobre impacto ou pressão na tela.'),
  ('DTV','AE9','Imagem escura','Imagem aparece mas muito escura: barras de LED fracas ou queimadas são a causa mais comum. Confira brilho e modo econômico antes.'),
  ('DTV','AEN','Imagem distorcida','Veja se a distorção aparece no teste de imagem do autodiagnóstico: se sim, painel; se só em uma entrada, placa principal.'),
  ('DTV','AER','Imagem com falha / cores alteradas','Teste de imagem no autodiagnóstico e em mais de uma entrada.'),
  ('DTV','AG4','Som distorcido','Teste de som no autodiagnóstico. Distorção no teste = alto-falantes ou placa principal.'),
  ('DTV','AM3','Controle remoto não funciona','Troque as pilhas e teste com a câmera do celular se o LED do controle pisca. Teste outro controle: se a TV responde, o defeito é no controle.'),
  ('DTV','TLA','Wi-Fi não funciona','Veja se a rede aparece na lista e se outras redes funcionam. Sem nenhuma rede na lista: módulo Wi-Fi.'),
  ('DTV','CMK','Tela trincada / danificada','Dano físico: registre fotos e confirme cobertura (normalmente fora de garantia).'),
  ('DTV','TBC','Tela trincada (dano físico)','Dano físico: registre fotos e confirme cobertura (normalmente fora de garantia).'),
  ('DTV','AXX','Outros defeitos de imagem / som','Código genérico: leia a descrição do defeito com atenção.'),
  -- Celulares / tablets / relógios
  ('HHP','T9C','Não carrega','Teste com outro cabo e carregador originais, limpe o conector e verifique aviso de umidade. Persistindo: placa de carga (conector USB).'),
  ('HHP','T91','Tela quebrada','Dano físico na tela: normalmente troca da tela completa; a base mostra que muitas vezes a tampa e a bateria vão juntas.'),
  ('HHP','T92','Tampa traseira / câmera quebrada','Verifique vidro da tampa e lente da câmera.'),
  ('HHP','T9B','Tampa traseira descolada','Normalmente troca da tampa ou das fitas de vedação; verifique se a bateria está estufada.'),
  ('HHP','T21','Sem imagem','Verifique se vibra/emite som ao ligar e o consumo de corrente. Vibra sem imagem: tela. Sem consumo: placa principal.'),
  ('HHP','T12','Não liga','Meça o consumo de corrente no carregador. Sem consumo: placa principal / bateria.'),
  ('HHP','T25','Linhas na tela','Linhas ou manchas na tela: troca da tela completa.'),
  ('HHP','T31','Falha de carregamento / conector','Verifique conector, cabo e bateria.'),
  ('HHP','T33','Bateria estufada / descarregando rápido','Bateria estufada é risco: não carregar. Troca da bateria (e da tampa se deformou).'),
  ('HHP','T34','Bateria / tampa','Verifique bateria estufada levantando a tampa.'),
  ('HHP','T71','Touch não funciona','Teste o touch no modo de diagnóstico (*#0*#). Falha no teste: tela completa.'),
  -- Lava e seca
  ('WSM','HLB','Código de erro no display','Anote o código: 4C = entrada de água (torneira, mangueira, válvula); 5C = drenagem (filtro/bomba); dC = porta; 3C = motor; HC = aquecimento; UE/UB = desbalanceamento; LE/LC = vazamento.'),
  ('WSM','MA9','Barulho','Pergunte quando faz barulho: na centrifugação (rolamento, amortecedor, tambor/cruzeta) ou na drenagem (bomba). Verifique objetos no tambor.'),
  ('WSM','HG3','Não drena','Limpe o filtro da bomba e verifique a mangueira de saída. Persistindo com ruído ou sem ruído da bomba: bomba de drenagem.'),
  ('WSM','HG5','Não seca','Verifique se aquece: resistência de secagem, termostato, ventoinha e duto de secagem (entupido por fiapos).'),
  ('WSM','HA1','Não liga','Confira tomada e tensão. Painel apagado: placa principal / placa do painel.'),
  ('WSM','HG1','Vazamento / não lava','Veja por onde vaza: porta (borracha da porta), embaixo (mangueiras, bomba) ou dispenser.'),
  ('WSM','HLH','Trava durante o ciclo','Anote em que etapa trava e se mostra código. Verifique bomba, termostato e sensores.'),
  ('WSM','HLN','Porta travada / não abre','Aguarde o tempo de segurança após o ciclo. Persistindo: trava da porta.'),
  ('WSM','HLE','Barulho na centrifugação','Verifique rolamentos, cruzeta e motor.'),
  ('WSM','HF5','Não dispensa sabão / amaciante','Verifique a gaveta, entupimento e a válvula de entrada de água.'),
  ('WSM','HXX','Outros defeitos','Código genérico: leia a descrição do defeito com atenção.'),
  -- Geladeiras
  ('REF','HE1','Não refrigera','Veja se o compressor funciona e se há gelo acumulado no evaporador. Compressor parado: placa inversora/compressor. Evaporador congelado: degelo (resistência/sensor). Base: filtro secador e compressor são as trocas mais comuns (sistema de gás).'),
  ('REF','HE2','Vazamento / temperatura','Verifique borracha da porta, dreno do degelo e sensores.'),
  ('REF','HE3','Formação de gelo','Gelo no compartimento: vedação da porta, sensor ou resistência de degelo.'),
  ('REF','HF3','Não dispensa água','Verifique filtro de água, válvula de água e tubulação do dispenser (congelada?).'),
  ('REF','HF6','Não produz / não dispensa gelo','Verifique se o fabricador de gelo recebe água e gira. A base mostra troca do fabricador de gelo na grande maioria.'),
  ('REF','HA1','Não liga','Confira tomada e tensão; display apagado: placa principal ou placa do painel.'),
  ('REF','HXX','Outros defeitos','Código genérico: leia a descrição do defeito com atenção.'),
  -- Ar-condicionado
  ('ACN','HE1','Não refrigera','Verifique se a condensadora liga, se há gelo na tubulação e sinais de vazamento. Base: evaporador e condensador (vazamento) são as trocas mais comuns.'),
  ('ACN','HE9','Vazamento de gás','Localize o vazamento (serpentina interna ou externa). Base: condensador e evaporador.'),
  ('ACN','HLB','Código de erro no display','Anote o código: C121/C122 = sensores de temperatura; C154 = motor do ventilador; C163 = EEPROM; C1xx de comunicação = cabos/placas; C4xx = unidade externa (compressor/placa inversora).'),
  ('ACN','MA9','Barulho','Verifique hélice/turbina, suportes e fixações da unidade externa.'),
  ('ACN','HA1','Não liga','Confira alimentação e controle remoto; display apagado: placa principal.'),
  -- Lava-louças / notebooks
  ('DW','HLB','Código de erro no display','Anote o código: tC/HC = sensor de temperatura / aquecimento; 5C = drenagem; 4C = entrada de água.'),
  ('NPC','P11','Desligamento repentino','Verifique se desliga ao retirar o carregador: bateria.')
on conflict (categoria, codigo) do update set nome = excluded.nome, guia = excluded.guia;

-- nome aprendido da base para códigos ainda sem nome (texto mais comum)
create or replace view public.sintomas_aprendidos with (security_invoker = on) as
select categoria, upper(sintoma) as codigo,
       (array_agg(txt order by n desc))[1] as nome_sugerido, sum(n)::int as os
from (
  select categoria, sintoma,
         initcap(lower(trim(regexp_replace(split_part(upper(defeito), ' - ', 1), '(NF |TAXA|R\$|\[|\(|OR[CÇ]AMENTO).*$', '')))) as txt,
         count(*) as n
  from public.gspn_os
  where reparado and coalesce(sintoma, '') <> '' and coalesce(defeito, '') <> ''
  group by 1, 2, 3
) x
where coalesce(txt, '') <> ''
group by 1, 2;

-- 3) Guia das peças: o que é, por que falha, como confirmar
create table if not exists public.guia_pecas (
  categoria text not null default '*',   -- '*' = vale para todas
  grupo text not null,                    -- mesmo "grupo" do tradutor de peças
  o_que_e text,
  por_que text,
  como_confirmar text,
  primary key (categoria, grupo)
);
alter table public.guia_pecas enable row level security;
drop policy if exists "guia_pecas_select" on public.guia_pecas;
create policy "guia_pecas_select" on public.guia_pecas for select to authenticated using (true);
revoke insert, update, delete on public.guia_pecas from authenticated, anon;

insert into public.guia_pecas (categoria, grupo, o_que_e, por_que, como_confirmar) values
  ('DTV','Tela / Painel','O painel (Open Cell / módulo LCD) é a tela que forma a imagem.','Linhas, faixas, manchas, imagem distorcida ou sem imagem mesmo com a luz de fundo acesa indicam painel com defeito. Em Samsung, o painel costuma vir casado com a fita adesiva de fixação.','Abra o autodiagnóstico (Menu > Suporte > Diagnóstico > Teste de imagem). Se o defeito aparece no teste, é painel; faça também o teste da lanterna.'),
  ('DTV','Iluminação da Tela (LED)','Barras de LED que iluminam a tela por trás (luz de fundo).','Quando um LED queima, a série inteira apaga: a TV tem som, mas a tela fica preta ou muito escura.','Teste da lanterna: com a TV ligada, ilumine a tela bem de perto. Se enxergar a imagem fraca, a luz de fundo está apagada (barras de LED ou fonte do LED).'),
  ('DTV','Placa Principal','Placa que processa imagem, som, entradas e o sistema da TV.','Causa: não liga, reinicia, trava no logo, falha em entradas HDMI/USB ou Wi-Fi/controle sem resposta.','Se o LED de standby acende, mas não passa do logo ou reinicia, suspeite da placa principal. Teste sem nada conectado.'),
  ('DTV','Placa de Fonte','Placa que transforma a energia da tomada nas tensões da TV (em muitos modelos também alimenta os LEDs).','Surtos de energia e desgaste de capacitores: a TV não liga (LED apagado) ou liga e desliga.','LED de standby apagado ou piscando sem ligar. O técnico mede as tensões de saída da fonte.'),
  ('DTV','Placa T-Con','Placa que controla o painel (tempo e sinais da imagem).','Linhas finas, imagem duplicada ou cores erradas em todas as entradas.','Imagem ruim também no menu, mas o painel não tem dano visível.'),
  ('DTV','Módulo Wi-Fi','Módulo de rede sem fio (às vezes junto com o receptor do controle).','Sem rede na lista, desconexões ou controle sem resposta (modelos com módulo combinado).','Veja se a TV encontra alguma rede Wi-Fi e se o controle responde.'),
  ('DTV','Controle Remoto','Controle remoto (Smart Control).','Pilhas, quedas ou teclas gastas.','Teste com a câmera do celular se o LED do controle pisca e teste outro controle.'),
  ('DTV','Alto-falante','Alto-falantes internos.','Som rachado ou baixo mesmo no teste de som.','Autodiagnóstico > Teste de som.'),
  ('MON','Tela / Painel','Painel do monitor.','Linhas, manchas ou sem imagem com a luz de fundo acesa.','Teste com outro cabo e outra fonte de vídeo; veja se o menu do monitor aparece com defeito.'),
  ('MON','Placa Principal','Placa principal do monitor.','Não liga, sem sinal ou reinicia.','Menu do monitor não aparece ou não reconhece nenhuma entrada.'),
  ('WSM','Bomba','Bomba que retira a água do tanque (drenagem).','Objetos e fiapos travam ou queimam a bomba: erro 5C/5E, não drena, barulho na drenagem.','Limpe o filtro da bomba (frente, embaixo). Se a água continua sem sair ou a bomba não faz ruído, é a bomba.'),
  ('WSM','Válvula','Válvula de entrada de água.','Não entra água (erro 4C) ou entra sem parar.','Confirme torneira aberta e pressão; sem entrada de água com torneira ok = válvula.'),
  ('WSM','Placa Principal','Placa que controla todo o ciclo da máquina.','Não liga, painel apagado, erros de comunicação ou comandos sem resposta.','Painel apagado com tomada ok, ou erro que volta após reiniciar.'),
  ('WSM','Placa Eletrônica','Placas auxiliares (painel, display, filtros).','Botões sem resposta ou display com falha.','Teste os botões e o display do painel.'),
  ('WSM','Tambor / Tanque','Tambor (cesto), tanque, duto de secagem e cruzeta.','Tambor solto ou raspando, cruzeta quebrada, duto de secagem entupido (não seca).','Gire o tambor com a mão: folga ou ruído metálico indica tambor/cruzeta/rolamento. Não seca: verifique o duto de secagem.'),
  ('WSM','Suspensão / Amortecedor','Amortecedores, molas e contrapesos que seguram o tanque.','Com o tempo perdem a firmeza: barulho e muita vibração na centrifugação.','Empurre o tambor para baixo: deve voltar devagar. Se bate ou balança muito, amortecedores.'),
  ('WSM','Rolamento / Vedação','Rolamentos e retentor do eixo do tambor.','Água passando pelo retentor desgasta o rolamento: ronco alto na centrifugação.','Ruído de "ronco" que aumenta com a velocidade da centrifugação.'),
  ('WSM','Borracha de Vedação','Borracha (gaxeta) da porta.','Rasgos ou objetos presos causam vazamento pela porta.','Inspecione a borracha e verifique vazamento na frente da máquina.'),
  ('WSM','Porta','Trava e interruptor da porta.','Erro dC, porta não trava ou não abre.','A porta fecha mas a máquina não inicia (erro dC) ou não destrava após o ciclo.'),
  ('WSM','Motor','Motor de acionamento (rotor/estator).','Erro 3C, tambor não gira ou gira com falha.','Tambor não gira durante a lavagem/centrifugação com a porta travada.'),
  ('WSM','Termostato','Protetor térmico da secagem.','Abre por superaquecimento (duto entupido): a máquina para de secar.','Não seca e o duto/filtro estava entupido de fiapos.'),
  ('WSM','Sensor','Sensores de temperatura, nível de água e vibração.','Erros de aquecimento, nível ou vibração.','Anote o código de erro exibido.'),
  ('WSM','Resistência','Resistência de aquecimento da água ou da secagem.','Não aquece ou não seca (erro HC).','Não aquece a água ou a roupa sai fria e úmida.'),
  ('WSM','Mangueira','Mangueiras de água, dreno e dispenser.','Vazamentos por baixo ou entupimento.','Verifique vazamento embaixo da máquina.'),
  ('WSM','Dispenser / Gaveta','Gaveta do sabão e amaciante.','Entupimento ou quebra: não puxa o sabão/amaciante.','Verifique resíduos na gaveta após o ciclo.'),
  ('REF','Filtro','Filtro secador do circuito de gás.','É trocado sempre que o sistema de gás é aberto (vazamento, troca de compressor ou evaporador).','Não refrigera por falta de gás: o filtro secador vai junto no reparo.'),
  ('REF','Compressor','Compressor (motor que bombeia o gás).','Não parte, trava ou perde eficiência: não refrigera.','Compressor não liga ou fica quente sem gelar. Técnico confirma com teste de partida.'),
  ('REF','Tampa / Carcaça','Tampas do evaporador e dutos de ar.','Gelo acumulado ou quebra durante o degelo; costuma ser trocada junto com evaporador/sensores.','Gelo acumulado atrás da tampa do freezer.'),
  ('REF','Sensor','Sensores de temperatura e degelo.','Leitura errada: não gela ou forma gelo em excesso.','Formação de gelo ou temperatura errada com compressor funcionando.'),
  ('REF','Fabricador de Gelo','Fabricador de gelo (Ice Maker) e motor do dispenser.','Não gira, não recebe água ou congela.','Não produz ou não dispensa gelo com o freezer gelando bem.'),
  ('REF','Placa Inversora','Placa que controla o compressor inverter.','Compressor não parte: não refrigera.','Painel funciona, mas o compressor não liga.'),
  ('REF','Evaporador','Serpentina que gela o ar dentro da geladeira.','Vazamento de gás ou gelo excessivo.','Não refrigera com vazamento localizado no evaporador.'),
  ('ACN','Evaporador','Serpentina da unidade interna (evaporadora).','Vazamento de gás na serpentina: não refrigera.','Vazamento de gás localizado na unidade interna (espuma/detector).'),
  ('ACN','Condensador','Serpentina da unidade externa (condensadora).','Vazamento de gás ou corrosão: não refrigera.','Vazamento localizado na unidade externa.'),
  ('ACN','Compressor','Compressor da unidade externa.','Não parte ou trava.','Unidade externa liga o ventilador mas o compressor não parte.'),
  ('ACN','Placa Principal','Placa da evaporadora ou da condensadora.','Não liga, erros de comunicação ou sensores.','Anote o código de erro; display apagado com energia ok.'),
  ('ACN','Placa Eletrônica','Placas auxiliares e EEPROM.','Erros de configuração ou comunicação (ex.: C163 EEPROM).','Anote o código de erro exibido.'),
  ('ACN','Placa Inversora','Placa que controla o compressor inverter.','Erros da unidade externa (C4xx).','Unidade externa sem partida com código de erro.'),
  ('ACN','Tubulação','Tubos, válvulas e conexões do gás.','Vazamentos ou obstruções.','Vazamento localizado em tubulação ou válvula.'),
  ('ACN','Ventilador','Hélice/turbina e motor do ventilador.','Barulho, vibração ou não ventila (C154).','Barulho ao girar ou ventilador parado.'),
  ('HHP','Tela / Painel','Tela completa (display + touch), às vezes com aro.','Quedas quebram a tela; também linhas, manchas e touch sem resposta.','Teste o touch e as cores no modo de diagnóstico (*#0*#).'),
  ('HHP','Placa de Carga (USB)','Placa com o conector USB-C, microfone e às vezes antena.','Oxidação, sujeira e desgaste do conector: não carrega.','Teste com cabo e carregador originais após limpar o conector; verifique aviso de umidade.'),
  ('HHP','Bateria','Bateria interna.','Envelhece, estufa ou descarrega rápido.','Bateria estufada levanta a tampa; verifique a saúde da bateria no Samsung Members.'),
  ('HHP','Tampa / Carcaça','Tampa traseira (vidro) e aro.','Quebra por queda; também é trocada quando a vedação é aberta.','Tampa trincada, descolada ou lente da câmera quebrada.'),
  ('HHP','Placa Principal','Placa-mãe do aparelho.','Não liga, sem consumo de corrente, reinicia.','Sem consumo de corrente no carregador com bateria boa.'),
  ('HHP','Câmera','Módulos de câmera.','Foto borrada, preta ou câmera não abre.','Teste cada câmera (principal, ultra-angular, zoom e frontal).'),
  ('HHP','Cabo Flex','Cabos flexíveis entre placas.','Falhas intermitentes após queda ou abertura.','Falha que muda ao pressionar o aparelho.'),
  ('NPC','Bateria','Bateria do notebook.','Desliga ao tirar da tomada ou não segura carga.','Verifique a saúde da bateria e se desliga fora da tomada.'),
  ('*','Placa Principal','Placa principal (controla o aparelho).','Não liga, trava ou erros de controle.','Verifique energia e códigos de erro.'),
  ('*','Placa Eletrônica','Placa eletrônica auxiliar.','Falha em funções específicas (botões, display, sensores).','Teste a função que está com defeito.'),
  ('*','Fita Adesiva','Fitas e adesivos de fixação e vedação.','Material de consumo: vai junto quando a peça principal é trocada (tela, tampa, painel).','Peça pedida junto com a peça principal.'),
  ('*','Tampa / Carcaça','Tampas, gabinete e acabamentos.','Quebra física ou troca junto com outra peça.','Inspeção visual.'),
  ('*','Motor','Motor.','Não gira, ruído ou travamento.','Verifique se gira e se faz ruído.'),
  ('*','Sensor','Sensor.','Leitura errada gera erro ou mau funcionamento.','Anote o código de erro.'),
  ('*','Válvula','Válvula.','Não abre, não fecha ou vaza.','Verifique entrada de água/gás.'),
  ('*','Cabo / Chicote','Cabos e chicotes elétricos.','Mau contato ou rompimento.','Falha intermitente ao mexer no aparelho.')
on conflict (categoria, grupo) do update
  set o_que_e = excluded.o_que_e, por_que = excluded.por_que, como_confirmar = excluded.como_confirmar;

-- 4) Busca da Triagem v3
--    nivel: 3 = mesmo modelo, 2 = mesma família, 1 = mesma série, 0 = mesma categoria
drop function if exists public.triagem_buscar(text[], text, text, text[], text[]);
drop function if exists public.triagem_buscar(text[], text, text, text[], text[], text);

create function public.triagem_buscar(
  p_categorias text[],
  p_modelo text,
  p_familia text,
  p_grupos text[],
  p_garantias text[] default null,
  p_serie text default null
) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select g.os, g.pecas,
           coalesce((select jsonb_agg(p->>'c') from jsonb_array_elements(g.pecas) p), '[]'::jsonb) as cods,
           coalesce(upper(g.sintoma), '') as sintoma,
           case when g.modelo = p_modelo then 3
                when p_familia <> '' and g.familia = p_familia then 2
                when coalesce(p_serie, '') <> '' and public.serie_modelo(g.familia) = p_serie then 1
                else 0 end as nivel,
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
      and (g.categoria = any (coalesce(p_categorias, '{}'))
           or g.modelo = p_modelo
           or (p_familia <> '' and g.familia = p_familia)
           or (coalesce(p_serie, '') <> '' and public.serie_modelo(g.familia) = p_serie))
  ),
  totais as (
    select count(*) filter (where nivel = 3)::int as n_modelo,
           count(*) filter (where nivel >= 2)::int as n_familia,
           count(*) filter (where nivel >= 1)::int as n_serie,
           count(*)::int as n_categoria
    from base
  )
  select jsonb_build_object(
    'totais', (select to_jsonb(t) from totais t),
    'casos', coalesce((
      select jsonb_agg(jsonb_build_array(b.os, b.nivel, b.mascara, b.cods, b.sintoma))
      from base b where b.mascara > 0
    ), '[]'::jsonb),
    -- todas as OS do modelo / família / série (para contar pelo código IRIS, mesmo sem bater o texto)
    'historico', coalesce((
      select jsonb_agg(jsonb_build_array(b.nivel, b.cods, b.os, b.sintoma))
      from base b where b.nivel >= 1
    ), '[]'::jsonb),
    -- descrição de cada código de peça (uma vez só, para a resposta ficar leve)
    'pecas_info', coalesce((
      select jsonb_object_agg(x.c, x.d) from (
        select distinct on (p->>'c') p->>'c' as c, p->>'d' as d
        from base b, jsonb_array_elements(b.pecas) p
        where b.mascara > 0 or b.nivel >= 1
      ) x
    ), '{}'::jsonb),
    -- perfil de defeitos: quantas OS reparadas do modelo (ou família) por código IRIS
    'perfil', coalesce((
      select jsonb_agg(jsonb_build_array(p.sintoma, p.n) order by p.n desc)
      from (
        select sintoma, count(*)::int as n from base
        where nivel >= case when exists (select 1 from base where nivel = 3) then 3 else 2 end
        group by sintoma
      ) p
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.triagem_buscar(text[], text, text, text[], text[], text) to authenticated;

-- Conferência
select (select count(*) from public.sintomas_iris) as sintomas, (select count(*) from public.guia_pecas) as guia_pecas;
