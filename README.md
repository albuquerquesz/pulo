# Pulo

Um app de hábitos e foco, sem culpa, com um sapo que cresce junto com você.
App web mobile first em TanStack Start (React, TypeScript, Tailwind v4), com API em Hono.
Tudo roda no Cloudflare Workers. Monorepo com npm workspaces e Turborepo.

Cada dia de cuidado conta: foco concluído, uma sessão parada na metade ou um dia de descanso.
O sapo nunca volta uma fase, e a lagoa ao redor dele muda conforme os dias de cuidado.
Uma sugestão semanal propõe mudar um horário, e nada muda sem a sua aprovação.

## Rodar

Requer Node 20 ou mais novo.

```sh
npm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # secrets locais da API (Google e Better Auth)
npm run dev
```

Sobe o app web em http://localhost:3000 e a API em http://localhost:8787.
Modo demo, com 4 semanas de dados sintéticos: abra o endereço com `?demo=1`.
Login com Google (tela provisória): http://localhost:3000/welcome

Só um pacote: `npx turbo run dev --filter=@pulo/web`.

## Testes e exportação

```sh
npm test
npm run typecheck
npm run build   # apps/web/dist (Worker do TanStack Start) e apps/api/dist (bundle do Worker)
```

## Deploy

- Web: `pulo-web` no Cloudflare Workers, https://pulo-web.albqvictor.workers.dev
- API: `pulo-api` no Cloudflare Workers, https://pulo-api.albqvictor.workers.dev

## Deploy da API

```sh
npm run deploy   # roda typecheck e testes, depois wrangler deploy
```

No GitHub, todo push na `main` roda lint, typecheck e build e, se passar, faz o deploy da API e do web
(`.github/workflows/ci.yml`, com os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`).

Config em `apps/api/wrangler.jsonc`. Segredos vão por `npx wrangler secret put <NOME>` dentro de `apps/api`, nunca no repositório.

### Rotas

- `GET /health`
- `POST /weekly-ai`: sugestão semanal da IA
- `/api/auth/*`: Better Auth. Login com Google em `POST /api/auth/sign-in/social` com `{ "provider": "google", "callbackURL": "..." }`,
  sessão em `GET /api/auth/get-session`, saída em `POST /api/auth/sign-out`
- `GET /api/me`: usuário logado e metadados
- `PATCH /api/me/metadata`: muda `theme`, `reduceMotion`, `timezone` ou `onboardingCompleted`

### Metadados do usuário

Coluna JSON `metadata` na tabela `user` (no D1 é TEXT com `json_valid`; no Postgres seria jsonb).
O formato e a validação ficam em `packages/core/domain/user-metadata.ts`, usados pela API e pelo app:
`version`, `theme`, `reduceMotion`, `timezone` e `onboarding { completed, completedAt }`.
Rotina, hábitos e nome do sapo continuam só no aparelho.

### Auth e banco

- Banco: Cloudflare D1 `pulo-db` (binding `DB`), migrações em `apps/api/migrations`.
  O deploy aplica as migrações pendentes antes de subir o Worker; o `npm run dev` aplica no D1 local.
- Secrets do Worker: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  Em dev, copie `apps/api/.dev.vars.example` para `apps/api/.dev.vars`.
- No Google Cloud, o OAuth Client `pulo-api` precisa dos redirecionamentos
  `https://pulo-api.albqvictor.workers.dev/api/auth/callback/google` e `http://localhost:8787/api/auth/callback/google`.
- Mudou plugin ou campo do Better Auth? `cd apps/api && npm run db:generate -- --output migrations/000N_nome.sql`.
- Origens confiáveis: as do `PULO_CORS_ORIGIN`.

## Estrutura

```
apps/
  web/      @pulo/web     TanStack Start: rotas, telas, tema (Tailwind), componentes, sapo e lagoa
  api/      @pulo/api     Hono no Cloudflare Workers: auth (Better Auth + Google), IA semanal
packages/
  core/     @pulo/core    regras puras, sem React Native: domínio, decisões, repositórios e modo demo
docs/specs/pulo           as 10 specs do projeto
```

- `packages/core/config/decisions.ts`: todas as decisões do produto em um lugar
- `apps/api/src/weekly-ai.ts`: IA semanal com provedor trocável. A chave fica só no ambiente do servidor
  (`PULO_AI_PROVIDER`, `PULO_AI_API_KEY`). Sem chave, usa o provedor falso.
- `PULO_CORS_ORIGIN` (var no `wrangler.jsonc`): origens liberadas no CORS, separadas por vírgula.

## Privacidade

Os dados ficam no aparelho. A IA semanal recebe só um resumo agregado, nunca títulos, nomes ou texto livre.
Sem endereço de IA configurado, as sugestões vêm de regras simples e aparecem como "Sugestão".
Todos os dados do modo demo são sintéticos.

## Licença

MIT. Veja [LICENSE](LICENSE).
