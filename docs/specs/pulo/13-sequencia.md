# Spec 13: Sequência com foguinho

Status: a fazer. Origem: rascunho `apps/web/public/rascunhos/desktop.html` (aba Hoje, cartão Sequência e barrinha de números do trilho). Nada disso existe na API hoje.

## Problem Statement

O rascunho mostra "12 dias seguidos" no topo do trilho, um cartão Sequência com a barra da semana (dias feitos, dia de descanso, hoje) e um recorde. A API não calcula sequência nenhuma: não há função de domínio, campo no `/api/sync` nem rota. O app teria que somar `HabitLog` e `RestDay` no cliente, com regras de dia lógico e fuso que já vivem no servidor, e cada tela faria a conta de um jeito.

## Solution

O servidor passa a devolver a sequência pronta: dias seguidos atuais, recorde e o estado dos 7 dias da semana corrente. A regra mora numa função pura do core, usada pela API e pelo modo demo.

- Um dia conta para a sequência quando tem pelo menos um hábito feito **ou** uma sessão de foco que conta como cuidado.
- Dia de descanso marcado (`RestDay`) não quebra a sequência e não soma: a chama fica acesa, o número não sobe. Proposta minha, segue o tom do app de que descansar também é cuidado.
- Hoje sem nada feito ainda não quebra a sequência: ela só quebra quando o dia lógico termina vazio.
- O dia vira na hora de começo do dia da pessoa (`profile.dayStartMinutes`) no fuso dela (`metadata.timezone`).

## User Stories

1. Como pessoa, quero ver quantos dias seguidos eu cuidei de mim, para sentir que estou construindo algo.
2. Como pessoa, quero ver meu recorde, para ter um alvo para bater.
3. Como pessoa, quero que marcar descanso não apague meu foguinho, para não me sentir punida por descansar.
4. Como pessoa, quero que o dia de hoje ainda vazio não zere a sequência antes da hora, para não levar susto de manhã.
5. Como pessoa, quero ver a semana em letras D S T Q Q S S com cada dia colorido como feito, descanso ou hoje, para entender o padrão da semana num olhar.
6. Como pessoa, quero que a barra da semana avance até hoje, para ver o quanto falta para fechar a semana.
7. Como pessoa que dorme tarde, quero que o dia vire na hora que eu defini, para um hábito feito à 1h contar no dia certo.
8. Como pessoa em outro fuso, quero que a sequência use o meu fuso, para não perder dias por causa do servidor.
9. Como pessoa, quero que desfazer um hábito por engano recalcule a sequência, para o número ser sempre verdadeiro.
10. Como pessoa, quero que a sequência apareça igual no Hoje, no trilho e no Perfil, para não ver números diferentes.
11. Como pessoa usando o modo demo, quero ver uma sequência de exemplo, para entender a ideia sem login.
12. Como pessoa conectada pelo Claude (MCP), quero perguntar minha sequência, para o assistente me responder com o número certo.

## Implementation Decisions

- **Função pura no core**, no módulo de domínio ao lado de `care-days`: recebe hábitos feitos, sessões, descansos, o dia lógico de hoje e devolve `{ atual, recorde, semana }`. `semana` é uma lista de 7 itens `{ date: DateKey, estado: 'feito' | 'descanso' | 'vazio' | 'hoje' | 'futuro' }`. Não chama `Date.now()`: recebe `Clock` ou `now`.
- **"Conta como cuidado"** reaproveita a regra que a ilha já usa para sessões (`careSession`), para as duas telas concordarem.
- **Recorde calculado, não gravado**, como as moscas: é o maior trecho contínuo no histórico. Se o histórico for grande demais para o sync, o recorde vai para o cache `MascotState` (já é um cache derivado), atualizado nas escritas de hábito, sessão e descanso. Decidir na implementação medindo.
- **Contrato**: `/api/sync` ganha um campo `streak` com o formato acima. Opcional uma rota `GET /api/streak` para o MCP. Schemas em `@pulo/core/api/schemas`.
- **Modo férias** (Perfil) e **lembrete da noite** dependem desta spec, mas ficam na spec 15.
- O número de queries da rota não pode depender da quantidade de dados (regra de `docs/api.md`, teste com `countQueries`).

## Testing Decisions

- Um bom teste olha só a entrada e a saída: registros de um usuário viram um número e uma semana. Nada de testar como a função percorre os dias.
- Core: testes da função pura com relógio fixo. Casos: sequência simples, descanso no meio, hoje vazio, virada às 4h, fuso diferente, recorde maior que a atual, histórico vazio.
- API: teste de rota contra o Postgres de teste, no mesmo padrão de `week-summary.test.ts` e `sync.test.ts`, incluindo o teste de 1 registro contra 50 registros com `countQueries`.
- Client: a suíte `repository-contract` cobre o campo novo do sync.

## Out of Scope

- Congelar a sequência pagando joias (como o protetor do Duolingo).
- Notificação push do lembrete.
- Ranking ou comparação com outras pessoas.

## Further Notes

- Decisão aberta do Victor: se só hábito conta ou se foco sozinho também conta. Esta spec propõe que os dois contam.
- O rascunho mostra 🔥12 e recorde 21; são dados sintéticos.
