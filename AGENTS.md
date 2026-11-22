# Pulo: guia para agentes

App do hackathon em Expo SDK 58 (React Native, Expo Router, TypeScript), com saída web estática.
Monorepo com npm workspaces e Turborepo: `apps/mobile` (Expo), `apps/api` (Hono) e `packages/core` (regras puras).
Specs em `docs/specs/pulo/` (01 a 10). Leia só as da sua parte.

## Regras
- Contratos compartilhados são somente leitura para quem não os criou:
  `packages/core/domain/types.ts`, `apps/mobile/src/theme/tokens.ts`, `packages/core/config/decisions.ts`. Precisa de mudança? Peça à pessoa que coordena.
- Nenhuma decisão do produto fica espalhada em número mágico: use `packages/core/config/decisions.ts`.
- Nenhuma função de domínio chama `Date.now()`: receba `Clock` ou `now`.
- Sem segredo, chave ou token no repositório. Dados só sintéticos.
- Não usar `expo-sqlite` (web exige wasm e cabeçalhos COOP/COEP).
- Sem push, PR ou deploy sem aprovação explícita do Victor.
- Textos para o Victor: sem hashtags e sem hífens.
- Antes de usar API do Expo, confira a documentação da versão (https://docs.expo.dev/llms.txt).

## Comandos
Node portátil em `/data/tools/node/bin` (ponha no PATH).
Na raiz, cada comando roda em todos os pacotes via Turborepo:
- `npm run dev`         app web (8081) e API (8787) juntos
- `npm test`            testes (Jest, preset jest-expo)
- `npm run typecheck`   tsc sem emitir
- `npm run build`       web estática em `apps/mobile/dist/` e API em `apps/api/dist/`
- Só um pacote: `npx turbo run test --filter=@pulo/core`
- Dependência do app: `cd apps/mobile && npx expo install <pacote>` (versões compatíveis com o SDK)

## Estrutura
- `packages/core` (`@pulo/core`): `domain` regras puras, `config` decisões, `data` repositórios, `demo` modo demo.
  TypeScript sem build e sem React Native; importe por caminho, como `@pulo/core/domain/types`.
  Dentro do core os imports são relativos (o alias `@/` é só do app).
- `apps/mobile` (`@pulo/mobile`): `src/app` rotas (Expo Router), `src/theme` tokens e `useTheme`, `src/ui` componentes,
  `src/mascot` sapo e lagoa, `src/features` telas, `src/data` adaptador do AsyncStorage.
- `apps/api` (`@pulo/api`): Hono no Node. `src/weekly-ai.ts` é a função da IA, `src/app.ts` as rotas.
