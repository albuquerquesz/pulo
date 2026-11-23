# Spec 11: Metas de longo prazo

Status: feita no app web (23/11/2026). O app Expo ainda não tem a aba.

## Problem Statement

Hábitos e blocos cuidam do dia e da semana, mas não dizem para onde a pessoa está indo.
O Victor pediu uma aba para metas grandes de verdade, de meses ou anos, e não metas semanais.

## Solution

Uma aba **Metas**, entre Semana e Perfil. Cada meta tem:

- título (obrigatório) e um "por que ela importa" opcional, em uma frase;
- prazo opcional (uma data; a tela diz quanto falta em dias, meses ou anos);
- marcos: passos concretos que a pessoa risca. O progresso da meta é marcos riscados sobre o total;
- estado `ativa` ou `concluida`. Concluídas vão para **Conquistas** e podem ser reabertas.

No máximo `GOALS.maxActive` (3) metas ativas de cada vez, para cada uma receber atenção de verdade,
e até `GOALS.maxMilestones` (12) marcos por meta. Os dois números moram em `packages/core/config/decisions.ts`.

## User Stories

1. Como pessoa, quero escrever uma meta grande com prazo e o porquê, para lembrar dela todo dia.
2. Como pessoa, quero quebrar a meta em marcos e riscar cada um, para ver o progresso.
3. Como pessoa, quero concluir uma meta e encontrar ela em Conquistas, para comemorar.
4. Como pessoa, quero editar, reabrir e apagar metas.

## Implementation Decisions

- Domínio em `packages/core/domain/goals.ts` (casos de uso com `Result`, sem `Date.now()`); tipos `Goal` e `GoalMilestone` em `types.ts`.
- `Repository` ganhou `listGoals`, `saveGoal` e `deleteGoal` (memória, armazenamento local, remoto e demo).
- Banco: tabela `goal` com os marcos num `jsonb` (são poucos e sempre lidos junto com a meta, sem N+1).
  CHECKs: concluída se, e somente se, tem `completedAt`; `milestones` é array.
- API: `GET /api/goals`, `PUT /api/goals/:id` e `DELETE /api/goals/:id`; as metas vêm no `/api/sync` e saem no `DELETE /api/data`.
  O limite de ativas vale no servidor (409 `limite_de_metas`) numa transação serializável.
- Tela em `apps/web/src/features/metas` e rota `apps/web/src/routes/_abas/metas.tsx`.

## Testing Decisions

Casos de uso no Jest do core, suíte de contrato do `Repository` (memória e remoto), mapeador e CHECKs no Postgres,
rota com isolamento entre pessoas e número fixo de queries, e a lógica da tela no Vitest do web.

## Out of Scope

Ligar hábitos ou blocos de foco a uma meta, metas numéricas (ex.: "juntar R$ 10 mil" com valor acumulado),
lembretes, reordenar marcos, a aba no app Expo.
