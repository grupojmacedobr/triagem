# Triagem — Grupo J.Macedo

Sistema de Triagem do Grupo J.Macedo Eletrônica.
Mesma base do Sistema Allied: **Next.js 14 + Supabase + Tailwind**, publicado na **Vercel**.

## O que já tem
- Login `nome.sobrenome` (tela com o logo Triagem)
- "Esqueci minha senha" → vira um pedido para o administrador
- Troca de senha obrigatória no 1º acesso (senha inicial: `Triagem001`)
- Usuários: cadastrar, editar, bloquear/desbloquear, resetar senha, reenviar acesso
- Cargos: Diretor, Gerente, Supervisor, Técnico, Triagem, Operacional, Estoque (+ Administrador)
- Só Administrador, Diretor e Gerente gerenciam usuários
- Tema **azul** e tema **claro** (sol/lua no topo) + **Cor do sistema** (paleta)
- Saída automática após 1 hora sem uso

## Triagem (módulo principal)
Informe **modelo (SKU)** (sugestões desde a 1ª letra), **uma ou mais categorias** e o **defeito** (texto livre, com sugestões dos defeitos já cadastrados). O sistema:
1. entende o defeito (sinônimos: "tela preta" = "sem imagem"; "tem som" = funciona, não é defeito);
2. procura na Base GSPN as OS **Produto Entregue e reparadas** (com peça ou código de reparo A..)
   com defeito parecido — primeiro no mesmo modelo, depois na família, depois na categoria;
3. mostra as peças mais usadas (código, tipo, nº de OS e %), tipos de peça, peças trocadas juntas e exemplos.

Teste com 400 OS reais (peça escondida): peça certa em 1º lugar 50%, no top 3 71%, no top 5 77%;
tipo de peça certo no top 3 85%.

Base GSPN: **Configurações > Base GSPN** (planilha padrão de exportação do GSPN, .xlsx).
- Pode escolher várias planilhas (várias lojas) de uma vez; ficam na pasta `BASE GSPN` (fora do GitHub).
- Envio em partes de 250 OS, uma por vez, com pausa e nova tentativa automática (cuida do plano gratuito).
- OS que não mudaram são puladas (coluna `hash`); ao final o sistema reaprende as categorias.

Categorias: **Configurações > Cadastro Categorias**. Ordem de decisão: regra "modelo começa com" >
coluna BH do GSPN > aprendido (mesmo modelo / família / começo do modelo) > Outros.
Dicionário de sinônimos: `src/lib/triagem.ts` (lista CONCEITOS).
Tradução dos nomes das peças: `src/lib/pecas.ts` (lista REGRAS, feita com todas as descrições da base).
Defeito padrão: a Triagem usa o código de sintoma IRIS (coluna AY) para juntar todas as OS do mesmo defeito
(tabela `sintomas_iris`) e mostra o guia do triador por tipo de peça (tabela `guia_pecas`). Níveis: modelo >
família > série (mesma linha, outras polegadas) > categoria, com selo de confiança da amostra.
Filtro de garantia na Triagem: coluna AL (LP = em garantia, OW = fora de garantia).

## Atualização automática pelo Robô GSPN (SQL 08)
O robô do PC salva a base de OS de cada unidade no OneDrive (`AUTOMAÇÃO\ROBÔ - <ASC> - <UNIDADE>\BASE DE DADOS`)
e o robô do **Sistema de Inventário** envia essa base para o Inventário, que a entrega pela rota
`https://jm-inventario.vercel.app/api/integracao/base-os` (com chave). A Triagem busca de lá:
- **todo dia às 6h** sozinha (Vercel Cron, `vercel.json`), e no botão **Sincronizar agora** (Configurações > Base GSPN);
- 1ª vez de cada unidade = base inteira; depois só as OS que mudaram (Change Date dos últimos 3 dias);
  1 vez por semana relê a base inteira. OS iguais não são regravadas;
- unidades novas do robô entram sozinhas. A importação manual de planilha continua funcionando.
- Código: `src/lib/sincronizarRobo.ts` · rota `src/app/api/gspn/sincronizar` · tela `src/components/SincronizacaoRobo.tsx`.

Variáveis na Vercel (projeto triagem):
- `INVENTARIO_BASE_OS_CHAVE` = a mesma chave da `INTEGRACAO_BASE_OS_CHAVE` do Inventário (arquivo `CHAVE_INTEGRACAO_BASE_OS.txt` na Área de Trabalho)
- `CRON_SECRET` = senha da atualização diária (gerar com `GERAR SENHA CRON.bat`)
- (opcional) `INVENTARIO_BASE_OS_URL` se o endereço do Inventário mudar

## Estrutura
```
src/app/            páginas (login, dashboard, usuarios, trocar-senha) e APIs
src/components/     peças da tela (menu, logo, formulários, popups)
src/lib/            regras (cargos, cores, conexão com Supabase)
src/middleware.ts   "porteiro": exige login e troca de senha
supabase/           SQLs para rodar no Supabase (SQL Editor), em ordem: 01, 02, 03, 04, 05, 06, 07, 08
public/             imagens (logo do login, ícone)
```

## Configuração na Vercel
- Framework Preset: **Next.js**
- Environment Variable obrigatória: `SUPABASE_SERVICE_ROLE_KEY` (chave secreta do Supabase)
- Robô GSPN: `INVENTARIO_BASE_OS_CHAVE` e `CRON_SECRET` (ver acima)

## Login no Supabase
Cada usuário vira `nome.sobrenome@jmacedo.internal` no Supabase Auth.
Cadastre sempre pela tela **Sistema > Usuários** (não pelo painel do Supabase).

## Atualizar o site
Dois cliques em `ENVIAR_GITHUB.bat` → a Vercel publica sozinha em 1-2 minutos.
