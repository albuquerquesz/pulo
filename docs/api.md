# API de domínio

REST em Hono (`apps/api`), toda atrás de login (Better Auth). Cada rota lê a sessão do cookie, usa só o `userId` dela e nunca
devolve nem altera linhas de outra pessoa. Os schemas de entrada e saída moram em `packages/core/api/schemas.ts`
(`@pulo/core/api/schemas`) e valem para o servidor e para o app.

Cliente tipado no app: `import type { AppType } from '@pulo/api/src/app'` e `hc<AppType>(url, { init: { credentials: 'include' } })`.
Sessão, cookie, CSRF e variáveis de ambiente: [web-auth.md](web-auth.md).
O teste `apps/api/src/client.test.ts` prova a inferência de rotas, corpos e respostas.

## Convenções

- Escrita é upsert com id gerado pelo cliente (uuid, ou `prefixo-instante-aleatório` de `newId` do core, com 12 símbolos de `crypto.getRandomValues`): repetir o mesmo `PUT` é seguro e não duplica.
  O id do caminho precisa ser igual ao do corpo (senão 400 `id_divergente`; em hábito feito vale também `data_divergente`).
- Corpo e respostas espelham `packages/core/domain/types.ts`: `RoutineBlock`, `Habit`, `HabitLog`, `FocusSession`,
  `RestDay`, `WeeklyProposal`, `MascotState`. Datas são `DateKey` ('AAAA-MM-DD'), instantes são ms.
- `DELETE` é idempotente: responde 200 com `{ deleted: n }` (n = 0 se já não existia).
- `from` e `to` são `DateKey`, opcionais e incluídos nos extremos. Sessões filtram pelo dia lógico de término, no fuso da pessoa
  (`metadata.timezone`, padrão `America/Sao_Paulo`), e a sessão em andamento sempre vem.
- Instantes enviados pelo app não podem estar mais de 5 minutos no futuro do relógio do servidor (400 `horario_no_futuro`).
- "Queries" abaixo é o total de SQL por chamada: 2 da sessão do Better Auth (sessão e usuário) mais as da rota.
  O número não depende da quantidade de dados: cada rota tem um teste que compara 1 registro com 50 (`countQueries`).
  Nas rotas que acertam o gelo, a primeira chamada do dia faz ainda as gravações do acerto.
  Escritas com `upsert` usam `INSERT ... ON CONFLICT` do Prisma (uma query); BEGIN e COMMIT não entram na conta.

## Erros

Corpo sempre `{ "error": "<codigo>", "message": "<texto>", "issues"?: [{ "path", "message" }] }` (schema `apiErrorSchema`).
Nunca há stack trace; erro inesperado vira 500 `erro_interno` e o detalhe fica só no log do Worker.

| Status | Código | Quando |
| --- | --- | --- |
| 401 | `nao_autenticado` | sem sessão ou cookie inválido |
| 403 | `origem_nao_permitida` | `PUT`, `PATCH`, `POST` ou `DELETE` em `/api/*` (fora `/api/auth/*`) com `Origin` que não está em `PULO_CORS_ORIGIN` (inclui `null`) |
| 403 | `origem_ausente` | os mesmos métodos sem `Origin`, mas com cookie ou `Sec-Fetch-Site` (navegador sempre manda `Origin` nestes métodos) |
| 400 | `corpo_invalido` | JSON quebrado ou fora do schema (duração do bloco fora de 5 a 120, foco planejado fora dos limites de `FOCUS`, sessão incoerente, proposta fora do formato, `weekStart` que não é segunda) |
| 400 | `consulta_invalida` | `from`/`to`/`date` inválidos, `from` depois de `to`, intervalo do sync maior que 400 dias |
| 400 | `parametro_invalido` | id ou data inválidos no caminho |
| 400 | `id_divergente`, `data_divergente` | caminho diferente do corpo |
| 400 | `horario_no_futuro` | instante do app no futuro |
| 404 | `referencia_inexistente` | hábito (do registro), bloco ou vínculo (da sessão) ou meta (da tarefa e do hábito) que não existe ou é de outra pessoa |
| 404 | `rota_inexistente` | rota não existe |
| 409 | `conflito_de_id` | id já usado por outra pessoa (nunca sobrescreve). No lote, `issues` lista `blocks.N.id` ou `habits.N.id` e nada é salvo |
| 409 | `limite_por_dia` | passaria de `MAX_HABITS_PER_DAY` hábitos ativos no mesmo dia da semana. No lote, `issues` lista `habits.N.weekdays` e nada é salvo |
| 409 | `limite_de_metas` | passaria de `GOALS.maxActive` metas ativas (concluídas não contam) |
| 404 | `meta_inexistente` | `POST /api/goals/:id/chest` numa meta que não existe ou é de outra pessoa |
| 409 | `meta_nao_concluida` | abrir o baú de uma meta que não está concluída |
| 409 | `bau_ja_aberto` | o baú dessa meta já foi aberto |
| 409 | `limite_de_subtarefas` | passaria de `TASKS.maxSubtasks` subtarefas na tarefa |
| 404 | `item_inexistente` | compra ou mudança de lugar de um item que não está no catálogo da rota (`HOUSE`, `ROOM_DECOR` ou, na ilha antiga, `ISLAND`) |
| 400 | `preco_divergente` | compra com `cost` diferente do preço do catálogo |
| 409 | `ja_comprado` | item já comprado (inclui o `quarto` e a `lagoa`, que já vêm prontos, o mesmo item com outro corpo e dois aparelhos comprando juntos) |
| 409 | `fora_de_ordem` | só na ilha antiga: área que não é a próxima do mapa |
| 409 | `area_fechada` | só na ilha antiga: enfeite de uma área que ainda não foi aberta |
| 409 | `joias_insuficientes` | o saldo de joias não paga o item. A mensagem diz quantas faltam |
| 409 | `gelo_no_maximo` | já há `GELO.maxGuardados` gelos guardados |
| 400 | `descanso_so_hoje` | marcar ou desmarcar descanso em um dia que não é o de hoje |
| 409 | `limite_de_descanso` | passaria de `DESCANSO.maxPorSemana` descansos na semana do app |
| 409 | `sessao_em_andamento` | já existe outra sessão em andamento (índice único parcial no banco) |
| 409 | `sessao_encerrada` | mudança numa sessão `concluida` ou `interrompida` |
| 409 | `sessao_imutavel` | mudou início, duração planejada ou bloco de uma sessão em andamento |
| 409 | `proposta_transicao_invalida`, `proposta_imutavel` | máquina de estados da proposta (abaixo) |
| 404 | `nao_encontrado` | proposta (`POST /api/proposals/:id/decision`) ou tarefa que não existe ou é de outra pessoa; item do quarto não comprado |
| 409 | `semana_ja_tem_proposta` | já há outra proposta nessa semana |
| 409 | `bloco_mudou` | aceitar, editar ou desfazer, mas um bloco da proposta não está mais no horário que a proposta espera (mexido em outro aparelho, ou apagado). Nada é gravado |
| 409 | `horario_ocupado` | o horário de destino (ou o de volta, ao desfazer) bate em outro bloco. Nada é gravado |
| 409 | `conflito_concorrente` | duas escritas simultâneas colidiram (tente de novo) |
| 500 | `erro_interno` | falha inesperada |

## Rotas

Todas com cookie de sessão. Queries = total por chamada (2 da sessão + as da rota).

| Método e caminho | Corpo | Resposta 200 | Queries |
| --- | --- | --- | --- |
| `GET /api/blocks` | | `{ blocks: RoutineBlock[] }` | 3 |
| `PUT /api/blocks` (lote) | `{ blocks: RoutineBlock[] }` (`icon` pode ser `null`), 1 a 100 | `{ blocks }` | 3 com 1 ou com 100 |
| `PUT /api/blocks/:id` | `RoutineBlock` (`icon` pode ser `null`) | `{ block }` | 3 |
| `DELETE /api/blocks/:id` | | `{ deleted }` | 3 |
| `GET /api/habits` | | `{ habits: Habit[] }` | 3 |
| `PUT /api/habits` (lote) | `{ habits: Habit[] }`, 1 a 50 | `{ habits }` | 4 com 1 ou com 50 (5 quando algum traz meta) |
| `PUT /api/habits/:id` | `Habit` (opcionais aceitam `null`; veja Hábitos) | `{ habit }` | 4 (5 quando traz meta) |
| `GET /api/habits/:id/stats` | | `{ stats: HabitStats }` (404 `referencia_inexistente`) | 5 |
| `DELETE /api/habits/:id` | | `{ deleted }` (os registros do hábito saem junto) | 9 |
| `GET /api/habit-logs?from&to` | | `{ habitLogs: HabitLog[] }` | 3 |
| `PUT /api/habit-logs/:habitId/:date` | `HabitLog` | `{ habitLog, newAchievements }` | 12 (mais ao destravar) |
| `DELETE /api/habit-logs/:habitId/:date` | | `{ deleted }` | 9 |
| `GET /api/sessions?from&to` | | `{ sessions: FocusSession[] }` | 3 |
| `PUT /api/sessions/:id` | `FocusSession` (`intention` e vínculo aceitam `null`) | `{ session, mascot: MascotState \| null, newAchievements }` | 4 em andamento, 16 ao encerrar (mais ao destravar); 1 a mais ao gravar um vínculo novo |
| `GET /api/rest-days?from&to` | | `{ restDays: RestDay[] }` | 3 |
| `PUT /api/rest-days/:date` | (sem corpo) | `{ restDay, mascot: MascotState, newAchievements }` | 17 (mais ao destravar) |
| `DELETE /api/rest-days/:date` | | `{ deleted, mascot: MascotState }` | 15 |
| `GET /api/proposals` | | `{ proposals: WeeklyProposal[] }` (semana mais nova primeiro) | 3 |
| `PUT /api/proposals/:id` | `WeeklyProposal` | `{ proposal }` | 4 |
| `POST /api/proposals/generate` | `{ date? }` (qualquer dia da semana) | `{ outcome, proposal? }` | 8 sem criar, 9 criando |
| `POST /api/proposals/:id/decision` | `{ action: 'aceitar' \| 'editar' \| 'negar' \| 'desfazer', change? }` | `{ proposal, blocks }` | 6 aplicando blocos, 5 ao negar, 4 repetindo |
| `GET /api/goals` | | `{ goals: Goal[], chests: GoalChest[] }` (mais antiga primeiro) | 4 |
| `PUT /api/goals/:id` | `Goal` (marcos dentro) | `{ goal }` | 4 |
| `DELETE /api/goals/:id` | | `{ deleted }` (o baú sai junto; hábitos e tarefas ficam sem a meta) | 3 |
| `POST /api/goals/:id/chest` | (sem corpo) | `{ chest: GoalChest }` | 4 |
| `GET /api/tasks` | | `{ tasks: Task[], subtasks: TaskSubtask[], pomodoros }` | 5 |
| `PUT /api/tasks/:id` | `Task` | `{ task }` | 6 criando ou mudando coluna, prioridade ou prazo (5 sem mudança neles; 1 a mais ao trocar a meta) |
| `DELETE /api/tasks/:id` | | `{ deleted }` (subtarefas, comentários e histórico saem junto) | 4 |
| `PUT /api/tasks/:id/subtasks/:subId` | `TaskSubtask` | `{ subtask }` | 6 |
| `DELETE /api/tasks/:id/subtasks/:subId` | | `{ deleted }` | 3 |
| `POST /api/tasks/:id/comments` | `TaskComment` | `{ comment }` | 6 criando, 5 repetindo |
| `GET /api/tasks/:id/activity` | | `{ events: TaskEvent[], comments: TaskComment[] }` | 5 |
| `GET /api/island/purchases` | | `{ purchases: IslandPurchase[] }` (mais antiga primeiro) | 3 |
| `PUT /api/island/purchases/:item` | `IslandPurchase` | `{ purchase }` | 10 comprando, 9 repetindo |
| `GET /api/house` | | `{ purchases: Purchase[], joiaCredit: number }` | 4 |
| `PUT /api/house/:item` | `Purchase` | `{ purchase, newAchievements }` | 19 comprando (mais ao destravar) |
| `GET /api/room` | | `{ decor: RoomDecor[] }` (mais antiga primeiro) | 3 |
| `PUT /api/room/:item` | `RoomDecor` | `{ decor }` | 13 comprando |
| `PATCH /api/room/:item` | `RoomSpot` | `{ item, spot }` | 3 |
| `GET /api/mascot` | | `{ mascot: MascotState \| null }` | 3 |
| `GET /api/week-summary?date` | | `{ summary: WeekSummary }` | 5 |
| `GET /api/streak` | | `{ streak: Streak }` | 8 |
| `GET /api/gelo` | | `{ guardados, max, usados, recentes, compras }` | 10 |
| `POST /api/gelo` | (sem corpo) | o mesmo de `GET /api/gelo` | fixo |
| `PUT /api/gelo/visto` | (sem corpo) | `{ vistos: n }` | 3 |
| `GET /api/profile/metrics` | | `{ metrics: ProfileMetrics }` | fixo |
| `GET /api/stats` | | `{ stats: ProfileStats }` | 4 |
| `GET /api/achievements` | | `{ achievements: Achievement[] }` | 8 |
| `GET /api/data/export` | | arquivo JSON com tudo da pessoa | 21 |
| `DELETE /api/account` | `{ confirm: 'EXCLUIR' }` | `{ deleted: true }` e o cookie apagado | fixo (igual com 1 ou 50 registros) |
| `GET /api/mcp/connections` | | `{ connections: McpConnection[] }` (a mais recente primeiro) | 3 |
| `DELETE /api/mcp/connections/:clientId` | | `{ deleted }` | 6 |
| `GET /api/sync?from&to` | | ver abaixo (inclui `goals`, `goalChests`, `tasks`, `subtasks`, `islandPurchases`, `housePurchases`, `roomDecor`, `joiaCredit`, `streak`, `stats`, `achievements`, `gelo`, `gelosComprados` e `descanso`) | 23 |
| `DELETE /api/data` | | `{ deleted: { sessions, blocks, habits, restDays, proposals, goals, islandPurchases, mascot, tasks, achievements, freezeUses } }` | 14 |

Já existiam e continuam: `GET /health`, `/api/auth/*`, `GET /api/me`, `PATCH /api/me/metadata`, `POST /weekly-ai`.

### Preferências: `PATCH /api/me/metadata`

Além de tema, movimento, fuso, onboarding e `profile`, o `metadata` guarda as preferências (tipo `Preferences`; padrões em
`PREFERENCES` e `FOCUS` do `decisions.ts`). Contas antigas leem os padrões; um valor guardado fora dos limites vira o padrão.

| Campo | Valores | Padrão |
| --- | --- | --- |
| `focusMinutes` | `FOCUS.minMinutes` a `FOCUS.maxMinutes` (15 a 50) | 25 |
| `breakMinutes` | 3 a 15 | 5 |
| `dailyFocusGoalMinutes` | 5 a 480, ou `null` (sem meta) | `null` |
| `eveningReminder` | `{ ligado, minutos }` (minutos desde 00:00) | desligado, 1260 |
| `vacation` | no `PATCH` só `{ ligado }`; lido como `{ ligado, desde, periodos: [{ de, ate }] }` | desligado |
| `sounds`, `aiEnabled` | booleano | `true` |
| `ambientSound` | `silencio`, `lagoa` ou `chuva` | `silencio` |

- **Lembrete da noite:** só a preferência é gravada. Nada é enviado ainda.
- **Férias:** o servidor marca as datas (dia da pessoa). Ao desligar, o trecho até hoje vira um período em `periodos` (até
  `PREFERENCES.maxVacationPeriods`). Os dias de férias contam como descanso **só na sequência** (não rendem joias nem dias de cuidado).
- **IA desligada** (`aiEnabled: false`): `POST /api/proposals/generate` usa só a regra, sem chamar o provedor. O MCP continua funcionando.
- A duração do foco é uma sugestão para o timer: as sessões continuam aceitando qualquer valor dentro de `FOCUS`.

### Estatísticas: `GET /api/stats`

`{ stats: { habitosFeitos, minutosDeFoco, desde } }`, de todo o histórico; o mesmo objeto vem em `stats` no `/api/sync`.
`minutosDeFoco` soma as sessões encerradas (concluídas e interrompidas), sem as pausas e até o planejado, em minutos inteiros.
`desde` é o instante (ms) em que a conta foi criada. Regra pura em `@pulo/core/domain/stats`.

### Nome e foto: `POST /api/auth/update-user`

Rota do Better Auth. Corpo `{ name?, image? }`: nome de 1 a `ACCOUNT.nameMaxChars` (80) letras; foto é um endereço `https`
(até 2048) ou `null`. Qualquer outro campo é recusado com 400 `corpo_invalido`. Não há envio de arquivo.

### Exportar: `GET /api/data/export`

Download (`Content-Disposition`, `Cache-Control: no-store`) com `exportVersion`, `exportedAt`, `user` (id, nome, email, foto, criação),
`metadata`, `blocks`, `habits`, `habitLogs`, `sessions`, `restDays`, `proposals`, `goals`, `goalChests`, `tasks`, `subtasks`, `taskComments`,
`taskEvents`, `housePurchases`, `roomDecor`, `islandPurchases`, `joiaCredit`, `mascot`, `achievements` (id e data), `freezeUses`,
`freezePurchases` e `connections`.
Sem recorte de datas. Nunca entram tokens, segredos, sessões de login nem contas OAuth. Tabela nova com `userId` precisa entrar
no arquivo (`data-export.test.ts` cobra).

### Excluir a conta: `DELETE /api/account`

O corpo precisa trazer `{ "confirm": "EXCLUIR" }` (senão 400 `corpo_invalido`; a tela pede a confirmação antes). Apaga o usuário e,
por cascata, todas as tabelas dele, inclusive login e OAuth; também os códigos de autorização em `verification`. Um cliente OAuth
registrado por ele e usado por outra pessoa só perde o dono. A resposta apaga o cookie. Não tem volta; entrar de novo cria uma conta vazia.
A autorização dada no Google não é revogada.

### Aplicativos conectados: `/api/mcp/connections`

`McpConnection`: `{ clientId, name, scopes, connectedAt, updatedAt }`, um por cliente OAuth liberado (o Claude pode registrar
mais de um). `DELETE /:clientId` apaga consentimento, tokens e códigos daquele cliente só para a pessoa; o `/mcp` passa a
responder 401 na hora. Idempotente (`{ deleted: 0 }`).

### Escrita em lote

`PUT /api/blocks` e `PUT /api/habits` existem para o onboarding (o plano de exemplo tem 15 blocos e 2 hábitos: eram 17 chamadas, agora são 2).
Corpo `{ blocks: [...] }` ou `{ habits: [...] }` (limites `API_LIMITS.batchMaxBlocks` = 100 e `batchMaxHabits` = 50), resposta com a mesma lista.
- Cada item segue as regras da rota de um item (`routineBlockInputSchema` e `habitInputSchema`, id de outra pessoa, limite por dia).
  Ids repetidos no mesmo lote dão 400 `corpo_invalido`.
- Atômico: nada é salvo se algum item falhar. O erro lista os itens: `issues` com `path` `blocks.3.durationMinutes`, `habits.1.title`,
  `habits.0.weekdays` (409 `limite_por_dia`) ou `blocks.2.id` (409 `conflito_de_id`).
- Queries constantes: um `INSERT ... SELECT ... FROM unnest(arrays) ON CONFLICT (id) DO UPDATE ... WHERE userId = EXCLUDED.userId`
  no lugar de um `upsert` por item. No de hábitos há antes uma leitura dos hábitos da pessoa (o limite por dia conta o lote junto com os outros ativos, e os campos omitidos vêm do gravado),
  numa transação serializável. Se alguma linha foi pulada por ser de outra pessoa, a transação desfaz e uma query lista quem foi (só no caminho de erro).
- O `RemoteRepository` expõe `saveBlocks` e `saveHabits` (`BatchWrites` do core); `criarPlanoInicial` os usa quando existem.

### Regras de cada recurso

- **Blocos**: duração de 5 a 120 minutos (`BLOCK_MIN_MINUTES`, `BLOCK_MAX_MINUTES`), início e fim dentro do dia, `weekday` de 0 a 6.
  O servidor não checa sobreposição entre blocos (isso continua no app).
- **Hábitos**: no máximo `MAX_HABITS_PER_DAY` hábitos `ativo` por dia da semana, checado na escrita (inclusive ao reativar),
  numa transação serializável. Dias repetidos são removidos e ordenados. Pausado e arquivado não contam.
  - Campos (spec 17): `state` (`ativo`, `pausado`, `arquivado`), `icon` (emoji curto, até `HABITS.iconMaxChars`), `color`
    (um de `ACCENT_COLORS`), `period` (`manha`, `tarde`, `noite`), `reminderMinutes` (0 a 1439) e `reminderOn` (só vem quando
    ligado; sem horário o servidor desliga). Só a preferência: nenhum lembrete é enviado.
  - Na escrita, opcional omitido mantém o gravado e `null` limpa (`reminderOn` desliga com `false`).
  - Compatibilidade: a resposta (também no sync e na exportação) ainda traz `active`, igual a `state === 'ativo'`. Na escrita,
    `state` vence; sem ele, `active: true` ativa e `active: false` arquiva um ativo e mantém um pausado ou arquivado; sem os
    dois fica o estado gravado (hábito novo nasce `ativo`).
  - Pausado sai do Hoje; arquivado também some das listas (inclusive a de hábitos da meta). O histórico dos dois continua
    na sequência, nas conquistas, nas joias, nas estatísticas e nos números da meta.
  - **Estatísticas** (`statsDoHabito` em `@pulo/core/domain/habit-stats`): `{ sequencia, recorde, taxa, total, calendario }`.
    `calendario` tem `HABITS.statsWeeks` semanas de 7 dias com `feito`, `descanso` (descanso marcado ou férias), `vazio`,
    `fora` (fora dos `weekdays` ou antes de o hábito começar) e `futuro`; `parcial` está reservado. O hábito começa no mais antigo
    entre a criação e o primeiro registro. Descanso e dia fora não quebram a sequência nem entram na taxa; dia feito conta sempre
    para sequência e total, e só os da frequência para a taxa; hoje vazio ainda não conta. `taxa` vai de 0 a 1 (`null` sem dia
    que conte). Entram no máximo `HABITS.statsMaxDays` dias. O período em que ficou pausado não é guardado e conta como os outros.
- **Ícone do bloco**: `RoutineBlock.icon` (emoji curto, até `HABITS.iconMaxChars`); omitido mantém, `null` tira.
- **Hábitos feitos**: uma marca por hábito e dia; repetir mantém a primeira (`doneAt` original). O hábito precisa ser da pessoa.
- **Sessões de foco**: `plannedMinutes` de `FOCUS.minMinutes` a `FOCUS.maxMinutes`; `em_andamento` não tem `endedAt`, encerrada tem
  e `endedAt >= startedAt`; uma só `em_andamento` por pessoa (409 `sessao_em_andamento`, mesmo pausada). Pausar e retomar são
  `PUT` da mesma sessão (`pausedSince`, `pausedMs`). Encerrada (`concluida` ou `interrompida`) é imutável: mudar dá 409
  `sessao_encerrada`; repetir exatamente o mesmo corpo é aceito (retry seguro). O `blockId` precisa ser bloco da pessoa.
- **Intenção e vínculo** (spec 19): `intention` (até `FOCUS.intentionMaxChars` letras, aparada, não vazia) e no máximo um entre
  `habitId`, `goalId` e `taskId` (dois juntos: 400 `corpo_invalido`).
  - No `PUT`, campo omitido mantém o gravado (clientes antigos não os apagam), `null` limpa e mandar um alvo troca o anterior.
    Mudam só enquanto a sessão está em andamento (ou na própria gravação que a encerra); encerrada, mudar dá 409 `sessao_encerrada`.
  - Alvo de outra pessoa: 404 `referencia_inexistente`. Alvo que não existe: 404 numa sessão nova; numa sessão que já existe
    (apagado em outro aparelho) o pedido é aceito e fica o vínculo gravado, para o foco não se perder.
  - Apagar o hábito, a meta ou a tarefa deixa a sessão sem vínculo. Hábito pausado ou arquivado e tarefa feita podem ser alvo.
- **Próximo foco e meta do dia** não são rotas: `proximoFoco` (bloco de foco de hoje que está aberto, no horário ou ainda por vir)
  e `focoDoDia` (minutos de hoje, contando o foco aberto, contra `dailyFocusGoalMinutes`) em `@pulo/core/domain/foco`.
- **Sapo**: ao encerrar uma sessão e ao criar ou apagar um descanso, o servidor recalcula com `computeMascotState` do core
  (a fase e os dias de cuidado nunca regridem) e grava em `mascot_state`. A resposta traz o estado novo (`mascot`; `null` só
  quando a sessão segue em andamento).
- **Propostas**: uma por pessoa e semana (`weekStart` é segunda). `pendente` vai para `aceita`, `editada`, `negada` ou `expirada`.
  Decidida só volta a `pendente` (desfazer) até `WEEKLY_AI.undoSeconds` + 5 s depois de `decidedAt`, pelo relógio do servidor;
  `expirada` é final; repetir a mesma decisão com o mesmo conteúdo é idempotente; `weekStart`, `origin` e `createdAt` não mudam.
  `pendente` não tem `decidedAt`, as outras exigem. No máximo `WEEKLY_AI.maxChangesPerProposal` mudanças.
  `PUT /api/proposals/:id` só grava a proposta (usado pelo `saveProposal` do `Repository`) e NÃO mexe nos blocos. No app da conta, gerar e decidir
  passam pelas duas rotas abaixo, que aplicam os blocos junto. A regra pura da máquina de estados está em `@pulo/core/api/proposal-state`
  e a da decisão em `@pulo/core/api/proposal-decision`.
- **Descanso** (spec 29): `PUT` e `DELETE` só aceitam o dia de hoje (400 `descanso_so_hoje`), o da sequência: vira no começo
  do dia da pessoa, no fuso dela. Entre a virada do app (`DAY_ROLLOVER_HOUR`) e esse começo, vale também o dia novo, que passa
  a ser o único assim que tem um registro. No máximo `DESCANSO.maxPorSemana` por semana do app (409 `limite_de_descanso`);
  repetir o de hoje é aceito. Descansos antigos continuam. Desmarcar devolve as joias. Regra em `@pulo/core/domain/descanso`.
  O sync traz `descanso: { restantesNaSemana, maxPorSemana }`.
- **Joias**: a moeda. O saldo nunca é gravado: são as joias ganhas menos as gastas, no mínimo zero (`joiasGanhas` em
  `@pulo/core/domain/joias`). Rendem: hábito feito, dia de descanso, marco e baú de meta aberto (`JOIAS.por`) e o foco, com
  `floor(minutos focados / JOIAS.focusMinutesPerJoia)` por sessão encerrada (concluída ou interrompida), sem as pausas e até o planejado.
  `joiaCredit` é o ganho histórico dado pela migração a quem ganharia menos com a regra nova do foco.
- **Casa**: `PUT /api/house/:item` compra uma parte (`HOUSE`: `cozinha`, `varanda`, `jardim`, `arvore`, `cerca`), em qualquer ordem.
  O `quarto` já vem pronto. Compras são imutáveis: só `DELETE /api/data` apaga.
- **Quarto**: `PUT /api/room/:item` compra uma decoração (`ROOM_DECOR`) já com a posição: `x` e `y` dentro de `ROOM_GRID` e
  `rotation` 0, 90, 180 ou 270. `PATCH /api/room/:item` muda só a posição, de graça (item não comprado: 404 `nao_encontrado`).
  Mais de um item pode ocupar o mesmo ponto.
- **Compra (casa e quarto)**: o caminho precisa ser igual ao `item` do corpo (`id_divergente`) e `cost` igual ao catálogo. Numa transação
  serializável o servidor lê as fontes de joias e as compras e valida com o core (`@pulo/core/domain/casa`). Duas compras ao mesmo tempo
  não gastam o mesmo saldo (a perdedora recebe 409 `conflito_concorrente` ou `ja_comprado`). Repetir a mesma compra (item, `cost` e
  `createdAt`) é 200 sem gravar; no quarto a resposta traz a posição gravada, que pode já ter mudado.
- **Ilha antiga** (`/api/island`, legado da spec 12 até a tela nova): mesma mecânica com o catálogo `ISLAND`, ordem das áreas e área aberta.
  As compras dela **não gastam joias na casa nem no quarto** (o valor volta). O saldo da ilha antiga desconta as compras antigas e as novas.

### Metas: `/api/goals`

- `Goal` tem `icon` (emoji curto, sem espaços, até `GOALS.iconMaxChars`) e `color` (um de `ACCENT_COLORS`: `sapo`, `agua`, `foco`,
  `descanso`, `sol`, `atencao`; nunca hex). Os dois são opcionais: omitidos no `PUT`, ficam como estão (clientes antigos não os
  apagam). Sem valor gravado, a tela usa `GOALS.defaultIcon` e `GOALS.defaultColor`.
- **Baú**: concluir a meta não dá joias sozinho. `POST /api/goals/:id/chest` grava o resgate `GoalChest { goalId, abertoEm, joias }`
  (hora do servidor, `JOIAS.por.goalCompleted`) numa transação serializável, e as joias passam a contar. Um por meta: reabrir e
  concluir de novo responde 409 `bau_ja_aberto`, e o resgate continua valendo. Apagar a meta apaga o resgate (as joias saem do saldo).
- **Hábito atrelado**: `Habit.goalId` (no máximo uma meta). No `PUT /api/habits/:id` e no lote: omitido mantém a meta gravada,
  `null` solta, um id atrela ou troca (meta de outra pessoa: 404 `referencia_inexistente`). Não há limite próprio.
- **Ritmo e números** não são rotas: `ritmo`, `numerosDaMeta` e `estadoDoBau` em `@pulo/core/domain/goals`. O foco por meta soma
  as sessões encerradas com `goalId` ou com o `habitId` de um hábito atrelado, entre as sessões recebidas (no app, a janela do sync).
  Sessão ligada a uma tarefa da meta não entra.

### Tarefas: `/api/tasks`

Tipos `Task`, `TaskSubtask`, `TaskComment` e `TaskEvent` de `domain/types.ts`; limites em `TASKS` (`decisions.ts`): título até 200
caracteres (também o das subtarefas), descrição até 10 mil, comentário até 2 mil, 10 etiquetas de até 30, 50 subtarefas, 100 pomodoros.

- `status`: `ideias`, `afazer`, `fazendo` ou `feito`. `completedAt` existe quando, e só quando, o status é `feito`.
- `position` é um número fracionário: para reordenar, mande a média dos vizinhos (`positionBetween` em `@pulo/core/domain/tasks`).
- A tarefa é identificada pelo `id`. `createdAt` fica o da primeira gravação, e as listas vêm por `createdAt` e depois `id`.
- `dueDate` é um `DateKey`; "esta semana" é o domingo da semana, calculado pelo app. `goalId` precisa ser meta da pessoa;
  apagar a meta deixa a tarefa sem ela.
- Histórico: criar grava o evento `criada`; mudar `status`, `priority` ou `dueDate` grava um evento por campo (`status`,
  `prioridade`, `prazo`, com `de` e `para`; ausente = sem valor). Repetir o `PUT` não grava nada. As escritas de tarefa de uma
  pessoa são serializadas no banco (`pg_advisory_xact_lock`), então escritas simultâneas não duplicam evento nem passam do limite de subtarefas.
- `PUT`, subtarefas, comentários e histórico de tarefa de outra pessoa respondem 404 `nao_encontrado`. `DELETE` segue a regra geral
  (`{ deleted: 0 }`). Id de subtarefa ou comentário já usado: 409 `conflito_de_id`.
- Comentário não muda: repetir o mesmo `POST` é 200 sem gravar; outro corpo com o mesmo id é 409.
- O sync traz tarefas e subtarefas; comentários e eventos só pelo `activity` (`taskTimeline` do core junta os dois).
- Pomodoros feitos não são gravados: são as sessões concluídas com `taskId`. `pomodoros` (`{ [taskId]: quantidade }`, só quem
  tem algum) vem no `GET /api/tasks` e no sync, contado em todo o histórico.

### `GET /api/week-summary?date=AAAA-MM-DD`

`date` é qualquer dia da semana. Três leituras por intervalo (sessões, descansos, hábitos feitos) numa transação e
`buildWeekSummary` do core, com o fuso de `metadata.timezone` (ou o padrão). Resposta `{ summary: WeekSummary }`.

Do foco (spec 19), contando as sessões encerradas da semana: `focoPorAlvo` (`{ alvo: { tipo: 'habito' | 'meta' | 'tarefa', id } | null,
minutos }[]`, do maior para o menor; `null` junta as sem vínculo; sem pausas e até o planejado; menos de um minuto não aparece),
`sessoesTerminadas`, `sessoesLargadas` (interrompidas) e `melhorPeriodo` (`manha`, `tarde`, `noite` ou `null` sem minutos; empate:
mais concluídas e depois o mais cedo). Nada disso vai para a IA.

### `POST /api/proposals/generate`

Corpo `{ date?: 'AAAA-MM-DD' }` (qualquer dia da semana; sem corpo ou sem `date`, a semana de agora pelo relógio do servidor e o fuso da pessoa).
Resposta 200 `{ outcome, proposal? }` (`generateProposalResponseSchema`):

| `outcome` | `proposal` | O que aconteceu |
| --- | --- | --- |
| `conhecendo` | não | menos de `WEEKLY_AI.minDaysWithRecord` dias com registro ou de `minSessions` sessões. Nada é criado |
| `existente` | sim | a semana já tinha proposta (uma por semana): devolve a que existe, em qualquer estado |
| `sem_candidata` | não | nenhuma mudança válida (ou todas em quarentena por `deniedCooldownWeeks`). Nada é criado |
| `proposta` | sim | proposta nova, `pendente`, guardada. `origin` é `ia` só se a IA respondeu algo válido; senão `regra` |

- Leituras fixas numa transação: as 3 do resumo (sessões, descansos, hábitos feitos), os blocos e as propostas da janela da
  quarentena, mais um `INSERT`. Total 7 (sem criar) ou 8 (criando), igual com 1 ou com 50 linhas.
- Privacidade: a IA recebe SÓ o corpo de `buildAiRequest` (resumo agregado e candidatas com enums e horários, sem id de bloco, título,
  nome do sapo, nome ou e-mail da pessoa nem texto livre). A chave do provedor fica no ambiente do Worker. O teste
  `proposals-generate.test.ts` inspeciona o corpo real que chega ao provedor.
- A IA só é consultada quando o ambiente pede (`PULO_AI_PROVIDER` preenchido, `fake` inclusive). Sem isso, ou com timeout
  (`WEEKLY_AI.timeoutMs`), erro, JSON inválido, índice fora das candidatas, termo proibido ou horário escrito no texto, vale a proposta por regra
  (`origin: 'regra'`, rótulo "Sugestão"). Nunca é 5xx por culpa da IA.
- Duas gerações simultâneas: o índice único (pessoa e semana) deixa uma só; a outra devolve `existente`.
- `POST /weekly-ai` continua aberto e sem login, para o demo.

### `POST /api/proposals/:id/decision`

Corpo (`proposalDecisionBodySchema`): `{ action: 'aceitar' }`, `{ action: 'negar' }`, `{ action: 'desfazer' }` ou
`{ action: 'editar', change: { index, to: { weekday, startMinutes, durationMinutes } } }` (`to` com duração de 5 a 120 e dentro do dia).
Resposta 200 `{ proposal, blocks }`: a proposta já atualizada e TODOS os blocos da pessoa.

- Uma transação serializável com a máquina de estados do core (`checkProposalTransition`, janela de desfazer de `undoSeconds` mais
  `PROPOSAL_UNDO_GRACE_MS` pelo relógio do servidor) e `acceptProposal`, `editProposal` e `undoDecision`. Os blocos e o estado da proposta
  são gravados juntos: se qualquer parte falha, nenhuma vale.
- Cada bloco da proposta precisa estar ainda no horário `from` (no desfazer, no `to`). Senão 409 `bloco_mudou` e nada muda.
  Destino que bate em outro bloco: 409 `horario_ocupado`. A guarda também vai no `UPDATE` dos blocos (`WHERE` com o horário esperado).
- Repetir a mesma decisão com o mesmo conteúdo é idempotente (200, nada gravado, `decidedAt` original). Outra decisão sobre uma já decidida,
  desfazer fora da janela e qualquer coisa sobre `expirada`: 409 `proposta_transicao_invalida`. Desfazer uma pendente é 200 sem mudança.
- Desfazer devolve cada bloco ao `from` e a proposta a `pendente`. Depois de editar, a proposta volta pendente com o horário que a pessoa escolheu (o original não é guardado).
- Proposta inexistente ou de outra pessoa: 404 `nao_encontrado`.
- Queries (com a sessão): 6 aplicando blocos (proposta, blocos, um `UPDATE ... FROM unnest` dos blocos, `UPDATE` da proposta), 5 ao negar, 4 repetindo, 3 se não existe.

### Gelo: `/api/gelo`

- Um gelo protege um dia lógico que terminou vazio, sem descanso nem férias, com a sequência viva. Guarda-se até
  `GELO.maxGuardados`; o saldo é `GELO.presenteInicial` mais compras menos usos, nunca gravado.
- **Gasto preguiçoso, sem job:** `/api/sync`, `GET /api/streak`, `GET` e `POST /api/gelo`, as métricas, as escritas que
  destravam conquistas e os `DELETE` de hábito, hábito feito e descanso resolvem os dias fechados desde o último resolvido
  (`mascot_state.geloResolvidoAte`), do mais antigo ao mais novo. Sem gelo, a sequência quebra ali. Repetir não gasta de novo.
  Os `DELETE` acertam antes de apagar. Na primeira vez, o último resolvido é ontem. Regra em `@pulo/core/domain/gelo`.
- `POST /api/gelo` compra um por `GELO.preco` joias (409 `gelo_no_maximo` ou `joias_insuficientes`), gravado em
  `island_purchase` com `kind = 'gelo'`. O gasto entra no saldo da casa, do quarto e da ilha antiga.
- `recentes` são os dias protegidos que a pessoa ainda não viu; `PUT /api/gelo/visto` marca todos.
- O sync traz `gelo: { guardados, max, recentes }` e `gelosComprados` (para o app calcular o saldo).
- MCP: `ver_gelo` e `ver_metricas`, só leitura. O MCP não compra gelo.

### Métricas: `GET /api/profile/metrics`

`{ metrics: ProfileMetrics }`, calculado por `computeMetrics` (`@pulo/core/domain/metricas`), o mesmo do modo demo.

- `ritmo`: últimos `METRICAS.janelaDias` dias lógicos, nunca antes da criação da conta. `taxaHabitos30` (0 a 1) olha só os
  hábitos ativos, nos dias da frequência, sem descanso, férias e hoje vazio. `melhorDiaDaSemana` (0 = segunda) soma minutos;
  empate: o mais recente. `sessoesTerminadas` são as concluídas.
- `descanso`: `total` e `noMes` (mês do calendário) contam os marcados. A comparação de foco usa semanas fechadas, desde a
  criação da conta e com algum registro, e fica nula com menos de `METRICAS.minSemanasPorTipo` de cada tipo.
- `gelo` e `feitos` são de todo o histórico (`joiasGanhas` é o ganho total, sem descontar gastos).

### Sequência: `GET /api/streak`

Resposta `{ streak: { atual, recorde, semana } }` (`streakResponseSchema`). O mesmo objeto vem no campo `streak` do `/api/sync`.
A regra é a função pura `computeStreak` do core (`@pulo/core/domain/streak`), usada também no modo demo.

- Um dia conta quando tem pelo menos um hábito feito **ou** uma sessão de foco que conta como cuidado (a mesma regra da ilha).
- Dias do modo férias valem como descanso.
- Dia de descanso e dia protegido por gelo não quebram a sequência e não somam. Hoje vazio ainda não quebra: ela só zera quando um dia termina vazio.
- `atual` são os dias feitos seguidos; `recorde` é o maior trecho de todo o histórico. Os dois são calculados, nada é gravado.
- `semana` tem 7 itens `{ date, estado }`, de domingo a sábado (`STREAK.weekStartsOn`). `estado`: `feito`, `descanso`, `gelo`, `vazio`,
  `hoje` (hoje ainda sem nada) ou `futuro`. Dia feito e marcado como descanso aparece `feito`.
- O dia vira no começo do dia da pessoa (`metadata.profile.dayStartMinutes`) no fuso dela; sem perfil, às `DAY_ROLLOVER_HOUR`.
  Hábitos e descansos usam a data gravada pelo app (virada às `DAY_ROLLOVER_HOUR`): se a pessoa marca um deles entre essa virada
  e o começo do dia dela, o dia novo passa a ser o `hoje` da sequência. Registros em datas futuras não contam.
- Leituras fixas numa transação: hábitos feitos agrupados por dia, sessões encerradas e descansos, de todo o histórico.

### Conquistas

`Achievement`: `{ id, nome?, emoji?, conquistada, conquistadaEm?, progresso, meta }`. O catálogo é `ACHIEVEMENTS` do `decisions.ts`
e as regras são puras em `@pulo/core/domain/achievements`. O `/api/sync` (campo `achievements`) e `GET /api/achievements` trazem o
catálogo inteiro, na mesma ordem. A secreta não conquistada vem sem `nome` e `emoji`.

| Id | Regra | `meta` |
| --- | --- | --- |
| `primeira-semana` | dias seguidos (a sequência de `GET /api/streak`; vale o recorde) | 7 |
| `foco-profundo` | uma sessão encerrada com esses minutos focados (sem pausas) | 50 |
| `descanso-sabido` | dias de descanso marcados (férias não contam) | 4 |
| `mes-de-fogo` | dias seguidos | 30 |
| `casa-inteira` | partes da casa prontas (o quarto já conta) | 6 |
| `gelo-na-hora` | gelos já usados | 1 |
| `segredo` | regra ainda não escolhida: ninguém recebe | 1 |

- **Gravação:** só `(conquista, conquistadaEm)`, na primeira vez que a regra passa, com o relógio do servidor. Nunca some, mesmo
  apagando os registros (só `DELETE /api/data` e a exclusão da conta). O progresso é calculado e não é gravado.
- **Quem destrava:** `PUT` de hábito feito, de sessão encerrada, de descanso e de compra na casa, depois da escrita confirmada.
  A resposta traz `newAchievements` só com as gravadas naquela chamada (lista vazia no resto): repetir o `PUT` não repete a comemoração,
  e dois aparelhos juntos não comemoram a mesma duas vezes.
- **Antes da primeira escrita:** quem já cumpria uma regra vê `conquistada: false` com o progresso cheio e a ganha na próxima dessas escritas.
- Em `progresso` das sequências vale a sequência viva (`atual`) até o recorde alcançar a meta.

### `GET /api/sync?from&to`

`from` e `to` obrigatórios, até 400 dias. Vinte e uma leituras numa transação (as estatísticas reaproveitam as da sequência), resposta:

```json
{
  "user": { "id": "", "name": "", "email": "", "image": null },
  "metadata": { "version": 1, "theme": "sistema", "reduceMotion": false, "timezone": "America/Sao_Paulo", "onboarding": { "completed": false, "completedAt": null }, "profile": null },
  "blocks": [], "habits": [], "habitLogs": [], "sessions": [], "restDays": [],
  "proposals": [], "goals": [], "goalChests": [], "tasks": [], "subtasks": [], "pomodoros": {}, "islandPurchases": [], "housePurchases": [], "roomDecor": [], "joiaCredit": 0, "mascot": null,
  "streak": { "atual": 0, "recorde": 0, "semana": [{ "date": "2026-11-15", "estado": "vazio" }] }, "stats": { "habitosFeitos": 0, "minutosDeFoco": 0, "desde": 1795000000000 },
  "achievements": [{ "id": "primeira-semana", "nome": "Primeira semana", "emoji": "🔥", "conquistada": false, "progresso": 0, "meta": 7 }],
  "gelo": { "guardados": 1, "max": 2, "recentes": [] }, "gelosComprados": [], "descanso": { "restantesNaSemana": 2, "maxPorSemana": 2 },
  "serverTime": 1795000000000
}
```

Blocos, hábitos, propostas, metas, baús abertos, tarefas e subtarefas, compras (ilha antiga, casa e quarto) e o crédito de joias vêm inteiros; hábitos feitos e descansos, só do intervalo; sessões do intervalo mais a
em andamento. `streak` olha todo o histórico, não só o intervalo (acima; `semana` tem sempre 7 itens). `serverTime` é o relógio do servidor em ms.

### `DELETE /api/data`

O `clearAll` do servidor, único jeito de zerar o progresso: apaga blocos, hábitos (e seus registros), sessões, descansos,
propostas, metas (e baús), tarefas (com subtarefas, comentários e histórico), compras com joias (e posições do quarto, e os gelos), gelos usados, crédito de joias, conquistas e o estado do sapo da pessoa, numa transação. Conta, login e metadados (tema, fuso, onboarding) ficam.

## Mapa para o `Repository`

| `Repository` | Rota |
| --- | --- |
| `listBlocks`, `saveBlock`, `deleteBlock` | `GET /api/blocks`, `PUT`, `DELETE /api/blocks/:id` |
| `listHabits`, `saveHabit`, `deleteHabit` | `GET /api/habits`, `PUT`, `DELETE /api/habits/:id` |
| `listHabitLogs(range)`, `saveHabitLog`, `deleteHabitLog` | `GET /api/habit-logs`, `PUT`, `DELETE /api/habit-logs/:habitId/:date` |
| `listSessions`, `saveSession` | `GET /api/sessions`, `PUT /api/sessions/:id` |
| `verPomodoros` do core (`getPomodoros` só no `RemoteRepository`) | `GET /api/sync` |
| `listRestDays`, `saveRestDay`, `deleteRestDay` | `GET /api/rest-days`, `PUT`, `DELETE /api/rest-days/:date` |
| `listProposals`, `saveProposal` | `GET /api/proposals`, `PUT /api/proposals/:id` |
| `generateProposal`, `decideProposal` (só no `RemoteRepository`) | `POST /api/proposals/generate`, `POST /api/proposals/:id/decision` |
| `listGoals`, `saveGoal`, `deleteGoal` | `GET /api/goals`, `PUT`, `DELETE /api/goals/:id` |
| `listGoalChests`, `saveGoalChest` | `goalChests` do sync (ou `GET /api/goals`), `POST /api/goals/:id/chest` |
| `listTasks`, `saveTask`, `deleteTask` | `GET /api/tasks`, `PUT`, `DELETE /api/tasks/:id` |
| `listSubtasks`, `saveSubtask`, `deleteSubtask` | `GET /api/tasks`, `PUT`, `DELETE /api/tasks/:id/subtasks/:subId` |
| `addTaskComment`, `listTaskActivity` | `POST /api/tasks/:id/comments`, `GET /api/tasks/:id/activity` |
| `listIslandPurchases`, `saveIslandPurchase` | `GET /api/island/purchases`, `PUT /api/island/purchases/:item` |
| `listHousePurchases`, `saveHousePurchase` | `GET /api/house`, `PUT /api/house/:item` |
| `listRoomDecor`, `saveRoomDecor`, `moveRoomDecor` | `GET /api/room`, `PUT`, `PATCH /api/room/:item` |
| `getJoiaCredit` | `joiaCredit` do `GET /api/sync` (ou de `GET /api/house`) |
| `getMascotState` (`saveMascotState` não existe: o servidor calcula) | `GET /api/mascot` |
| `verSequencia` do core (`getStreak` só no `RemoteRepository`) | `GET /api/sync` e `GET /api/streak` |
| `verEstatisticasDoHabito` do core (`getHabitStats` só no `RemoteRepository`) | `GET /api/habits/:id/stats` |
| `getUser` | `GET /api/me` e `metadata` do `GET /api/sync` |
| `getPreferences`, `savePreferences` (só no `RemoteRepository`) | `metadata` do sync, `PATCH /api/me/metadata` |
| `verEstatisticas` do core (`getStats` só no `RemoteRepository`) | `GET /api/sync` e `GET /api/stats` |
| `exportData`, `deleteAccount` (só no `RemoteRepository`) | `GET /api/data/export`, `DELETE /api/account` |
| `listConnections`, `disconnect` (só no `RemoteRepository`) | `GET`, `DELETE /api/mcp/connections` |
| `verConquistas` do core (`getAchievements` só no `RemoteRepository`) | `GET /api/sync` e `GET /api/achievements` |
| `verGelo`, `comprarGelo`, `marcarGeloVisto` do core (`getFreezes`, `buyFreeze`, `markFreezesSeen` no `RemoteRepository`) | `GET /api/sync`, `/api/gelo` |
| `verMetricas` do core (`getMetrics` só no `RemoteRepository`) | `GET /api/profile/metrics` |
| `verDescanso`, `marcarDescanso` do core | calculados no app; a escrita é `PUT /api/rest-days/:date` |
| `clearAll` | `DELETE /api/data` |

## Cliente no app: `@pulo/client`

`createRemoteRepository({ baseUrl, fetch?, clock?, historyDays?, retries? })` devolve um `Repository` do core
(mais `account` e `reload()`), sobre `hc<AppType>` (só o tipo da API entra no pacote).

- **Abertura:** um `GET /api/sync` com a janela de `syncRange`: 180 dias para trás e 2 para frente, no fuso padrão (limite do servidor: 400).
  Blocos, hábitos e propostas vêm inteiros. Hábitos feitos, descansos e sessões só da janela (mais a sessão em andamento).
  O estado do sapo vem do servidor, que conta todo o histórico. Dados mais velhos que a janela não aparecem nas telas.
- **Leitura:** sempre do cache em memória, sem rede. `reload()` repete o sync.
- **Escrita:** o cache muda na hora, o `PUT` ou `DELETE` da rota vai em seguida (uma escrita por chave de cada vez, chaves diferentes em paralelo).
  Se falhar, volta o que era (só se ninguém mexeu na mesma chave depois) e sobe um `RemoteError`. `conflito_concorrente` é repetido (padrão 2 vezes).
- **Usuário:** `getUser` e `saveUser` usam `metadata.profile` e as preferências (`PATCH /api/me/metadata`), via `userFromMetadata` e
  `metadataPatchFromUser` do core. `saveMascotState` só atualiza o cache: o sapo é do servidor (a resposta de encerrar sessão e de descanso traz o novo estado).
- **`clearAll`:** `DELETE /api/data` e depois `PATCH /api/me/metadata` com `profile: null` e `onboardingCompleted: false` (volta ao onboarding; a conta fica).
- **Erros:** `RemoteError` com `kind` (`rede`, `sessao`, `api`, `resposta_invalida`), `code` (código da tabela acima), `status`, `issues` e `mensagem` em português.
- **Propostas:** `generateProposal(date?)` e `decideProposal(id, decisao)` chamam as duas rotas acima, validam a resposta com os schemas do core,
  atualizam o cache (proposta e, na decisão, todos os blocos) e, se o servidor recusar, releem o `GET /api/sync`. No app, a tela Semana usa a `PropostaFonte` remota na conta e a local no demo.
- **Sequência:** `getStreak()` (ou `verSequencia(repo, clock)` do core) devolve a do sync, sem rede. Depois de uma escrita em hábito,
  registro, sessão, descanso, perfil ou do `clearAll`, ou na virada do dia, espera as escritas pendentes e chama `GET /api/streak`;
  sem rede, devolve a última conhecida.
- **Conquistas:** `getAchievements()` (ou `verConquistas(repo, clock)`) devolve as do sync; depois de uma escrita que pode mudá-las
  (hábito, registro, sessão, descanso, casa, perfil, `clearAll`) ou na virada do dia, chama `GET /api/achievements`.
  `onNewAchievements(listener)` avisa as destravadas por uma escrita (para o sapo comemorar) e devolve como cancelar.
- **Foco:** `saveSession` espera a escrita do alvo, manda `null` no que saiu de uma sessão aberta e guarda a sessão como o
  servidor devolveu. Apagar hábito, meta ou tarefa solta o vínculo no cache. `getPomodoros()` (ou `verPomodoros(repo)` do core)
  devolve os do sync, somados aos focos concluídos depois, sem rede.
- **Tarefas:** `saveTask` mostra o cartão na hora. Tarefa, subtarefas e comentários seguem em
  ordem; comentários e histórico não ficam em cache. Apagar uma meta solta o vínculo no cache.
- **Lote:** `saveBlocks(blocks)` e `saveHabits(habits)` (cache otimista, um `PUT` cada, tudo ou nada com rollback do cache). `saveBlock` e `saveHabit` continuam.
- **Hábitos:** o cache guarda `state` (sem o `active` antigo). Um campo opcional que sai do hábito ou do bloco vai como `null`.
  `getHabitStats(id)` não tem cache.
- **Cookie:** sempre `credentials: 'include'`. O cookie da sessão é HttpOnly e do navegador: o cliente não o lê, não o guarda e não manda cabeçalho `Cookie`.
