# Spec 29: Gelo, regras do descanso e métricas do Perfil

Status: feito. Origem: conversa com o Victor de 25/11/2026 ("o gelinho e o dia de descanso coexistem; mostrar dados do descanso e mais métricas no Perfil"). Backend. Depende das specs 13, 14, 15 e 18. A tela fica na spec 30.

## Problem Statement

Hoje a sequência tem uma proteção só, o dia de descanso (`RestDay`). Ele tem três problemas:

- vale para qualquer data, inclusive passada, então dá para consertar uma sequência quebrada marcando descanso depois;
- não tem limite;
- não protege quem simplesmente esqueceu.

O Victor quer um gelo no estilo do Duolingo convivendo com o descanso. Os dois têm papéis diferentes:

- **Descanso:** é marcado de propósito, no próprio dia. É cuidado e rende joias.
- **Gelo:** é guardado antes e salva um dia esquecido. É comprado com joias.

O Perfil também mostra pouco: dias seguidos, recorde, hábitos feitos e minutos de foco. Faltam os números do descanso, do gelo e do ritmo da pessoa.

## Solution

1. **Gelo.** A pessoa compra gelos com joias e pode guardar até `GELO.maxGuardados`. Quando um dia lógico termina vazio, um gelo é gasto sozinho e o dia vira "protegido". Para isso o dia não pode ser descanso nem férias, e a pessoa precisa ter um gelo guardado. A sequência não quebra e não sobe, como no descanso.
2. **Descanso com regra.** Só pode ser marcado para hoje (o dia lógico atual), nunca para trás nem para frente (decisão do Victor de 25/11/2026). O limite é `DESCANSO.maxPorSemana` por semana do app (`STREAK.weekStartsOn`). Desmarcar o de hoje continua livre.
3. **Métricas.** Uma rota nova devolve os números do Perfil, já calculados no servidor.

Valores propostos para o `decisions.ts` (proposta minha, o Victor decide):

| Constante | Valor | Por quê |
| --- | --- | --- |
| `GELO.preco` | 50 joias | cerca de 4 dias bons de uso (um dia com 3 hábitos e 2 focos de 25 minutos rende uns 13); fica entre a cerca (40) e o jardim (60), então proteger a sequência compete com construir a casa (decisão do Victor de 25/11/2026: bem mais caro) |
| `GELO.maxGuardados` | 2 | igual ao Duolingo; evita estocar e nunca mais cuidar |
| `GELO.presenteInicial` | 1 | a pessoa nova entende o gelo antes de precisar comprar |
| `DESCANSO.maxPorSemana` | 2 | descanso é cuidado, mas não pode substituir a semana |

## User Stories

1. Como pessoa, quero comprar gelos com joias, para proteger minha sequência num dia em que eu esquecer.
2. Como pessoa, quero que o gelo seja gasto sozinho, sem eu precisar lembrar, porque o dia esquecido é justamente quando não abro o app.
3. Como pessoa, quero saber que um gelo foi gasto na próxima vez que eu abrir o app, para entender por que meu foguinho continua aceso.
4. Como pessoa, quero ver quantos gelos tenho guardados e o máximo, para decidir se compro mais.
5. Como pessoa, quero que o gelo não seja gasto num dia de descanso ou de férias, porque esses dias já estão protegidos.
6. Como pessoa, quero que dois dias esquecidos gastem dois gelos, e que a sequência quebre se acabarem.
7. Como pessoa, quero marcar que hoje é dia de descanso, para pausar sem perder o foguinho.
8. Como pessoa, quero que o app recuse descanso para qualquer dia que não seja hoje, para a sequência ser honesta.
9. Como pessoa, quero ver quantos descansos ainda posso marcar nesta semana.
10. Como pessoa, quero continuar ganhando joias por descansar, porque descansar também é cuidado.
11. Como pessoa nova, quero ganhar meu primeiro gelo de presente, para conhecer a ideia.
12. Como pessoa, quero ver no Perfil quantas vezes descansei no mês e no total, e quantos gelos usei.
13. Como pessoa, quero ver meu ritmo: média de foco por dia, taxa de hábitos dos últimos 30 dias, meu melhor período e meu melhor dia da semana.
14. Como pessoa, quero ver se as semanas em que descansei renderam mais foco do que as sem descanso, para enxergar que a pausa ajuda.
15. Como pessoa, quero ver quantas tarefas e metas concluí e quantas joias já ganhei.
16. Como pessoa conectada pelo Claude (MCP), quero perguntar quantos gelos tenho e minhas métricas.
17. Como pessoa no modo demo, quero ver gelos e métricas de exemplo.

## Implementation Decisions

### Gelo

- **Modelo:** `FreezeUse` com chave `(userId, date)` para cada dia protegido. As compras entram no livro de joias que já existe (spec 18), com o motivo `gelo`. O saldo de gelos não é gravado: é calculado como presente inicial mais compras menos usos, e nunca passa de `GELO.maxGuardados`.
- **Gasto preguiçoso, sem job:** não existe cron no projeto. Toda escrita que mexe na sequência e o `/api/sync` chamam a mesma função. Ela olha os dias lógicos fechados desde o último dia resolvido, do mais antigo para o mais novo. Para cada dia vazio, não descanso e não férias, gasta um gelo se houver; senão a sequência quebra ali e os dias seguintes não gastam gelo. Ela grava os `FreezeUse` com `skipDuplicates` (idempotente) e guarda o último dia resolvido no cache `MascotState`.
- **Só dentro da sequência:** gelo só é gasto quando a sequência atual é maior que zero. Uma pessoa sem sequência não perde gelo à toa.
- **Função pura no core** (`domain/gelo.ts`): recebe dias com cuidado, descansos, férias, gelos já usados, saldo, último dia resolvido e o dia de hoje. Devolve os dias a proteger. Ela não chama `Date.now()`.
- **Sequência:** `StreakDayState` ganha `'gelo'`. Mudança de contrato em `types.ts`, autorizada por esta spec. `computeStreak` trata o dia com gelo como o de descanso: mantém e não soma.
- **Rotas:**
  - `POST /api/gelo` compra um gelo. Erros: `joias_insuficientes` e `gelo_no_maximo`.
  - `GET /api/gelo` devolve `{ guardados, max, usados: DateKey[] }`.
  - O `/api/sync` ganha `gelo: { guardados, max, recentes: DateKey[] }`, onde `recentes` são os gastos que a pessoa ainda não viu. Para o aviso, `PUT /api/gelo/visto` marca como visto.
- **Conquista:** "Gelo na hora certa", para quem usou o primeiro gelo, entra no catálogo da spec 14 com meta 1.

### Descanso

- `PUT /api/rest-days/:date` só aceita a data igual ao dia lógico de hoje (no fuso e na hora de começo do dia da pessoa). Qualquer outra data é recusada com `descanso_so_hoje`. Também recusa com `limite_de_descanso`, contando por semana do app. `DELETE` segue a mesma regra: só desmarca o de hoje.
- Como o descanso é só de hoje e o gelo só é gasto em dias fechados, os dois nunca disputam o mesmo dia.
- O `/api/sync` ganha `descanso: { restantesNaSemana, maxPorSemana }`.
- As joias por descanso (`JOIAS.por.restDay`) continuam. Desmarcar um descanso devolve as joias, como já acontece com desfazer um hábito.

### Métricas

- `GET /api/profile/metrics` devolve:

  ```text
  descanso: { total, noMes, semanasComDescanso, focoMedioSemanaComDescanso, focoMedioSemanaSem }
  gelo: { usadosTotal, guardados }
  ritmo: { focoMedioPorDia30, taxaHabitos30, melhorPeriodo, melhorDiaDaSemana, sessoesTerminadas }
  feitos: { tarefasConcluidas, metasConcluidas, joiasGanhas }
  ```

- As médias usam os últimos 30 dias lógicos e só contam os dias desde a criação da conta.
- `melhorPeriodo` reaproveita `sessionsByPeriod` (spec 08). `melhorDiaDaSemana` é o dia da semana com mais minutos de foco.
- A comparação de foco com e sem descanso só aparece com pelo menos 2 semanas de cada tipo; antes disso os campos vêm nulos.
- **Função pura no core** (`domain/metricas.ts`), que o modo demo também usa para calcular localmente. O servidor entrega pronto, como `verEstatisticas`.
- O número de queries não pode crescer com os dados (regra de `docs/api.md`, teste com `countQueries`).
- **MCP:** as ferramentas `ver_gelo` e `ver_metricas` são só leitura. O MCP não compra gelo.
- `DELETE /api/data` e a exportação incluem `FreezeUse`.

## Testing Decisions

- **Core, gelo:**
  - um dia vazio com 1 gelo fica protegido;
  - dois dias vazios com 1 gelo: o primeiro é protegido e a sequência quebra no segundo;
  - descanso e férias não gastam gelo;
  - sequência zero não gasta gelo;
  - rodar duas vezes não gasta de novo;
  - hoje vazio não gasta gelo.
- **Core, descanso:** ontem e amanhã recusados, hoje aceito (inclusive perto da virada do dia em outro fuso), limite da semana com a semana começando em `STREAK.weekStartsOn`.
- **Core, métricas:** os números com dados sintéticos; os campos nulos com pouca história; o melhor dia empatado escolhe o mais recente (proposta).
- **API:**
  - compra sem joias devolve o erro e não gasta nada;
  - compra no máximo é recusada;
  - o sync depois de dois dias vazios devolve `recentes` com um dia;
  - descanso para ontem ou amanhã devolve 400 com `descanso_so_hoje`.

  Prior art: `rest-days.test.ts`, `house.test.ts` e `streak.test.ts`.

## Out of Scope

- Gelo de presente por conquista ou por sequência longa (pode vir depois).
- Gelo comprado com dinheiro.
- Notificação avisando que o gelo foi gasto.
- Reparar uma sequência quebrada pagando joias.

## Further Notes

- **Migração:** `FreezeUse` é uma tabela nova. Para quem já tem conta, o último dia resolvido começa em hoje, então ninguém perde gelo por dias antigos.
- **Descanso antigo:** quem marcou descanso para trás antes desta spec mantém os dias. A regra nova vale só daqui para frente.
