# Spec 22: Tela Hoje

Status: a fazer. Fonte visual: aba Hoje de `apps/web/public/rascunhos/desktop.html`. Depende da spec 21. Dados das specs 13, 17, 19 e 20.

## Problem Statement

O Hoje atual mostra a lagoa, os hábitos do dia, o próximo bloco e o botão de descanso. O rascunho aprovado troca isso por um painel do dia: saudação com o próximo foco, sequência com barra da semana, gráfico da semana, hábitos de hoje, tarefas de hoje e a linha do dia com progresso.

## Solution

Refazer o Hoje na ordem do rascunho, cada bloco alimentado pela API que já existe.

## User Stories

1. Como pessoa, quero ser saudada pelo nome com bom dia, boa tarde ou boa noite, para o app parecer meu.
2. Como pessoa, quero ver meu próximo foco no topo, com um anel de 25 minutos, o título e o hábito atrelado, para começar sem pensar.
3. Como pessoa, quero um botão grande Começar foco no topo, que abre a Casa já com o timer.
4. Como pessoa, quero um cartão Sequência com o foguinho e os dias seguidos, para sentir o embalo.
5. Como pessoa, quero ver a semana em letras D S T Q Q S S coloridas por estado (feito, descanso, hoje), com uma barra que enche até hoje e um foguinho apagado no fim, para saber quanto falta para fechar a semana.
6. Como pessoa, quero o gráfico Esta semana com barras por dia, descanso em roxo, e os totais de foco e joias, para ver meu ritmo.
7. Como pessoa, quero marcar meus hábitos de hoje com um toque e ver o feito riscado, para registrar rápido.
8. Como pessoa, quero ver as tarefas marcadas para hoje e concluir com um quadradinho, para não ir até o quadro.
9. Como pessoa, quero um link Ver quadro nas tarefas, para abrir a aba Tarefas.
10. Como pessoa, quero a linha do dia com cada bloco num círculo de mesmo tamanho com emoji, ligados por uma linha que fica verde até agora e cinza depois.
11. Como pessoa, quero um ponto laranja com a hora atual na linha, para saber onde estou no dia.
12. Como pessoa, quero que o bloco atual tenha um botão Focar, para começar o foco daquele bloco.
13. Como pessoa, quero ver o tempo livre entre blocos, como livre 4h, para enxergar respiros.
14. Como pessoa, quero que tudo isso funcione no celular em uma coluna.

## Implementation Decisions

- **Saudação**: hora local do fuso da pessoa (`metadata.timezone`) decide bom dia, boa tarde ou boa noite; função pura com `now`.
- **Próximo foco**: a função de domínio de próximo foco da spec 19 (rotina de hoje e sessões feitas). Começar foco navega para `/casa` com o vínculo já preenchido no modal do timer (spec 23).
- **Sequência**: `streak` do sync (spec 13). A barra enche até o índice de hoje; o foguinho do fim acende quando os 7 dias estão feitos ou em descanso.
- **Esta semana**: `/api/week-summary` com os campos de foco e joias.
- **Hábitos de hoje**: hábitos `ativo` do dia da semana, marcação pelo `habit-logs` (escrita otimista já existe). Sem botão de novo hábito aqui, como no rascunho.
- **Tarefas de hoje**: tarefas com `dueDate` igual a hoje, feitas por último. O quadradinho alterna entre feito (com `completedAt`) e a fazer. Sem etiqueta de coluna e sem botão focar, como no rascunho.
- **Linha do dia**: blocos de hoje (`RoutineBlock` com `icon`, spec 17). A posição da linha de progresso e do ponto da hora atual é calculada pela hora real, não fixa; o rascunho fixa 14h38 só como exemplo.
- **Ordem dos blocos na tela**: topo, Sequência, Esta semana, Hábitos de hoje, Tarefas de hoje, Linha do dia.

## Testing Decisions

- Lógica pura com relógio fixo: saudação por hora, estado de cada dia da barra, quanto da barra enche, posição do ponto da hora atual entre blocos, cálculo de tempo livre. Prior art: `features/hoje/hoje.test.ts`.
- Componentes: marcar hábito e concluir tarefa atualizam a tela e chamam o repositório; Começar foco navega para `/casa`.

## Out of Scope

- Criar hábito ou tarefa pelo Hoje.
- A lagoa antiga (sai do Hoje).

## Further Notes

- Texto e espaçamentos exatos estão no rascunho (rótulos em maiúsculas, tamanhos e cores).
