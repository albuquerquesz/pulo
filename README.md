# Pulo

Um app de hábitos e foco, sem culpa, com um sapo que cresce junto com você.
Feito em Expo (React Native, Expo Router, TypeScript), com saída web estática.
Monorepo com npm workspaces e Turborepo.

Cada dia de cuidado conta: foco concluído, uma sessão parada na metade ou um dia de descanso.
O sapo nunca volta uma fase, e a lagoa ao redor dele muda conforme os dias de cuidado.
Uma sugestão semanal propõe mudar um horário, e nada muda sem a sua aprovação.

## Rodar

Requer Node 20 ou mais novo.

```sh
npm install
cp apps/mobile/.env.example apps/mobile/.env.local   # liga o app na API local
cp .env.example .env                                  # DATABASE_URL do Postgres local
cp apps/api/.dev.vars.example apps/api/.dev.vars      # segredos da API (veja "Auth e banco")
npm run db:up                                         # Postgres no Docker (ou: npm run db:embedded, sem Docker)
npm run db:deploy                                     # aplica as migrações
npm run dev
```

Sobe o app web em http://localhost:8081 e a API em http://localhost:8787.
O app pede login com Google. Modo demo, sem login e com 4 semanas de dados sintéticos: abra o endereço com `?demo=1`
ou toque em "Ver o demo" na tela de entrada (é o único jeito no celular).

Variáveis do app (`apps/mobile/.env.local`, veja `apps/mobile/.env.example`):
`EXPO_PUBLIC_API_URL` (endereço da API; em desenvolvimento, sem ela, vale `http://localhost:8787`) e, opcional,
`EXPO_PUBLIC_WEEKLY_AI_ENDPOINT` (sem ela, a IA semanal usa `EXPO_PUBLIC_API_URL` + `/weekly-ai`).
Na web, o endereço do app precisa estar em `PULO_CORS_ORIGIN` da API (o cookie da sessão viaja entre sites, com credenciais).
Para o login no celular, o esquema `pulo://` já é origem confiável da API.

Só um pacote: `npx turbo run dev --filter=@pulo/mobile`.

## Testes e exportação

```sh
npm test
npm run typecheck
npm run build   # apps/mobile/dist (web estática) e apps/api/dist (bundle do Worker)
```

## Deploy da API

A API roda no Cloudflare Workers como `pulo-api`: https://pulo-api.albqvictor.workers.dev

```sh
npm run deploy   # roda typecheck e testes, depois wrangler deploy
```

No GitHub, todo push na `main` roda lint, typecheck e build e, se passar, faz o deploy da API
(`.github/workflows/ci.yml`, com os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`).

Config em `apps/api/wrangler.jsonc`. Segredos vão por `npx wrangler secret put <NOME>` dentro de `apps/api`, nunca no repositório.

### Rotas

- `GET /health`
- `POST /weekly-ai`: sugestão semanal da IA
- `/api/auth/*`: Better Auth. Login com Google em `POST /api/auth/sign-in/social` com `{ "provider": "google", "callbackURL": "..." }`,
  sessão em `GET /api/auth/get-session`, saída em `POST /api/auth/sign-out`
- `GET /api/me`: usuário logado e metadados
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
- Origens confiáveis: `PULO_CORS_ORIGIN` e o esquema do app `pulo://`.

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

### Produção: Supabase (ainda não criado) ou outro Postgres

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
  mobile/   @pulo/mobile  Expo: rotas, telas, tema, componentes, sapo e lagoa
  api/      @pulo/api     Hono no Cloudflare Workers: auth (Better Auth + Google), IA semanal
packages/
  core/     @pulo/core    regras puras, sem React Native: domínio, decisões, repositórios e modo demo
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
- **Seus dados no app.** Nome do sapo, horário do dia, tema, rotina, hábitos e marcações, sessões de foco, check ins de energia,
  dias de descanso, sugestões da semana e o estado do sapo ficam no servidor (PostgreSQL), ligados só à sua conta.
  Só quem entrou na conta consegue ler ou mudar esses dados. No celular a sessão fica no armazenamento seguro do aparelho;
  na web, num cookie do navegador.
- **Apagar.** "Apagar todos os meus dados", no Perfil, remove da conta a rotina, os hábitos, as sessões, os check ins, os descansos,
  as sugestões e o sapo, em todos os aparelhos. A conta e o login continuam; sair da conta é outro botão.
- **Modo demo.** Não pede login nem envia seus dados: usa só dados sintéticos de exemplo, guardados na memória do aparelho
  e descartados ao fechar. Nada do demo vai para o servidor.
- **IA semanal.** Recebe só um resumo agregado da semana (minutos por período do dia, taxas de conclusão, energia média, contagens),
  nunca títulos, nome do sapo, e-mail, nome da conta ou texto livre, e o pedido não leva sua sessão.
  Sem endereço de IA configurado, as sugestões vêm de regras simples e aparecem como "Sugestão".

## Licença

MIT. Veja [LICENSE](LICENSE).
