# Pulo: guia para agentes

App do hackathon em Expo SDK 58 (React Native, Expo Router, TypeScript), com saída web estática.
Specs em `docs/specs/pulo/` (01 a 10). Leia só as da sua parte.

## Regras
- Contratos compartilhados são somente leitura para quem não os criou:
  `src/domain/types.ts`, `src/theme/tokens.ts`, `src/config/decisions.ts`. Precisa de mudança? Peça à pessoa que coordena.
- Nenhuma decisão do produto fica espalhada em número mágico: use `src/config/decisions.ts`.
- Nenhuma função de domínio chama `Date.now()`: receba `Clock` ou `now`.
- Sem segredo, chave ou token no repositório. Dados só sintéticos.
- Não usar `expo-sqlite` (web exige wasm e cabeçalhos COOP/COEP).
- Sem push, PR ou deploy sem aprovação explícita do Victor.
- Textos para o Victor: sem hashtags e sem hífens.
- Antes de usar API do Expo, confira a documentação da versão (https://docs.expo.dev/llms.txt).

## Comandos
Node portátil em `/data/tools/node/bin` (ponha no PATH).
- `npm test`            testes (Jest, preset jest-expo)
- `npm run typecheck`   tsc sem emitir
- `npm run export:web`  exporta a web estática em `dist/`
- `npx expo install <pacote>` para dependências (versões compatíveis com o SDK)

## Estrutura
`src/app` rotas (Expo Router), `src/domain` regras puras, `src/data` repositório e armazenamento,
`src/theme` tokens e `useTheme`, `src/ui` componentes, `src/mascot` sapo e lagoa, `src/demo` modo demo,
`src/config` decisões, `server/` função de servidor da IA.
