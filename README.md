# Vistoria 3D — gestão para estética automotiva

Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, RLS) + three.js.

Modelo de venda atual: **sistema fechado, uma instalação por cliente** (um projeto Supabase + um deploy para cada).
O banco continua multiempresa (`company_id` em tudo), então voltar a oferecer como SaaS no futuro não exige reescrever nada.

## Instalação de um novo cliente

1. **Supabase:** crie um projeto novo para o cliente.
2. **Banco:** no SQL Editor, rode em ordem os arquivos de `supabase/migrations/`
   (`...0001_core`, `...0002_stock`, `...0003_ppf`, `...0004_partners_commissions`, `...0005_admin_access`).
3. **Cadastro fechado:** Authentication → Providers → Email → desligue **"Allow new users to sign up"**
   (ninguém cria conta sozinho; só o admin cria o acesso do cliente).
4. **Endereços:** Authentication → URL Configuration → *Site URL* = endereço do app; em *Redirect URLs* inclua `https://SEU-DOMINIO/auth/callback`.
5. **Variáveis:** `cp .env.example .env.local` e preencha as 4 variáveis. `SUPABASE_SERVICE_ROLE_KEY` é secreta (só servidor; nunca no Git).
6. `npm install` e `npm run dev` (ou deploy, ex.: Vercel, cadastrando as mesmas variáveis).
7. **Seu acesso de admin geral (uma vez):** crie seu usuário em Authentication → Users e rode no SQL Editor:
   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"platform_admin": true}'
   where email = 'SEU-EMAIL';
   ```
   (Esse campo não pode ser alterado por nenhum usuário pelo app.)
8. Entre em `/login` com esse usuário → abre `/admin` → **Nova empresa cliente**: informe empresa, nome e e-mail do dono.
   O sistema mostra **uma vez** a senha temporária; entregue ao dono. No primeiro acesso ele é obrigado a criar a própria senha.

## Quem acessa o quê

| Acesso | Onde | O que faz |
|---|---|---|
| **Admin geral (você)** | `/admin` | Cria empresa e dono, gera nova senha temporária, suspende/reativa empresa. **Não vê** os dados de negócio do cliente. |
| **Dono** | app | Tudo: OS, clientes, veículos, serviços, estoque, equipe, parceiros, comissões, relatórios, dados da empresa. |
| Gerente | app | Igual ao dono, exceto gerenciar membros/empresa. |
| Operador | app | Cria/edita clientes, veículos e OS. Não vê parceiros, comissões nem relatórios. |

Funcionários cadastrados em **Equipe** são registros de quem executa os serviços (responsável pela OS); não precisam de login.

## Segurança aplicada

- Login com mensagem única de erro (não revela se o e-mail existe) e limites de tentativa do próprio Supabase Auth.
- Senha nova: 10+ caracteres com letras e números. Troca na tela **Minha conta** exige a senha atual.
- Senha temporária (criada pelo admin) **obriga** a troca no primeiro acesso; a trava fica em `app_metadata`, que o usuário não consegue editar.
- Recuperação de senha por e-mail (`/esqueci-senha`), resposta sempre igual, destino do link restrito.
- Sessão em cookies `httpOnly`, `SameSite=Lax`, `Secure` em produção; `getUser()` valida o token no servidor a cada requisição.
- Cabeçalhos: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- RLS em todas as tabelas; comissões, parceiros e relatórios só para dono/gerente **no banco** (não só na tela).
- Empresa suspensa: o banco esconde todos os dados dela imediatamente.
- Criação de empresa só pelo admin (a função antiga aberta a qualquer usuário foi desativada).
- Validação de todas as entradas com zod; a chave `service_role` fica só em código de servidor (`server-only`).

## Arquitetura de pastas

```
src/
  app/                 só rotas e páginas (leitura de dados + composição). Pouca regra aqui.
    (auth)/            login, esqueci/redefinir senha, trocar senha obrigatória, sem acesso
    (app)/             área do cliente: painel, os, clientes, veiculos, servicos, estoque, equipe,
                       parceiros, relatorios, conta
    admin/             painel do admin geral
    auth/callback/     troca o código do e-mail por sessão
  features/<módulo>/   tudo de um módulo junto: actions.ts (server actions), schemas.ts (zod),
                       components/ (formulários e telas client). Módulos:
                       auth, admin, account, customers, vehicles, services, team, stock,
                       orders (inclui vistoria 3D), partners, commissions, reports
  components/ui        peças visuais genéricas (form, page, Icon) · components/layout (menu, cabeçalho)
  lib/                 código compartilhado: supabase/ (clientes server, admin, middleware, cookies),
                       auth.ts, security/, validation.ts (primitivas zod), crud.ts, car3d/ (modelos 3D)
  types/db.ts          tipos das tabelas
supabase/migrations/   banco versionado, em ordem de data
```

Regras para manter: página nova = pasta em `app/`; regra de negócio, formulário e validação do módulo ficam em
`features/<módulo>/`; algo usado por mais de um módulo vai para `lib/`. Mudança no banco = **nova** migration
(nunca edite uma já aplicada em cliente).

## Funcionalidades

- **Vistoria 3D** por tipo de carroceria (sedã, hatch, wagon, SUV, caminhonete, cupê) com peças clicáveis, ocorrências e serviço por peça.
- **Estoque:** produtos, entradas/saídas/ajustes, consumo por serviço, baixa automática ao concluir/entregar a OS (uma vez), alerta de mínimo.
- **PPF:** Full ou por partes (grupos Frente / Laterais / Topo e traseira), preço por parte; partes em turquesa no 3D. Polimento de para-brisa incluso.
- **Parceiros e comissões:** parceiro (ex.: revendedora) com vendedores; em cada OS, valor cobrado (opcional), comissão do parceiro e do vendedor em % ou R$ (sempre sobre o valor cobrado). Tudo opcional: a OS abre normalmente sem isso.
- **Relatórios:** por parceiro, para hoje / semana / quinzena / mês / período livre (data = conclusão da OS). PDF e Excel (CSV). Líquido da estética = cobrado − comissões. **Congelar** trava as OS do período; **Reabrir** libera.

## Verificação feita

- As 5 migrations rodam em ordem em PostgreSQL 16 e foram testadas (RLS, comissões, congelamento, relatório, admin, suspensão).
- O código TypeScript foi checado só quanto a sintaxe e imports; **não foi compilado nem executado** (precisa de `npm install`).
  Rode `npm run typecheck && npm run build` e me envie qualquer erro.
- Geração de PDF (jsPDF) e login/e-mail do Supabase ainda não foram exercitados.

## Próximas etapas
Financeiro, PDF da OS, fotos da vistoria, logins para gerentes/operadores (convite pelo dono), Excel `.xlsx` nativo.
