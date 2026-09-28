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

## Estrutura
```
src/app/            páginas (login, dashboard, usuarios, trocar-senha) e APIs
src/components/     peças da tela (menu, logo, formulários, popups)
src/lib/            regras (cargos, cores, conexão com Supabase)
src/middleware.ts   "porteiro": exige login e troca de senha
supabase/           SQLs para rodar no Supabase (SQL Editor)
public/             imagens (logo do login, ícone)
```

## Configuração na Vercel
- Framework Preset: **Next.js**
- Environment Variable obrigatória: `SUPABASE_SERVICE_ROLE_KEY` (chave secreta do Supabase)

## Login no Supabase
Cada usuário vira `nome.sobrenome@jmacedo.internal` no Supabase Auth.
Cadastre sempre pela tela **Sistema > Usuários** (não pelo painel do Supabase).

## Atualizar o site
Dois cliques em `ENVIAR_GITHUB.bat` → a Vercel publica sozinha em 1-2 minutos.
