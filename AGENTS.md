# Pulo: guia para agentes

App do hackathon: web mobile first em TanStack Start (React 19, TypeScript, Tailwind v4) no Cloudflare Workers.
Monorepo com npm workspaces e Turborepo: `apps/web` (TanStack Start), `apps/api` (Hono no Cloudflare Workers) e `packages/core` (regras puras).
Specs em `docs/specs/pulo/` (01 a 10). Leia só as da sua parte.

## Regras
- Contratos compartilhados são somente leitura para quem não os criou:
  `packages/core/domain/types.ts`, `apps/web/src/theme/tokens.ts` (e as variáveis em `apps/web/src/styles.css`, conferidas por teste), `packages/core/config/decisions.ts`. Precisa de mudança? Peça à pessoa que coordena.
- Nenhuma decisão do produto fica espalhada em número mágico: use `packages/core/config/decisions.ts`.
- Nenhuma função de domínio chama `Date.now()`: receba `Clock` ou `now`.
- Sem segredo, chave ou token no repositório. Dados só sintéticos.
- Cada pedido novo do Victor ganha uma branch própria a partir da `main` (`feat/...`, `fix/...`, `chore/...`).
  Commits em partes na branch; no fim, merge na `main` e push.
- Push na `main` roda o CI (lint, typecheck e build) e, se passar, faz o deploy da API no Cloudflare Workers.
- Textos para o Victor: sem hashtags e sem hífens.
- Antes de usar API do TanStack Start ou Router, confira a documentação da versão (https://tanstack.com/llms.txt).
- Mobile first: desenhe para a largura do celular e só depois amplie com `md:` e acima.

## Comandos
Node portátil em `/data/tools/node/bin` (ponha no PATH).
Na raiz, cada comando roda em todos os pacotes via Turborepo:
- `npm run lint`        ESLint do web
- `npm run dev`         web (3000) e API com wrangler dev (8787) juntos
- `npm run deploy`      typecheck, testes e deploy dos Workers (web e API)
- `npm test`            testes (Vitest em todos os pacotes; jsdom e Testing Library no web)
- `npm run typecheck`   tsc sem emitir
- `npm run build`       web em `apps/web/dist/` e API em `apps/api/dist/` (dry run do Worker)
- Só um pacote: `npx turbo run test --filter=@pulo/core`

## Estrutura
- `packages/core` (`@pulo/core`): `domain` regras puras, `config` decisões, `data` repositórios, `demo` modo demo.
  TypeScript sem build e sem React Native; importe por caminho, como `@pulo/core/domain/types`.
  Dentro do core os imports são relativos (o alias `@/` é só do app).
- `apps/web` (`@pulo/web`): TanStack Start no Cloudflare Workers (`pulo-web`). `src/routes` rotas por arquivo
  (`_abas` é o layout com a barra de abas), `src/features` telas, `src/ui` componentes, `src/mascot` sapo e lagoa em SVG,
  `src/theme` tokens, `useTheme` e regras de tema, `src/styles.css` Tailwind v4 com os tokens como variáveis CSS,
  `src/auth` cliente do Better Auth. Dados do app no `localStorage` (repositório do core). `routeTree.gen.ts` é gerado pelo Vite.
- `apps/api` (`@pulo/api`): Hono no Cloudflare Workers (`pulo-api`). `src/weekly-ai.ts` é a função da IA, `src/app.ts` as rotas,
  `src/auth.ts` o Better Auth (Google, D1 `pulo-db`), `src/worker.ts` a entrada do Worker, `wrangler.jsonc` a config.
  Migrações SQL em `migrations/`, geradas com `npm run db:generate`. Testes com Vitest (o Better Auth é só ESM).
  Segredos só por `wrangler secret put`.
