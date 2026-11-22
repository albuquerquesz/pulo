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
npm run dev
```

Sobe o app web em http://localhost:8081 e a API em http://localhost:8787.
Modo demo, com 4 semanas de dados sintéticos: abra o endereço com `?demo=1`.

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

### Auth e banco

- Banco: Cloudflare D1 `pulo-db` (binding `DB`), migrações em `apps/api/migrations`.
  O deploy aplica as migrações pendentes antes de subir o Worker; o `npm run dev` aplica no D1 local.
- Secrets do Worker: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  Em dev, copie `apps/api/.dev.vars.example` para `apps/api/.dev.vars`.
- No Google Cloud, o OAuth Client `pulo-api` precisa dos redirecionamentos
  `https://pulo-api.albqvictor.workers.dev/api/auth/callback/google` e `http://localhost:8787/api/auth/callback/google`.
- Mudou plugin ou campo do Better Auth? `cd apps/api && npm run db:generate -- --output migrations/000N_nome.sql`.
- Origens confiáveis: `PULO_CORS_ORIGIN` e o esquema do app `pulo://`.

## Estrutura

```
apps/
  mobile/   @pulo/mobile  Expo: rotas, telas, tema, componentes, sapo e lagoa
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
