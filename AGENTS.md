# Pulo: guia para agentes

App do hackathon com dois clientes: `apps/web` (TanStack Start, React 19, Tailwind v4, web mobile first no Cloudflare Workers) e `apps/mobile` (Expo SDK 58, com saída web estática).
Monorepo com npm workspaces e Turborepo: `apps/web`, `apps/mobile` (Expo), `apps/api` (Hono no Cloudflare Workers), `packages/core` (regras puras), `packages/db` (Prisma e PostgreSQL) e `packages/client` (RemoteRepository sobre a API).
O app é só web (sem login nativo): a sessão é um cookie HttpOnly da API. Specs em `docs/specs/pulo/` (01 a 10). Leia só as da sua parte.

## Regras
- Contratos compartilhados são somente leitura para quem não os criou:
  `packages/core/domain/types.ts`, `apps/mobile/src/theme/tokens.ts`, `packages/core/config/decisions.ts`. Precisa de mudança? Peça à pessoa que coordena.
- Nenhuma decisão do produto fica espalhada em número mágico: use `packages/core/config/decisions.ts`.
- Nenhuma função de domínio chama `Date.now()`: receba `Clock` ou `now`.
- Sem segredo, chave ou token no repositório. Dados só sintéticos.
- Não usar `expo-sqlite` (web exige wasm e cabeçalhos COOP/COEP).
- Cada pedido novo do Victor ganha uma branch própria a partir da `main` (`feat/...`, `fix/...`, `chore/...`).
  Commits em partes na branch; no fim, merge na `main` e push.
- Push na `main` roda o CI (lint, typecheck, testes e build) e, se passar, migra o banco e faz o deploy da API e do web no Cloudflare Workers.
- Textos para o Victor: sem hashtags e sem hífens.
- Antes de usar API do Expo, confira a documentação da versão (https://docs.expo.dev/llms.txt).
- Antes de usar API do TanStack Start ou Router, confira a documentação da versão (https://tanstack.com/llms.txt).
- No web, mobile first: desenhe para a largura do celular e só depois amplie com `md:` e acima.

## Comandos
Node portátil em `/data/tools/node/bin` (ponha no PATH).
Na raiz, cada comando roda em todos os pacotes via Turborepo:
- `npm run lint`        ESLint do app (eslint-config-expo)
- `npm run dev`         web TanStack (3000), app Expo web (8081) e API com wrangler dev (8787) juntos
- `npm run deploy`      typecheck, testes e deploy dos Workers (API e web)
- `npm test`            testes (Jest no mobile e no core, Vitest no web, na API, no client e no db)
- `npm run db:up`, `db:deploy`, `db:migrate`, `db:studio`, `db:seed`  banco local (veja o README)
- `npm run typecheck`   tsc sem emitir
- `npm run build`       web em `apps/web/dist/`, web estática do Expo em `apps/mobile/dist/` e API em `apps/api/dist/` (dry run do Worker)
- Só um pacote: `npx turbo run test --filter=@pulo/core`
- Dependência do app: `cd apps/mobile && npx expo install <pacote>` (versões compatíveis com o SDK)

## Estrutura
- `packages/core` (`@pulo/core`): `domain` regras puras, `config` decisões, `data` repositórios, `demo` modo demo.
  TypeScript sem build e sem React Native; importe por caminho, como `@pulo/core/domain/types`.
  Dentro do core os imports são relativos (o alias `@/` é só do app).
- `apps/mobile` (`@pulo/mobile`): `src/app` rotas (Expo Router), `src/theme` tokens e `useTheme`, `src/ui` componentes,
  `src/mascot` sapo e lagoa, `src/features` telas, `src/data` adaptador do AsyncStorage.
- `apps/web` (`@pulo/web`): TanStack Start no Cloudflare Workers (`pulo-web`). `src/routes` rotas por arquivo (`_abas` é o layout com a barra
  de abas, `welcome` a entrada com login), `src/features` telas e lógica (as mesmas regras do mobile: `features/app/AppProvider.tsx` decide a
  origem dos dados, `features/sessao` o login), `src/ui` componentes, `src/mascot` sapo e lagoa em SVG, `src/styles.css` Tailwind v4 com os
  tokens como variáveis CSS. Variáveis `VITE_API_URL` em `.env.development` e `.env.production`. `routeTree.gen.ts` é gerado pelo Vite.
- `apps/api` (`@pulo/api`): Hono no Cloudflare Workers (`pulo-api`). `src/weekly-ai.ts` é a função da IA, `src/app.ts` as rotas,
  `src/auth.ts` o Better Auth (Google, adapter do Prisma), `src/routes/*` as rotas de domínio (uma por recurso, veja `docs/api.md`), `src/http.ts` sessão, validação e erros, `src/web-config.ts` cookie e origens a partir do ambiente, `src/csrf.ts` checagem de Origin (veja `docs/web-auth.md`), `src/worker.ts` a entrada do Worker (um cliente de banco por requisição), `src/mcp/*` o servidor MCP com OAuth (veja `docs/mcp.md`),
  `wrangler.jsonc` a config. Testes com Vitest contra um Postgres de verdade (embedded). Segredos só por `wrangler secret put`.
- `packages/client` (`@pulo/client`): `createRemoteRepository` (o `Repository` do core sobre `hc<AppType>`; um `GET /api/sync` na abertura, cache em memória,
  escritas otimistas com rollback), `RemoteError` com texto em português. Só importa o TIPO da API. Testes com Vitest rodando a API de verdade
  (`app.fetch`) no Postgres de teste e a suíte `@pulo/core/data/repository-contract`.
- `apps/web` e `apps/mobile`, de onde vêm os dados: `features/app/AppProvider.tsx` é o ÚNICO lugar que decide (`origem.ts`): demo = memória sintética (sem login),
  sessão = RemoteRepository, senão tela de login (`features/sessao`). Telas novas não escolhem repositório: usam `useApp().repo`.
- `packages/db` (`@pulo/db`): `prisma/schema.prisma` e `prisma/migrations`, `createDb(url)`, mapeadores `toDomain`/`fromDomain`,
  `@pulo/db/testing` (`createTestDatabase`, `countQueries`). Veja `docs/banco-de-dados.md`. Sem `any`, sem N+1.
