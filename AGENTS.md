# Pulo: guia para agentes

App do hackathon em Expo SDK 58 (React Native, Expo Router, TypeScript), com saída web estática.
Monorepo com npm workspaces e Turborepo: `apps/mobile` (Expo), `apps/api` (Hono no Cloudflare Workers), `packages/core` (regras puras) e `packages/db` (Prisma e PostgreSQL).
Specs em `docs/specs/pulo/` (01 a 10). Leia só as da sua parte.

## Regras
- Contratos compartilhados são somente leitura para quem não os criou:
  `packages/core/domain/types.ts`, `apps/mobile/src/theme/tokens.ts`, `packages/core/config/decisions.ts`. Precisa de mudança? Peça à pessoa que coordena.
- Nenhuma decisão do produto fica espalhada em número mágico: use `packages/core/config/decisions.ts`.
- Nenhuma função de domínio chama `Date.now()`: receba `Clock` ou `now`.
- Sem segredo, chave ou token no repositório. Dados só sintéticos.
- Não usar `expo-sqlite` (web exige wasm e cabeçalhos COOP/COEP).
- Cada pedido novo do Victor ganha uma branch própria a partir da `main` (`feat/...`, `fix/...`, `chore/...`).
  Commits em partes na branch; no fim, merge na `main` e push.
- Push na `main` roda o CI (lint, typecheck e build) e, se passar, faz o deploy da API no Cloudflare Workers.
- Textos para o Victor: sem hashtags e sem hífens.
- Antes de usar API do Expo, confira a documentação da versão (https://docs.expo.dev/llms.txt).

## Comandos
Node portátil em `/data/tools/node/bin` (ponha no PATH).
Na raiz, cada comando roda em todos os pacotes via Turborepo:
- `npm run lint`        ESLint do app (eslint-config-expo)
- `npm run dev`         app web (8081) e API com wrangler dev (8787) juntos
- `npm run deploy`      typecheck, testes e deploy do Worker
- `npm test`            testes (Jest no app e no core, Vitest na API e no db)
- `npm run db:up`, `db:deploy`, `db:migrate`, `db:studio`, `db:seed`  banco local (veja o README)
- `npm run typecheck`   tsc sem emitir
- `npm run build`       web estática em `apps/mobile/dist/` e API em `apps/api/dist/` (dry run do Worker)
- Só um pacote: `npx turbo run test --filter=@pulo/core`
- Dependência do app: `cd apps/mobile && npx expo install <pacote>` (versões compatíveis com o SDK)

## Estrutura
- `packages/core` (`@pulo/core`): `domain` regras puras, `config` decisões, `data` repositórios, `demo` modo demo.
  TypeScript sem build e sem React Native; importe por caminho, como `@pulo/core/domain/types`.
  Dentro do core os imports são relativos (o alias `@/` é só do app).
- `apps/mobile` (`@pulo/mobile`): `src/app` rotas (Expo Router), `src/theme` tokens e `useTheme`, `src/ui` componentes,
  `src/mascot` sapo e lagoa, `src/features` telas, `src/data` adaptador do AsyncStorage.
- `apps/api` (`@pulo/api`): Hono no Cloudflare Workers (`pulo-api`). `src/weekly-ai.ts` é a função da IA, `src/app.ts` as rotas,
  `src/auth.ts` o Better Auth (Google, adapter do Prisma), `src/worker.ts` a entrada do Worker (um cliente de banco por requisição),
  `wrangler.jsonc` a config. Testes com Vitest contra um Postgres de verdade (embedded). Segredos só por `wrangler secret put`.
- `packages/db` (`@pulo/db`): `prisma/schema.prisma` e `prisma/migrations`, `createDb(url)`, mapeadores `toDomain`/`fromDomain`,
  `@pulo/db/testing` (`createTestDatabase`, `countQueries`). Veja `docs/banco-de-dados.md`. Sem `any`, sem N+1.
