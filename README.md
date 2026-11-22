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
npm run build   # apps/mobile/dist (web estática) e apps/api/dist (servidor Node)
```

## Estrutura

```
apps/
  mobile/   @pulo/mobile  Expo: rotas, telas, tema, componentes, sapo e lagoa
  api/      @pulo/api     Hono no Node: GET /health e POST /weekly-ai
packages/
  core/     @pulo/core    regras puras, sem React Native: domínio, decisões, repositórios e modo demo
docs/specs/pulo           as 10 specs do projeto
```

- `packages/core/config/decisions.ts`: todas as decisões do produto em um lugar
- `apps/api/src/weekly-ai.ts`: IA semanal com provedor trocável. A chave fica só no ambiente do servidor
  (`PULO_AI_PROVIDER`, `PULO_AI_API_KEY`). Sem chave, usa o provedor falso.
- Variáveis da API: `PORT` (padrão 8787) e `PULO_CORS_ORIGIN` (padrão `http://localhost:8081`, aceita lista separada por vírgula).

## Privacidade

Os dados ficam no aparelho. A IA semanal recebe só um resumo agregado, nunca títulos, nomes ou texto livre.
Sem endereço de IA configurado, as sugestões vêm de regras simples e aparecem como "Sugestão".
Todos os dados do modo demo são sintéticos.

## Licença

MIT. Veja [LICENSE](LICENSE).
