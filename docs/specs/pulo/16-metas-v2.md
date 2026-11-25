# Spec 16: Metas com ritmo, baú e hábitos atrelados

Status: a fazer. Origem: rascunho, aba Metas e cartão Metas do trilho. Estende a spec 11.

## Problem Statement

A API já tem `Goal` com título, porquê, data alvo, estado e marcos. O rascunho pede mais:

- cada meta tem um ícone e uma cor;
- a meta mostra se está no ritmo ou atrás, com uma linha de ritmo na barra;
- a meta concluída abre um baú com joias, e o baú fechado mostra que tem prêmio esperando;
- hábitos podem ser atrelados a uma meta, e a meta mostra esses hábitos e quanto foco foi feito nela;
- a meta mostra hábitos feitos e dias restantes.

Nenhum desses dados existe: `Habit` não tem ligação com `Goal`, `Goal` não tem ícone, e o prêmio da meta entra no saldo sozinho, sem baú.

## Solution

`Goal` ganha ícone e cor; `Habit` ganha uma meta opcional; o ritmo e os números da meta são calculados no core; e o prêmio da meta concluída vira um baú que a pessoa abre uma vez.

## User Stories

1. Como pessoa, quero escolher um ícone e uma cor para cada meta, para reconhecer a meta de relance.
2. Como pessoa, quero ver se estou no ritmo para chegar na data, para saber se preciso acelerar.
3. Como pessoa, quero ver na barra onde eu deveria estar hoje, para comparar com onde estou.
4. Como pessoa, quero ver um baú fechado nas metas em andamento, para saber que tem prêmio no fim.
5. Como pessoa, quero abrir o baú quando concluo a meta e ver as joias entrando, para o fim da meta ser uma festa.
6. Como pessoa, quero que o baú só possa ser aberto uma vez, para o prêmio não duplicar.
7. Como pessoa, quero atrelar hábitos a uma meta, para ver o que estou fazendo por ela.
8. Como pessoa, quero atrelar pela página da meta ou pela página do hábito, para fazer de onde eu estiver.
9. Como pessoa, quero que um hábito fique em no máximo uma meta, para o progresso não contar em dobro.
10. Como pessoa, quero trocar ou soltar o hábito da meta, para reorganizar quando mudo de plano.
11. Como pessoa, quero ver quantos minutos de foco fiz por uma meta, para valorizar o tempo dedicado.
12. Como pessoa, quero ver quantas vezes fiz os hábitos da meta, para sentir o avanço mesmo sem marco novo.
13. Como pessoa, quero ver quantos dias faltam para a data alvo, para planejar.
14. Como pessoa, quero que apagar uma meta solte os hábitos dela, sem apagar os hábitos.
15. Como pessoa, quero ver as metas concluídas separadas das em andamento, para a lista não misturar.

## Implementation Decisions

- **Schema**: `Goal` ganha `icon` (emoji curto) e `color` (um dos nomes de cor do design system, não hex livre). `Habit` ganha `goalId` opcional, com `onDelete: SetNull`.
- **Ritmo** é uma função pura do core: `ritmo(meta, hoje)` devolve `{ esperado: 0..1, atual: 0..1, estado: 'no-ritmo' | 'atras' | 'concluida' | 'sem-data' }`, comparando marcos feitos com o tempo passado entre `createdAt` e `targetDate`. A tolerância fica no `decisions.ts`.
- **Foco por meta**: soma das sessões ligadas à meta, direto (spec 17) ou pelos hábitos atrelados. Precisa do vínculo da sessão definido na spec 17.
- **Baú**: novo registro de resgate `(userId, goalId)` com `abertoEm` e `joias`. A meta concluída mostra baú fechado até a pessoa abrir; abrir grava o resgate e as joias passam a contar no saldo. Isso muda a regra atual da ilha, em que `goalCompleted` entra no saldo sozinho: passa a entrar só depois de aberto.
- **Contrato**: `PUT /api/goals/:id` aceita `icon` e `color`; `PUT /api/habits/:id` aceita `goalId`; `POST /api/goals/:id/chest` abre o baú (409 se já aberto ou se a meta não está concluída). O sync devolve o resgate.
- **Limite**: atrelar não tem limite próprio; o limite de hábitos por dia (`MAX_HABITS_PER_DAY`) continua valendo.

## Testing Decisions

- Testar pela API e pelo core, sem olhar consultas internas.
- Core: `ritmo` com datas no limite (sem data alvo, meta vencida, meta adiantada).
- API: abrir baú duas vezes devolve 409 na segunda; abrir de meta ativa devolve 409; apagar meta deixa o hábito com `goalId` nulo; atrelar hábito a meta de outra pessoa devolve 404. Prior art: `goals.test.ts`, `habits.test.ts`, `island.test.ts`.

## Out of Scope

- Metas compartilhadas.
- Metas em várias camadas (meta dentro de meta).
- Ícones desenhados próprios; o MVP usa emoji.

## Further Notes

- Valor do baú: o rascunho mostra +20; hoje a meta concluída vale 10 moscas (`ISLAND.fliesPer.goalCompleted`). Decisão do Victor junto com a spec 18.
