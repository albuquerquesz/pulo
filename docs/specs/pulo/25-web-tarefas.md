# Spec 25: Aba Tarefas com quadro e gaveta

Status: a fazer. Fonte visual: aba Tarefas de `apps/web/public/rascunhos/desktop.html`. Depende da spec 21. Dados da spec 20 (já em produção, sem código curto).

## Problem Statement

A API de tarefas existe, mas o app não tem nenhuma tela de tarefas. O rascunho define um quadro com quatro colunas, cartões arrastáveis e uma gaveta lateral no estilo do Linear.

## Solution

Uma tela de imersão `/tarefas` (sem trilho) com o quadro, filtros e a gaveta de detalhe.

## User Stories

1. Como pessoa, quero ver as colunas Ideias, A fazer, Fazendo e Feito, com a contagem de cada uma, para entender meu trabalho.
2. Como pessoa, quero que as colunas tenham a mesma altura e o Adicionar fique sempre no pé de cada coluna.
3. Como pessoa, quero um + no topo da coluna que só aparece quando passo o mouse nela, para criar sem poluir.
4. Como pessoa, quero filtrar por Todas, Hoje e Esta semana.
5. Como pessoa, quero cartões com título, chips de prioridade (barrinhas, laranja quando alta) com os pomodoros, etiquetas com bolinha colorida e prazo.
6. Como pessoa, quero ver a seção de subtarefas no cartão só quando a tarefa tem subtarefas, com contagem, barra fina e seta para abrir.
7. Como pessoa, quero marcar subtarefas direto no cartão aberto.
8. Como pessoa, quero arrastar cartões entre colunas e dentro da coluna.
9. Como pessoa, quero que o cartão em Feito apareça riscado.
10. Como pessoa, quero clicar no cartão e abrir uma gaveta à direita com fundo escurecido, que fecha com Esc, clique fora ou o botão fechar.
11. Como pessoa, quero editar o título direto na gaveta.
12. Como pessoa, quero uma descrição sem caixa, só texto que cresce.
13. Como pessoa, quero ver, marcar, editar, remover e adicionar subtarefas na gaveta, com Enter para adicionar.
14. Como pessoa, quero ver a atividade da tarefa (criada, movida, prioridade) e comentar com Enter ou o botão de enviar.
15. Como pessoa, quero as propriedades numa coluna à direita como linhas com ícone que abrem uma lista: Status, Prioridade, Prazo e Pomodoros.
16. Como pessoa, quero adicionar e tirar etiquetas, e atrelar a tarefa a uma meta.
17. Como pessoa, quero botões redondos no topo da gaveta para focar na tarefa, excluir e fechar.

## Implementation Decisions

- **Dados**: `tasks`, `subtasks` e `pomodoros` do sync; atividade e comentários sob demanda ao abrir a gaveta (`GET /api/tasks/:id/activity`). Escritas pelo `RemoteRepository` com escrita otimista.
- **Mover para Feito** exige `completedAt` (regra da API); sair de Feito limpa `completedAt`.
- **Ordem**: `position` fracionário com o passo de `TASKS.positionStep`; soltar entre dois cartões usa a média das posições.
- **Arrastar**: HTML5 drag and drop no desktop; no celular, segurar e arrastar com pointer events, ou um menu de mover.
- **Gaveta**: 1000px de largura no desktop (tela inteira no celular), duas colunas com a lateral de 250px. Os selects podem ser `select` nativo estilizado, como no rascunho, ou um menu próprio acessível.
- **Focar na tarefa**: navega para `/casa` com o vínculo `taskId` no timer.
- **Etiquetas**: lista do rascunho (Faculdade, Pessoal, Saúde, Rotina e as metas), com as cores de bolinha do rascunho. Se virar configurável, é outra spec.
- **Sem código curto**: o topo da gaveta não mostra código (decisão do Victor de 25/11/2026).

## Testing Decisions

- Lógica pura: posição ao soltar entre cartões, filtros por prazo, contagens por coluna, regra do `completedAt`.
- Componentes: arrastar muda o status no repositório; abrir a gaveta carrega a atividade; adicionar subtarefa com Enter; comentar com Enter; Esc fecha. Prior art: testes de `features/metas`.

## Out of Scope

- Colunas personalizadas, tarefas compartilhadas, anexos.
