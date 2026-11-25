# Spec 17: Página de Hábitos

Status: a fazer. Origem: rascunho, aba Hábitos (lista agrupada por período e detalhe do hábito) e Linha do dia no Hoje. Estende a spec 05.

## Problem Statement

`Habit` hoje tem título, dias da semana e `active`. O rascunho mostra, para cada hábito:

- ícone e cor;
- período do dia (manhã, tarde, noite), que agrupa a lista;
- horário de lembrete com chave de liga e desliga;
- meta atrelada (spec 16);
- sequência própria, recorde, taxa de conclusão e total de vezes feito;
- um calendário das últimas 16 semanas com feito, feito em parte, descanso e não feito;
- pausar e arquivar, que são coisas diferentes.

A Linha do dia do Hoje também mostra um ícone por bloco da rotina, e `RoutineBlock` não tem ícone. Nada disso está na API.

## Solution

`Habit` ganha os campos de apresentação e de estado, e uma função do core calcula as estatísticas e o calendário de cada hábito a partir dos `HabitLog` que já existem.

## User Stories

1. Como pessoa, quero dar um ícone e uma cor a cada hábito, para reconhecer cada um rápido.
2. Como pessoa, quero dizer se o hábito é de manhã, de tarde ou de noite, para a lista seguir o meu dia.
3. Como pessoa, quero ver meus hábitos agrupados por período, para saber o que vem agora.
4. Como pessoa, quero um lembrete num horário para cada hábito, para não esquecer.
5. Como pessoa, quero desligar o lembrete sem perder o horário, para pausar o aviso por um tempo.
6. Como pessoa, quero ver a sequência de cada hábito, para saber qual está firme.
7. Como pessoa, quero ver o recorde de cada hábito, para ter um alvo.
8. Como pessoa, quero ver a porcentagem de dias que cumpri o hábito, para medir sem me culpar.
9. Como pessoa, quero ver quantas vezes já fiz o hábito, para sentir o acumulado.
10. Como pessoa, quero ver um calendário de quadradinhos das últimas semanas, para enxergar o padrão.
11. Como pessoa, quero que dias fora da frequência do hábito não contem como falha, para a taxa ser justa.
12. Como pessoa, quero que dias de descanso apareçam diferentes no calendário, para lembrar que descansei.
13. Como pessoa, quero pausar um hábito, para ele sair do Hoje sem perder o histórico.
14. Como pessoa, quero arquivar um hábito que larguei, para ele sumir das listas mas o histórico continuar.
15. Como pessoa, quero reativar um hábito pausado ou arquivado, para voltar a fazer.
16. Como pessoa, quero ver na página do hábito a meta dele e trocar ali mesmo, para não ir até Metas.
17. Como pessoa, quero dar um ícone a cada bloco da minha rotina, para a Linha do dia ficar visual.

## Implementation Decisions

- **Schema de `Habit`**: `icon`, `color`, `period: 'manha' | 'tarde' | 'noite' | null`, `reminderMinutes` (minutos desde 00:00, opcional), `reminderOn`, e `state: 'ativo' | 'pausado' | 'arquivado'` no lugar do booleano `active` (migração: `active=true` vira `ativo`, `false` vira `arquivado`). `goalId` vem da spec 16.
- **Schema de `RoutineBlock`**: `icon` opcional.
- **Limite por dia** (`MAX_HABITS_PER_DAY`) conta só os `ativo`.
- **Estatísticas**: função pura `statsDoHabito(habito, logs, descansos, hoje)` devolve `{ sequencia, recorde, taxa, total, calendario }`, com `calendario` de 16 semanas por 7 dias e estados `feito | parcial | descanso | vazio | fora | futuro`. Dias fora dos `weekdays` são `fora` e não entram na taxa. "Parcial" fica reservado para hábitos com quantidade (fora do MVP) e não aparece por enquanto.
- **Contrato**: os campos novos entram no `PUT /api/habits/:id` e no sync. As estatísticas vão numa rota `GET /api/habits/:id/stats` para não pesar o sync, ou no sync se a medição mostrar que é barato. Decidir medindo.
- **Lembrete**: só a preferência; a entrega segue a decisão de canal da spec 15.

## Testing Decisions

- Core: estatísticas com hábito de seg a sex (fim de semana não conta), com descanso, com histórico vazio e com hábito criado no meio da janela.
- API: migração de `active` para `state` sem perder hábitos; limite por dia ignora pausados; contagem de queries fixa na rota de estatísticas. Prior art: `habits.test.ts`, `habit-logs.test.ts`, `batch.test.ts`.

## Out of Scope

- Hábitos com quantidade (8 copos de água), que dariam o "feito em parte".
- Hábitos negativos (parar de fazer algo).
- Canal de entrega do lembrete.
