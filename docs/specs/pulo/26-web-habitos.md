# Spec 26: Página de Hábitos

Status: a fazer. Fonte visual: aba Hábitos de `apps/web/public/rascunhos/desktop.html`. Depende da spec 21. Dados das specs 16 e 17.

## Problem Statement

O app não tem uma página de hábitos: eles só aparecem no Hoje. A API já tem período, lembrete, estado, meta atrelada e estatísticas por hábito.

## Solution

Uma página `/habitos` com lista agrupada por período à esquerda e o detalhe do hábito à direita, no layout do rascunho.

## User Stories

1. Como pessoa, quero ver meus hábitos agrupados em Manhã, Tarde e Noite.
2. Como pessoa, quero ver em cada item o ícone, o nome, a frequência, a meta atrelada, o foguinho da sequência e o círculo de feito hoje.
3. Como pessoa, quero clicar num hábito e ver o detalhe ao lado.
4. Como pessoa, quero ver no detalhe as etiquetas de frequência, período, lembrete e meta.
5. Como pessoa, quero ver sequência, recorde, taxa de conclusão e vezes feito.
6. Como pessoa, quero ver o calendário das últimas 16 semanas com feito, descanso e não feito, e o dia de hoje destacado.
7. Como pessoa, quero ver a meta atrelada com barra e baú, e trocar a meta numa lista de opções ou deixar sem meta.
8. Como pessoa, quero um botão Ver meta que abre a meta na aba Metas.
9. Como pessoa, quero ajustar dias da semana, período e lembrete na seção Agenda.
10. Como pessoa, quero pausar e arquivar o hábito.
11. Como pessoa, quero criar um hábito novo pelo botão do topo.
12. Como pessoa, quero que dias fora da frequência não pareçam falha no calendário.

## Implementation Decisions

- **Dados**: hábitos do sync; estatísticas por `GET /api/habits/:id/stats` ao abrir o detalhe.
- **Edições**: `PUT /api/habits/:id` com `period`, `reminderMinutes`, `reminderOn`, `state`, `goalId`, `icon` e `color`. Respeitar o erro `limite_por_dia`.
- **Calendário**: grade de 16 colunas por 7 linhas com os estados da API; "parcial" não aparece enquanto não houver hábitos com quantidade.
- **Lembrete**: só grava a preferência; o aviso de verdade depende do canal de entrega (fora desta spec).
- **Layout**: lista de 380px e detalhe flexível no desktop; no celular, a lista abre o detalhe em tela própria.

## Testing Decisions

- Lógica pura: agrupamento por período, texto da frequência (todo dia, seg a sex, seg, qua, sex).
- Componentes: trocar meta grava `goalId`; pausar tira o hábito do Hoje; limite por dia mostra a mensagem. Prior art: `features/hoje/hoje.test.ts`.

## Out of Scope

- Hábitos com quantidade e hábitos negativos.
- Entrega do lembrete.
