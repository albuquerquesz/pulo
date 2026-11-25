# Spec 20: Tarefas em quadro (kanban)

Status: a fazer. Origem: rascunho, aba Tarefas (quadro, cartões e gaveta de detalhe) e bloco Tarefas de hoje no Hoje. Não existe nada de tarefa na API.

## Problem Statement

O rascunho tem um quadro com quatro colunas (Ideias, A fazer, Fazendo, Feito), cartões arrastáveis com prioridade, etiquetas, prazo, pomodoros e subtarefas, e uma gaveta no estilo do Linear para editar título, descrição, propriedades, subtarefas e comentários, com histórico de atividade. O Hoje mostra as tarefas marcadas para hoje. A API não tem modelo de tarefa, então nada disso é guardado.

## Solution

Um recurso novo de tarefas com subtarefas, comentários e atividade, no mesmo padrão das outras rotas: upsert por id gerado no cliente, escrita otimista no `RemoteRepository`, tudo restrito ao `userId` da sessão.

## User Stories

1. Como pessoa, quero ver minhas tarefas em colunas por estado, para saber o que está parado e o que está andando.
2. Como pessoa, quero arrastar uma tarefa entre colunas, para mudar o estado rápido.
3. Como pessoa, quero reordenar tarefas dentro da coluna, para pôr a mais importante em cima.
4. Como pessoa, quero criar uma tarefa direto numa coluna, pelo + do topo ou pelo Adicionar de baixo.
6. Como pessoa, quero marcar prioridade alta, para destacar o urgente.
7. Como pessoa, quero dar um prazo (hoje, esta semana ou uma data), para filtrar o que é para agora.
8. Como pessoa, quero filtrar o quadro por hoje e por esta semana, para ver só o que importa.
9. Como pessoa, quero etiquetar a tarefa por área (Faculdade, Pessoal, Saúde, Rotina), para separar os assuntos.
10. Como pessoa, quero atrelar a tarefa a uma meta, para ver o que ela empurra.
11. Como pessoa, quero estimar quantos pomodoros a tarefa leva e ver quantos já fiz, para planejar.
12. Como pessoa, quero focar numa tarefa e o pomodoro contar nela, para o progresso ser automático.
13. Como pessoa, quero escrever uma descrição longa na tarefa, para guardar detalhes e links.
14. Como pessoa, quero adicionar, editar, marcar e remover subtarefas, para quebrar o trabalho em passos.
15. Como pessoa, quero ver a contagem e a barra de subtarefas no cartão, para saber o avanço sem abrir.
16. Como pessoa, quero abrir a tarefa numa gaveta lateral, para editar sem sair do quadro.
17. Como pessoa, quero comentar na tarefa, para anotar o que aconteceu.
18. Como pessoa, quero ver o histórico da tarefa (criada, movida, prioridade mudada), para lembrar o caminho dela.
19. Como pessoa, quero concluir uma tarefa no Hoje com um toque, para não precisar ir até o quadro.
20. Como pessoa, quero excluir uma tarefa, para limpar o que não faz mais sentido.
21. Como pessoa, quero que a mudança feita num aparelho apareça no outro, para confiar no quadro.
22. Como pessoa conectada pelo Claude (MCP), quero criar e listar tarefas pelo assistente, para organizar conversando.

## Implementation Decisions

- **Modelo `Task`**: `id`, `userId`, `title`, `description`, `status: 'ideias' | 'afazer' | 'fazendo' | 'feito'`, `position` (ordem na coluna, número fracionário para reordenar sem reescrever a coluna), `priority: 'normal' | 'alta'`, `dueDate` (`DateKey` opcional; "esta semana" vira o domingo da semana no app), `tags` (lista curta de textos), `goalId` opcional, `pomodorosEstimated`, `createdAt`, `completedAt`.
- **Pomodoros feitos** não são gravados: são as sessões de foco terminadas com `taskId` (spec 19).
- **`TaskSubtask`**: `id`, `taskId`, `title`, `done`, `position`.
- **`TaskComment`**: `id`, `taskId`, `body`, `createdAt`. Só da própria pessoa.
- **Atividade**: derivada dos eventos gravados numa tabela `TaskEvent` (`kind`, `de`, `para`, `createdAt`) nas escritas que mudam status, prioridade ou prazo. Comentários aparecem junto na linha do tempo.
- **Rotas**: `PUT /api/tasks/:id`, `DELETE /api/tasks/:id`, `PUT /api/tasks/:id/subtasks/:subId`, `DELETE` idem, `POST /api/tasks/:id/comments`, `GET /api/tasks/:id/activity`. O sync traz tarefas e subtarefas; comentários e atividade vêm sob demanda ao abrir a gaveta.
- **Limites** (proposta, no `decisions.ts`): título até 200 caracteres, descrição até 10 mil, até 50 subtarefas por tarefa, até 10 etiquetas.
- **MCP**: ferramentas de listar, criar e mover tarefa, no padrão de `docs/mcp.md`.
- **Exportar e excluir conta** (spec 15) incluem tarefas, subtarefas, comentários e eventos.

## Testing Decisions

- Testar pela API: o que entra num `PUT` sai igual no sync; repetir o `PUT` não duplica nem gera outro número; mover entre colunas grava um evento só; tarefa de outra pessoa devolve 404; contagem de queries fixa com 1 e 50 tarefas.
- Core: schemas e o cálculo de pomodoros feitos a partir das sessões.
- Client: `repository-contract` cobre criar, mover, desfazer escrita otimista e conflito.
- Prior art: `goals.test.ts` (limites e upsert), `batch.test.ts` (lote), `sync.test.ts`.

## Out of Scope

- Tarefas compartilhadas, responsáveis e menções.
- Anexos de arquivo.
- Colunas personalizadas pela pessoa.
- Tarefas recorrentes (isso é hábito).

## Further Notes

- As tarefas não têm código curto nem número (decisão do Victor em 25/11/2026).
- As colunas são fixas nesta versão para manter o quadro simples.
