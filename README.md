# Pulo

Um app de hábitos e foco, sem culpa, com um sapo que cresce junto com você.
Feito em Expo (React Native, Expo Router, TypeScript), com saída web estática.

Cada dia de cuidado conta: foco concluído, uma sessão parada na metade ou um dia de descanso.
O sapo nunca volta uma fase, e a lagoa ao redor dele muda conforme os dias de cuidado.
Uma sugestão semanal propõe mudar um horário, e nada muda sem a sua aprovação.

## Rodar

Requer Node 20 ou mais novo.

```sh
npm install
npx expo start --web
```

Modo demo, com 4 semanas de dados sintéticos: abra o endereço com `?demo=1`.

## Testes e exportação

```sh
npm test
npm run typecheck
npx expo export --platform web   # gera dist/
```

## Estrutura

- `src/app`: rotas (Expo Router)
- `src/domain`: regras puras (dias de cuidado, fases, semana, foco, IA semanal)
- `src/data`: repositórios em memória e em armazenamento local
- `src/theme`, `src/ui`, `src/mascot`: tema, componentes, sapo e lagoa
- `src/demo`: modo demo com dados sintéticos e relógio controlável
- `src/config/decisions.ts`: todas as decisões do produto em um lugar
- `server/`: função de servidor da IA semanal (provedor trocável, chave só por variável de ambiente)
- `docs/specs/pulo`: as 10 specs do projeto

## Privacidade

Os dados ficam no aparelho. A IA semanal recebe só um resumo agregado, nunca títulos, nomes ou texto livre.
Sem endereço de IA configurado, as sugestões vêm de regras simples e aparecem como "Sugestão".
Todos os dados do modo demo são sintéticos.

## Licença

MIT. Veja [LICENSE](LICENSE).
