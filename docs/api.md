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
  `CheckIn`, `RestDay`, `WeeklyProposal`, `MascotState`. Datas são `DateKey` ('AAAA-MM-DD'), instantes são ms.
- `DELETE` é idempotente: responde 200 com `{ deleted: n }` (n = 0 se já não existia).
- `from` e `to` são `DateKey`, opcionais e incluídos nos extremos. Sessões filtram pelo dia lógico de término, no fuso da pessoa
  (`metadata.timezone`, padrão `America/Sao_Paulo`), e a sessão em andamento sempre vem.
- Instantes enviados pelo app não podem estar mais de 5 minutos no futuro do relógio do servidor (400 `horario_no_futuro`).
- "Queries" abaixo é o total de SQL por chamada: 2 da sessão do Better Auth (sessão e usuário) mais as da rota.
  O número não depende da quantidade de dados: cada rota tem um teste que compara 1 registro com 50 (`countQueries`).
  Escritas com `upsert` usam `INSERT ... ON CONFLICT` do Prisma (uma query); BEGIN e COMMIT não entram na conta.

## Erros

Corpo sempre `{ "error": "<codigo>", "message": "<texto>", "issues"?: [{ "path", "message" }] }` (schema `apiErrorSchema`).
Nunca há stack trace; erro inesperado vira 500 `erro_interno` e o detalhe fica só no log do Worker.

| Status | Código | Quando |
| --- | --- | --- |
| 401 | `nao_autenticado` | sem sessão ou cookie inválido |
| 403 | `origem_nao_permitida` | `PUT`, `PATCH`, `POST` ou `DELETE` em `/api/*` (fora `/api/auth/*`) com `Origin` que não está em `PULO_CORS_ORIGIN` (inclui `null`) |
| 403 | `origem_ausente` | os mesmos métodos sem `Origin`, mas com cookie ou `Sec-Fetch-Site` (navegador sempre manda `Origin` nestes métodos) |
| 400 | `corpo_invalido` | JSON quebrado ou fora do schema (energia fora de 1 a 5, duração do bloco fora de 5 a 120, foco planejado fora dos limites de `FOCUS`, sessão incoerente, proposta fora do formato, `weekStart` que não é segunda) |
| 400 | `consulta_invalida` | `from`/`to`/`date` inválidos, `from` depois de `to`, intervalo do sync maior que 400 dias |
| 400 | `parametro_invalido` | id ou data inválidos no caminho |
| 400 | `id_divergente`, `data_divergente` | caminho diferente do corpo |
| 400 | `horario_no_futuro` | instante do app no futuro |
| 404 | `referencia_inexistente` | hábito (do registro) ou bloco (da sessão) que não existe ou é de outra pessoa |
| 404 | `rota_inexistente` | rota não existe |
| 409 | `conflito_de_id` | id já usado por outra pessoa (nunca sobrescreve). No lote, `issues` lista `blocks.N.id` ou `habits.N.id` e nada é salvo |
| 409 | `limite_por_dia` | passaria de `MAX_HABITS_PER_DAY` hábitos ativos no mesmo dia da semana. No lote, `issues` lista `habits.N.weekdays` e nada é salvo |
| 409 | `sessao_em_andamento` | já existe outra sessão em andamento (índice único parcial no banco) |
| 409 | `sessao_encerrada` | mudança numa sessão `concluida` ou `interrompida` |
| 409 | `sessao_imutavel` | mudou início, duração planejada ou bloco de uma sessão em andamento |
| 409 | `proposta_transicao_invalida`, `proposta_imutavel` | máquina de estados da proposta (abaixo) |
| 404 | `nao_encontrado` | proposta que não existe ou é de outra pessoa (`POST /api/proposals/:id/decision`) |
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
| `PUT /api/blocks` (lote) | `{ blocks: RoutineBlock[] }`, 1 a 100 | `{ blocks }` | 3 com 1 ou com 100 |
| `PUT /api/blocks/:id` | `RoutineBlock` | `{ block }` | 3 |
| `DELETE /api/blocks/:id` | | `{ deleted }` | 3 |
| `GET /api/habits` | | `{ habits: Habit[] }` | 3 |
| `PUT /api/habits` (lote) | `{ habits: Habit[] }`, 1 a 50 | `{ habits }` | 4 com 1 ou com 50 |
| `PUT /api/habits/:id` | `Habit` | `{ habit }` | 4 |
| `DELETE /api/habits/:id` | | `{ deleted }` (os registros do hábito saem junto) | 3 |
| `GET /api/habit-logs?from&to` | | `{ habitLogs: HabitLog[] }` | 3 |
| `PUT /api/habit-logs/:habitId/:date` | `HabitLog` | `{ habitLog }` | 4 |
| `DELETE /api/habit-logs/:habitId/:date` | | `{ deleted }` | 3 |
| `GET /api/sessions?from&to` | | `{ sessions: FocusSession[] }` | 3 |
| `PUT /api/sessions/:id` | `FocusSession` | `{ session, mascot: MascotState \| null }` | 4 em andamento, 8 ao encerrar |
| `GET /api/check-ins?from&to` | | `{ checkIns: CheckIn[] }` | 3 |
| `PUT /api/check-ins/:id` | `CheckIn` | `{ checkIn }` | 3 |
| `GET /api/rest-days?from&to` | | `{ restDays: RestDay[] }` | 3 |
| `PUT /api/rest-days/:date` | (sem corpo) | `{ restDay, mascot: MascotState }` | 7 |
| `DELETE /api/rest-days/:date` | | `{ deleted, mascot: MascotState }` | 7 |
| `GET /api/proposals` | | `{ proposals: WeeklyProposal[] }` (semana mais nova primeiro) | 3 |
| `PUT /api/proposals/:id` | `WeeklyProposal` | `{ proposal }` | 4 |
| `POST /api/proposals/generate` | `{ date? }` (qualquer dia da semana) | `{ outcome, proposal? }` | 8 sem criar, 9 criando |
| `POST /api/proposals/:id/decision` | `{ action: 'aceitar' \| 'editar' \| 'negar' \| 'desfazer', change? }` | `{ proposal, blocks }` | 6 aplicando blocos, 5 ao negar, 4 repetindo |
| `GET /api/mascot` | | `{ mascot: MascotState \| null }` | 3 |
| `GET /api/week-summary?date` | | `{ summary: WeekSummary }` | 6 |
| `GET /api/sync?from&to` | | ver abaixo | 10 |
| `DELETE /api/data` | | `{ deleted: { sessions, blocks, habits, checkIns, restDays, proposals, mascot } }` | 9 |

Já existiam e continuam: `GET /health`, `/api/auth/*`, `GET /api/me`, `PATCH /api/me/metadata`, `POST /weekly-ai`.

### Escrita em lote

`PUT /api/blocks` e `PUT /api/habits` existem para o onboarding (o plano de exemplo tem 15 blocos e 2 hábitos: eram 17 chamadas, agora são 2).
Corpo `{ blocks: [...] }` ou `{ habits: [...] }` (limites `API_LIMITS.batchMaxBlocks` = 100 e `batchMaxHabits` = 50), resposta com a mesma lista.
- Cada item segue as regras da rota de um item (`routineBlockSchema` e `habitSchema`, id de outra pessoa, limite por dia).
  Ids repetidos no mesmo lote dão 400 `corpo_invalido`.
- Atômico: nada é salvo se algum item falhar. O erro lista os itens: `issues` com `path` `blocks.3.durationMinutes`, `habits.1.title`,
  `habits.0.weekdays` (409 `limite_por_dia`) ou `blocks.2.id` (409 `conflito_de_id`).
- Queries constantes: um `INSERT ... SELECT ... FROM unnest(arrays) ON CONFLICT (id) DO UPDATE ... WHERE userId = EXCLUDED.userId`
  no lugar de um `upsert` por item. No de hábitos há antes uma leitura dos outros hábitos ativos (o limite por dia conta o lote junto com eles),
  numa transação serializável. Se alguma linha foi pulada por ser de outra pessoa, a transação desfaz e uma query lista quem foi (só no caminho de erro).
- O `RemoteRepository` expõe `saveBlocks` e `saveHabits` (`BatchWrites` do core); `criarPlanoInicial` os usa quando existem.

### Regras de cada recurso

- **Blocos**: duração de 5 a 120 minutos (`BLOCK_MIN_MINUTES`, `BLOCK_MAX_MINUTES`), início e fim dentro do dia, `weekday` de 0 a 6.
  O servidor não checa sobreposição entre blocos (isso continua no app).
- **Hábitos**: no máximo `MAX_HABITS_PER_DAY` hábitos ativos por dia da semana, checado na escrita, numa transação serializável.
  Dias repetidos são removidos e ordenados. Hábito inativo não conta.
- **Hábitos feitos**: uma marca por hábito e dia; repetir mantém a primeira (`doneAt` original). O hábito precisa ser da pessoa.
- **Sessões de foco**: `plannedMinutes` de `FOCUS.minMinutes` a `FOCUS.maxMinutes`; `em_andamento` não tem `endedAt`, encerrada tem
  e `endedAt >= startedAt`; uma só `em_andamento` por pessoa (409 `sessao_em_andamento`, mesmo pausada). Pausar e retomar são
  `PUT` da mesma sessão (`pausedSince`, `pausedMs`). Encerrada (`concluida` ou `interrompida`) é imutável: mudar dá 409
  `sessao_encerrada`; repetir exatamente o mesmo corpo é aceito (retry seguro). O `blockId` precisa ser bloco da pessoa.
- **Sapo**: ao encerrar uma sessão e ao criar ou apagar um descanso, o servidor recalcula com `computeMascotState` do core
  (a fase e os dias de cuidado nunca regridem) e grava em `mascot_state`. A resposta traz o estado novo (`mascot`; `null` só
  quando a sessão segue em andamento).
- **Check ins**: energia de 1 a 5. O servidor não impõe um check in por período; o app reusa o id do período.
- **Propostas**: uma por pessoa e semana (`weekStart` é segunda). `pendente` vai para `aceita`, `editada`, `negada` ou `expirada`.
  Decidida só volta a `pendente` (desfazer) até `WEEKLY_AI.undoSeconds` + 5 s depois de `decidedAt`, pelo relógio do servidor;
  `expirada` é final; repetir a mesma decisão com o mesmo conteúdo é idempotente; `weekStart`, `origin` e `createdAt` não mudam.
  `pendente` não tem `decidedAt`, as outras exigem. No máximo `WEEKLY_AI.maxChangesPerProposal` mudanças.
  `PUT /api/proposals/:id` só grava a proposta (usado pelo `saveProposal` do `Repository`) e NÃO mexe nos blocos. No app da conta, gerar e decidir
  passam pelas duas rotas abaixo, que aplicam os blocos junto. A regra pura da máquina de estados está em `@pulo/core/api/proposal-state`
  e a da decisão em `@pulo/core/api/proposal-decision`.

### `GET /api/week-summary?date=AAAA-MM-DD`

`date` é qualquer dia da semana. Quatro leituras por intervalo (sessões, check ins, descansos, hábitos feitos) numa transação e
`buildWeekSummary` do core, com o fuso de `metadata.timezone` (ou o padrão). Resposta `{ summary: WeekSummary }`.

### `POST /api/proposals/generate`

Corpo `{ date?: 'AAAA-MM-DD' }` (qualquer dia da semana; sem corpo ou sem `date`, a semana de agora pelo relógio do servidor e o fuso da pessoa).
Resposta 200 `{ outcome, proposal? }` (`generateProposalResponseSchema`):

| `outcome` | `proposal` | O que aconteceu |
| --- | --- | --- |
| `conhecendo` | não | menos de `WEEKLY_AI.minDaysWithRecord` dias com registro ou de `minSessionsOrCheckIns` sessões e check ins. Nada é criado |
| `existente` | sim | a semana já tinha proposta (uma por semana): devolve a que existe, em qualquer estado |
| `sem_candidata` | não | nenhuma mudança válida (ou todas em quarentena por `deniedCooldownWeeks`). Nada é criado |
| `proposta` | sim | proposta nova, `pendente`, guardada. `origin` é `ia` só se a IA respondeu algo válido; senão `regra` |

- Leituras fixas numa transação: as 4 do resumo (sessões, check ins, descansos, hábitos feitos), os blocos e as propostas da janela da
  quarentena, mais um `INSERT`. Total 8 (sem criar) ou 9 (criando), igual com 1 ou com 50 linhas.
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

### `GET /api/sync?from&to`

`from` e `to` obrigatórios, até 400 dias. Oito leituras numa transação, resposta:

```json
{
  "user": { "id": "", "name": "", "email": "", "image": null },
  "metadata": { "version": 1, "theme": "sistema", "reduceMotion": false, "timezone": "America/Sao_Paulo", "onboarding": { "completed": false, "completedAt": null }, "profile": null },
  "blocks": [], "habits": [], "habitLogs": [], "sessions": [], "checkIns": [], "restDays": [],
  "proposals": [], "mascot": null, "serverTime": 1795000000000
}
```

Blocos, hábitos e propostas vêm inteiros; hábitos feitos, check ins e descansos, só do intervalo; sessões do intervalo mais a
em andamento. `serverTime` é o relógio do servidor em ms.

### `DELETE /api/data`

O `clearAll` do servidor, único jeito de zerar o progresso: apaga blocos, hábitos (e seus registros), sessões, check ins, descansos,
propostas e o estado do sapo da pessoa, numa transação. Conta, login e metadados (tema, fuso, onboarding) ficam.

## Mapa para o `Repository`

| `Repository` | Rota |
| --- | --- |
| `listBlocks`, `saveBlock`, `deleteBlock` | `GET /api/blocks`, `PUT`, `DELETE /api/blocks/:id` |
| `listHabits`, `saveHabit`, `deleteHabit` | `GET /api/habits`, `PUT`, `DELETE /api/habits/:id` |
| `listHabitLogs(range)`, `saveHabitLog`, `deleteHabitLog` | `GET /api/habit-logs`, `PUT`, `DELETE /api/habit-logs/:habitId/:date` |
| `listSessions`, `saveSession` | `GET /api/sessions`, `PUT /api/sessions/:id` |
| `listCheckIns(range)`, `saveCheckIn` | `GET /api/check-ins`, `PUT /api/check-ins/:id` |
| `listRestDays`, `saveRestDay`, `deleteRestDay` | `GET /api/rest-days`, `PUT`, `DELETE /api/rest-days/:date` |
| `listProposals`, `saveProposal` | `GET /api/proposals`, `PUT /api/proposals/:id` |
| `generateProposal`, `decideProposal` (só no `RemoteRepository`) | `POST /api/proposals/generate`, `POST /api/proposals/:id/decision` |
| `getMascotState` (`saveMascotState` não existe: o servidor calcula) | `POST /api/proposals/generate` | `{ date? }` (qualquer dia da semana) | `{ outcome, proposal? }` | 8 sem criar, 9 criando |
| `POST /api/proposals/:id/decision` | `{ action: 'aceitar' \| 'editar' \| 'negar' \| 'desfazer', change? }` | `{ proposal, blocks }` | 6 aplicando blocos, 5 ao negar, 4 repetindo |
| `GET /api/mascot` |
| `getUser` | `GET /api/me` e `metadata` do `GET /api/sync` |
| `clearAll` | `DELETE /api/data` |

## Cliente no app: `@pulo/client`

`createRemoteRepository({ baseUrl, fetch?, clock?, historyDays?, retries? })` devolve um `Repository` do core
(mais `account` e `reload()`), sobre `hc<AppType>` (só o tipo da API entra no pacote).

- **Abertura:** um `GET /api/sync` com a janela de `syncRange`: 180 dias para trás e 2 para frente, no fuso padrão (limite do servidor: 400).
  Blocos, hábitos e propostas vêm inteiros. Hábitos feitos, check ins, descansos e sessões só da janela (mais a sessão em andamento).
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
- **Lote:** `saveBlocks(blocks)` e `saveHabits(habits)` (cache otimista, um `PUT` cada, tudo ou nada com rollback do cache). `saveBlock` e `saveHabit` continuam.
- **Cookie:** sempre `credentials: 'include'`. O cookie da sessão é HttpOnly e do navegador: o cliente não o lê, não o guarda e não manda cabeçalho `Cookie`.
