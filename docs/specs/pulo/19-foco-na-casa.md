# Spec 19: Foco na casa, com intenção e vínculo

Status: a fazer. Origem: rascunho, aba Casa (quarto com o sapo, botão Focar, tela do timer) e cartão de foco do Hoje. Estende a spec 06.

## Problem Statement

`FocusSession` hoje guarda início, fim, duração planejada, estado, pausa e um bloco da rotina opcional. O rascunho pede:

- escolher a duração de 15 a 50 minutos numa tela própria antes de começar;
- dizer no que vai focar (intenção em texto) e atrelar a sessão a um hábito, uma meta ou uma tarefa (spec 20);
- uma meta diária de minutos de foco, com barra no Hoje;
- o Hoje mostrar o próximo foco do dia com horário e intenção;
- saber quantas sessões foram terminadas e quantas largadas, e para onde foi o foco da semana;
- joias por minuto focado (spec 18).

A API não guarda intenção, vínculo com hábito, meta ou tarefa, nem a meta diária.

## Solution

`FocusSession` ganha intenção e um vínculo opcional; o resumo da semana passa a dizer para onde foi o foco; e o Hoje recebe o "próximo foco" calculado a partir da rotina.

## User Stories

1. Como pessoa, quero escolher quantos minutos vou focar antes de começar, para encaixar no meu tempo.
2. Como pessoa, quero escrever no que vou focar, para entrar com clareza.
3. Como pessoa, quero atrelar o foco a um hábito, para o foco contar para ele.
4. Como pessoa, quero atrelar o foco a uma meta, para ver o tempo dedicado a ela.
5. Como pessoa, quero atrelar o foco a uma tarefa, para somar pomodoros nela.
6. Como pessoa, quero focar sem vínculo nenhum, para não ser obrigada a classificar.
7. Como pessoa, quero que o foco termine sozinho no tempo escolhido, para não precisar olhar o relógio.
8. Como pessoa, quero parar antes da hora, para respeitar quando não dá.
9. Como pessoa, quero ver no Hoje o meu próximo foco com horário e intenção, para começar com um clique.
10. Como pessoa, quero ter uma meta de minutos por dia e ver a barra enchendo, para saber quanto falta.
11. Como pessoa, quero ver para onde foi meu foco da semana (por hábito, meta ou sem vínculo), para saber onde meu tempo está indo.
12. Como pessoa, quero ver quantas sessões terminei e quantas larguei, para me conhecer sem culpa.
13. Como pessoa, quero ver as joias subindo enquanto foco, para sentir o ganho na hora.
14. Como pessoa, quero que o sapo ande pelo quarto enquanto foco, para a tela ficar viva sem me distrair.
15. Como pessoa, quero focar em tela cheia, para tirar o resto da frente.

## Implementation Decisions

- **Schema de `FocusSession`**: `intention` (texto curto, opcional) e um vínculo opcional com no máximo um alvo: `habitId`, `goalId` ou `taskId`, cada um com `onDelete: SetNull`. O vínculo de tarefa depende da spec 20.
- **Duração**: continua validada por `FOCUS.minMinutes` e `FOCUS.maxMinutes`. A duração padrão por pessoa vem da spec 15.
- **Meta diária**: preferência `dailyFocusGoalMinutes` da spec 15; o progresso do dia é calculado.
- **Resumo da semana** (`/api/week-summary`) ganha `focoPorAlvo: { alvo, minutos }[]`, `sessoesTerminadas`, `sessoesLargadas` e `melhorPeriodo`.
- **Próximo foco**: função pura que olha os blocos da rotina de hoje e as sessões já feitas e devolve o próximo bloco de foco, para o cartão do Hoje e a Linha do dia.
- **Tempo na tela**: o servidor não muda; esconder o cronômetro, o sapo andando e a tela cheia são só do app.

## Testing Decisions

- Core: próximo foco com rotina vazia, com o bloco atual em andamento e depois do último bloco; soma de foco por alvo com sessões sem vínculo.
- API: sessão com dois alvos ao mesmo tempo é recusada (400); alvo de outra pessoa devolve 404; apagar o hábito deixa a sessão sem vínculo. Prior art: `sessions.test.ts`, `week-summary.test.ts`.

## Out of Scope

- Modo foco profundo que bloqueia outros apps.
- Multiplicador de recompensa.
- Contagem progressiva sem tempo definido.
- Sons de fundo tocados pelo servidor (o arquivo de áudio é do app).
