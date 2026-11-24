# Pulo

Um app de hábitos e foco, sem culpa, com um sapo que cresce junto com você.
Cliente web em TanStack Start (React, Tailwind, mobile first), no Cloudflare Workers.
Monorepo com npm workspaces e Turborepo. Web: https://pulo-web.albqvictor.workers.dev

Cada dia de cuidado conta: foco concluído, uma sessão parada na metade ou um dia de descanso.
O sapo nunca volta uma fase, e a lagoa ao redor dele muda conforme os dias de cuidado.
Uma sugestão semanal propõe mudar um horário, e nada muda sem a sua aprovação.

## Rodar

Requer Node 20 ou mais novo.

```sh
npm install
cp .env.example .env                                  # DATABASE_URL do Postgres local
cp apps/api/.dev.vars.example apps/api/.dev.vars      # segredos da API (veja "Auth e banco")
npm run db:up                                         # Postgres no Docker (ou: npm run db:embedded, sem Docker)
npm run db:deploy                                     # aplica as migrações
npm run dev
```

Sobe o web TanStack em http://localhost:3000 e a API em http://localhost:8787.
O app pede login com Google. Modo demo, sem login e com 4 semanas de dados sintéticos: abra o endereço com `?demo=1`
ou toque em "Ver o demo" na tela de entrada.

O endereço do app precisa estar em `PULO_CORS_ORIGIN` da API (CORS com credenciais, origens confiáveis e checagem de `Origin` nas escritas).
Sessão, cookie, CSRF e como publicar app e API: [docs/web-auth.md](docs/web-auth.md).
Servidor MCP (uma IA usando o Pulo pela pessoa, com OAuth): [docs/mcp.md](docs/mcp.md).

Variáveis do web: `VITE_API_URL` em `apps/web/.env.development` (API local) e `apps/web/.env.production` (API publicada).

Só um pacote: `npx turbo run dev --filter=@pulo/web` (ou `@pulo/api`).

## Testes e exportação

```sh
npm test
npm run typecheck
npm run build   # apps/web/dist e apps/api/dist (bundle do Worker)
```

## Deploy

A API roda no Cloudflare Workers como `pulo-api` (https://pulo-api.albqvictor.workers.dev) e o web como `pulo-web`
(https://pulo-web.albqvictor.workers.dev).

```sh
npm run deploy   # roda typecheck e testes, depois wrangler deploy
```

No GitHub, todo push na `main` roda lint, typecheck, testes e build e, se passar, aplica as migrações, faz o deploy da API
e depois o do web (`.github/workflows/ci.yml`, com os secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e `DATABASE_URL`).

Config em `apps/api/wrangler.jsonc`. Segredos vão por `npx wrangler secret put <NOME>` dentro de `apps/api`, nunca no repositório.

### Rotas

- `GET /health`
- `POST /weekly-ai`: sugestão semanal da IA (aberta, sem login: usada pelo demo)
- `POST /api/proposals/generate` e `POST /api/proposals/:id/decision`: a proposta da semana gerada e decidida no servidor (conta), veja `docs/api.md`
- `/api/auth/*`: Better Auth. Login com Google em `POST /api/auth/sign-in/social` com `{ "provider": "google", "callbackURL": "..." }`,
  sessão em `GET /api/auth/get-session`, saída em `POST /api/auth/sign-out`
- `GET /api/me`: usuário logado e metadados
- `PUT /api/blocks` e `PUT /api/habits`: escrita em lote (onboarding), veja `docs/api.md`
- `PATCH /api/me/metadata`: muda `theme`, `reduceMotion`, `timezone`, `onboardingCompleted` ou `profile`

### Metadados do usuário

Coluna JSON (`jsonb`) `metadata` na tabela `user`.
O formato e a validação ficam em `packages/core/domain/user-metadata.ts`, usados pela API e pelo app:
`version`, `theme`, `reduceMotion`, `timezone`, `onboarding { completed, completedAt }` e `profile`
(`frogName`, `dayStartMinutes`, `dayEndMinutes`, `createdAt`; nulo até o onboarding terminar, e contas antigas sem ele continuam válidas).
O `User` do app é montado a partir disso (`userFromMetadata` e `metadataPatchFromUser`, no mesmo arquivo).

### Auth

- Better Auth com o adapter do Prisma (`better-auth/adapters/prisma`). As tabelas `user`, `session`, `account` e
  `verification` estão no schema do `@pulo/db`.
- Secrets do Worker: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  (`npx wrangler secret put <NOME>` dentro de `apps/api`). Em dev, copie `apps/api/.dev.vars.example` para `apps/api/.dev.vars`.
- No Google Cloud, o OAuth Client `pulo-api` precisa dos redirecionamentos
  `https://pulo-api.albqvictor.workers.dev/api/auth/callback/google` e `http://localhost:8787/api/auth/callback/google`.
- Mudou plugin ou campo do Better Auth? Atualize `packages/db/prisma/schema.prisma` e crie a migração (`npm run db:migrate`).
- O app é só web: a sessão é um cookie HttpOnly gerido pela API (o app nunca lê nem guarda token). Variáveis de ambiente do Worker (vars, não secrets):
  `PULO_CORS_ORIGIN` (origens do app, separadas por vírgula; também origens confiáveis do Better Auth e do CSRF),
  `BETTER_AUTH_URL` (endereço público da API; `https` liga o Secure do cookie) e, opcional, `PULO_COOKIE_DOMAIN` (`exemplo.com`, para `app.exemplo.com` e `api.exemplo.com`).
  Escritas em `/api/*` com cookie exigem `Origin` de uma origem configurada. Detalhes em [docs/web-auth.md](docs/web-auth.md).

## Banco de dados

PostgreSQL com Prisma 7, no pacote `packages/db` (`@pulo/db`): schema, migrações, cliente gerado, mapeadores e apoio a testes.
Todos os dados do domínio ficam no servidor (login obrigatório); o modo demo continua local, com dados sintéticos.
Detalhes, diagrama das tabelas e regras contra N+1 em [docs/banco-de-dados.md](docs/banco-de-dados.md).

### Desenvolvimento local

```sh
cp .env.example .env
npm run db:up          # Docker Compose: PostgreSQL 17 em localhost:5432 (volume pulo-pgdata)
npm run db:deploy      # aplica as migrações existentes
npm run db:seed        # dados sintéticos (só em banco local)
npm run db:studio      # Prisma Studio
npm run db:migrate     # cria e aplica uma migração nova depois de mudar o schema.prisma
npm run db:down        # para o Postgres (o volume fica)
```

Sem Docker: `npm run db:embedded` sobe um Postgres de verdade (binários do `embedded-postgres`, sem root) com os mesmos
dados de acesso do `.env.example`. Os testes usam esse mesmo caminho e criam um banco novo por arquivo de teste,
então não precisam de Docker nem de nada rodando.

### Produção: Supabase ou outro Postgres

Em produção o banco é o projeto `hackbrasil` do Supabase (São Paulo), pela URL do Session pooler (IPv4, porta 5432).

Tudo é guiado por `DATABASE_URL`, então qualquer Postgres serve.

1. Crie o projeto no Supabase e copie a connection string em Project Settings, Database.
2. Para migrar (`npm run db:deploy`), use a conexão DIRETA (porta 5432, ou o pooler em modo sessão, também 5432):
   `postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require`.
   Não rode migrações pelo pooler em modo transação (porta 6543).
3. Para o Worker, guarde o mesmo valor como secret: `cd apps/api && npx wrangler secret put DATABASE_URL`.
   O Worker abre uma conexão por requisição; o pooler do Supabase evita estourar o limite de conexões do Postgres.
4. SSL: o Supabase exige. Mantenha `sslmode=require` na URL.
5. Hyperdrive (opcional, menos latência): `npx wrangler hyperdrive create pulo-db --connection-string="<URL>"` e
   acrescente o binding `"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<id>" }]` no `apps/api/wrangler.jsonc`.
   O Worker já usa `env.HYPERDRIVE.connectionString` quando o binding existe.
6. Projetos do plano gratuito do Supabase PAUSAM depois de uns dias sem uso: confirme que o projeto está ativo
   antes da demonstração.

Nunca commite a URL do banco. O CI aplica as migrações com o secret `DATABASE_URL` do repositório (veja `.github/workflows/ci.yml`).

## Estrutura

```
apps/
  web/      @pulo/web     TanStack Start no Cloudflare Workers: rotas, telas, tema (Tailwind v4), sapo e lagoa
  api/      @pulo/api     Hono no Cloudflare Workers: auth (Better Auth + Google), IA semanal
packages/
  core/     @pulo/core    regras puras: domínio, decisões, repositórios e modo demo
  client/   @pulo/client  RemoteRepository: o Repository do core sobre a API (cliente tipado do Hono), com cache e erros em português
  db/       @pulo/db      Prisma 7 e PostgreSQL: schema, migrações, cliente, mapeadores e apoio a testes
docs/specs/pulo           as 10 specs do projeto
```

- `packages/core/config/decisions.ts`: todas as decisões do produto em um lugar
- `apps/api/src/weekly-ai.ts`: IA semanal com provedor trocável. A chave fica só no ambiente do servidor
  (`PULO_AI_PROVIDER`, `PULO_AI_API_KEY`). Sem chave, usa o provedor falso.
- `PULO_CORS_ORIGIN` (var no `wrangler.jsonc`): origens liberadas no CORS, separadas por vírgula.

## Privacidade

- **Conta.** O login é com o Google. O servidor guarda seu nome, e-mail e foto do Google, e a sessão.
- **Seus dados no app.** Nome do sapo, horário do dia, tema, rotina, hábitos e marcações, sessões de foco,
  dias de descanso, sugestões da semana e o estado do sapo ficam no servidor (PostgreSQL), ligados só à sua conta.
  Só quem entrou na conta consegue ler ou mudar esses dados. A sessão fica num cookie HttpOnly do navegador,
  que o app nunca lê.
- **Apagar.** "Apagar todos os meus dados", no Perfil, remove da conta a rotina, os hábitos, as sessões, os descansos,
  as sugestões e o sapo, em todos os aparelhos. A conta e o login continuam; sair da conta é outro botão.
- **Modo demo.** Não pede login nem envia seus dados: usa só dados sintéticos de exemplo, guardados na memória do aparelho
  e descartados ao fechar. Nada do demo vai para o servidor.
- **IA semanal.** Recebe só um resumo agregado da semana (minutos por período do dia, taxas de conclusão, contagens),
  nunca títulos, nome do sapo, e-mail, nome da conta, ids ou texto livre. Na conta, o servidor monta esse resumo e fala com a IA
  (a chave nunca sai dele); no demo, o app envia só dados de exemplo. Sem IA configurada ou se ela falhar, as sugestões vêm de regras
  simples e aparecem como "Sugestão"; só vem "Sugestão da IA" quando a IA realmente respondeu.

## Licença

MIT. Veja [LICENSE](LICENSE).
