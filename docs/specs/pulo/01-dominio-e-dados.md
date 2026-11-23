# Spec 01: domínio e dados

Status (21/11/2026): A rever.

Origem: `design-system-conceito.md`, seções 4, 5, 7 e 8. Formato `/to-spec`, sem entrevista. Esta spec define **o que o app sabe** e **como calcula**. Telas, animações e a IA só leem o que esta spec produz. Por isso vem antes das outras.

## Problem Statement

O app precisa responder a três perguntas com a mesma resposta em todas as telas: "esta pessoa cuidou de si hoje?", "em que fase está o sapo?" e "como foi a semana?". Sem um domínio único, o sapo, a lagoa e a IA vão calcular isso cada um do seu jeito e os números não vão bater. Além disso, a regra do produto é **sem culpa**: falhar nunca tira progresso, e descanso conta como cuidado. Essa regra precisa estar escrita como cálculo, não como intenção.

## Solution

Um módulo de domínio em TypeScript puro, sem dependência de tela, de armazenamento nem de IA, que:

1. Define as entidades (usuário, bloco de rotina, hábito, sessão de foco, check in, proposta semanal, estado do mascote).
2. Calcula **dia de cuidado**, **fase do sapo** e **resumo da semana** por funções puras, com relógio injetável.
3. Garante por construção que o progresso **nunca regride**.
4. Expõe os dados por uma interface de repositório, para o armazenamento poder ser trocado (local agora, nuvem depois).

## User Stories

1. Como pessoa usuária, quero que um dia com foco concluído conte como dia de cuidado.
2. Como pessoa usuária, quero que um dia de descanso registrado conte como dia de cuidado, sem precisar ter feito foco.
3. Como pessoa usuária, quero que uma sessão de foco interrompida pela metade ainda conte, para não me sentir punida.
4. Como pessoa usuária, quero que o meu sapo nunca volte para uma fase anterior, mesmo se eu ficar dias sem abrir o app.
5. Como pessoa usuária, quero que o dia mude às 4h da manhã, para uma sessão feita de madrugada contar para o dia anterior.
6. Como pessoa usuária, quero registrar minha energia de 1 a 5 e que isso fique ligado ao dia e ao período.
7. Como pessoa usuária, quero marcar um hábito como feito uma vez por dia.
8. Como pessoa usuária, quero apagar todos os meus dados quando eu decidir, e só aí o progresso zera.
9. Como a tela Hoje, quero perguntar "quantos dias de cuidado e qual fase" e receber a mesma resposta que a tela Progresso.
10. Como o módulo da lagoa, quero ler dias de cuidado, dias de descanso e estabilidade da semana, sem recalcular nada.
11. Como a IA semanal, quero receber um resumo agregado da semana, sem nomes nem texto livre.
12. Como desenvolvedor, quero injetar o relógio, para testar "o que acontece daqui a 15 dias" sem esperar.
13. Como desenvolvedor, quero trocar o armazenamento local por nuvem sem mexer nas regras.
14. Como o modo demo, quero carregar dados sintéticos de várias semanas e avançar o tempo.

## Implementation Decisions

**Entidades** (campos mínimos; tipos validados com um schema, por exemplo zod, a decidir):
- `User`: id, nome do sapo, fuso (padrão America/Sao_Paulo), início e fim do dia, tema (claro ou escuro), reduzir movimento, criadoEm.
- `RoutineBlock`: id, dia da semana (0 a 6), início em minutos, duração em minutos, tipo (`foco` ou `descanso`), título opcional.
- `Habit`: id, título, dias da semana, ativo. `HabitLog`: habitId, data, feitoEm. Máximo de 5 hábitos por dia.
- `FocusSession`: id, blockId opcional, início, fim opcional, minutos planejados, estado (`em_andamento`, `concluida`, `interrompida`), tempo pausado em ms.
- `CheckIn`: id, data, período (`manha`, `tarde`, `noite`), energia de 1 a 5, criadoEm.
- `RestDay`: data. Criado pelo botão "Dia de descanso" ou ao marcar um bloco do tipo `descanso` como feito.
- `WeeklyProposal`: id, início da semana, estado (`pendente`, `aceita`, `editada`, `negada`, `expirada`), texto do padrão, mudanças (lista), origem (`ia` ou `regra`), criadaEm, decididaEm. Detalhada na spec 08.
- `MascotState`: fase (1 a 4), diasDeCuidado, atualizadoEm. É **derivado e guardado em cache**, nunca a fonte da verdade.

**Dia lógico:** o dia muda às **04:00** no fuso do usuário (proposta minha, baseada em apps de hábito; confirmar). Toda data vira uma chave `AAAA-MM-DD` desse dia lógico.

**Dia de cuidado:** um dia lógico com **pelo menos uma** destas condições:
- uma `FocusSession` `concluida`;
- uma `FocusSession` `interrompida` com tempo efetivo de pelo menos **metade** do planejado (proposta minha, decisão aberta);
- um `RestDay`.
O dia de cuidado é **calculado** a partir dos registros, não gravado. O total de dias de cuidado é a contagem de datas distintas.

**Fases do sapo**, por total de dias de cuidado (valores propostos por mim, decisão do Victor):
| Fase | Dias de cuidado | Sapo |
|---|---|---|
| 1 | 0 a 2 | Sapo jovem |
| 2 | 3 a 7 | Sapo jovem |
| 3 | 8 a 14 | Sapo jovem |
| 4 | 15 ou mais | Sapo adulto |
O mascote é sempre um sapo, sem girino (decisão do Victor). As fases 1 a 3 mudam a lagoa ao redor; o sapo cresce na fase 4.
**Nunca regride:** a fase é `max(fase anterior guardada, fase calculada)`. Apagar uma sessão individual não reduz o total (sessões são imutáveis); só "apagar todos os meus dados" zera.

**Resumo da semana (`WeekSummary`)**, entrada da IA e das telas. Semana de segunda a domingo, dia lógico:
- minutos de foco por período (manhã 5h a 12h, tarde 12h a 18h, noite 18h a 23h; faixas propostas);
- sessões concluídas, interrompidas, e taxa de conclusão por período;
- energia média por período e número de check ins;
- dias de descanso e dias de cuidado;
- **estabilidade**: semana com pelo menos 5 dias de cuidado (proposta minha, usada pela lagoa e pelo sapo "feliz").
O resumo **não contém títulos, nomes nem texto livre**.

**Relógio injetável:** todas as funções recebem `now` como parâmetro ou um objeto `Clock`. Nenhuma chama `Date.now()` direto.

**Repositório:** uma interface (`Repository`) com leitura e escrita por entidade. A primeira implementação é local; a nuvem entra depois, atrás da mesma interface. O `expo-sqlite` suporta a web, mas exige arquivo wasm e cabeçalhos COOP e COEP no host (documentação do Expo), o que complica hospedagem estática. Por isso o MVP usa um adaptador simples de chave e valor atrás do `Repository`; a biblioteca exata não foi verificada e a decisão final está na spec 10.

**Validação:** energia de 1 a 5; duração de bloco de 5 a 120 minutos; hábitos até 5 por dia.

## Testing Decisions

Funções puras testadas com tabelas de casos e relógio fixo, sem tela. O framework (Jest do Expo ou outro) é decisão da spec 10. Seam: o objeto `Clock`.

- Uma sessão concluída às 23h50 conta para o dia; uma às 03h30 conta para o dia anterior.
- Descanso sozinho vira dia de cuidado.
- Sessão interrompida com menos da metade não conta; com metade ou mais, conta.
- Dois eventos no mesmo dia lógico contam como um dia.
- A fase passa de 1 para 2 no terceiro dia de cuidado e para 3 no oitavo.
- A fase não regride depois de 30 dias sem uso.
- O resumo agrega minutos por período e nunca inclui texto livre.
- Semana com 5 dias de cuidado é estável; com 4, não.
- Com relógio avançado em 15 dias sobre dados sintéticos, o sapo chega à fase 4.

## Out of Scope

Sincronização em nuvem e contas, multiusuário, exportação de dados, histórico entre dispositivos, notificações, qualquer regra de tela ou de animação (specs 03, 04 e 09), e o cálculo do que a lagoa mostra por item (spec 04).

## Further Notes

- **Decisões abertas:** limites de dias das fases, se sessão interrompida conta (e com que proporção), hora de virada do dia, faixas de horário dos períodos, definição de semana estável.
- **Risco:** com apenas 9 dias, as fases altas só aparecem na demo com dados sintéticos ou com o modo demo avançando o relógio. A spec 10 deve cobrir isso.
- **Por que o descanso conta:** é a tese do produto e o que o diferencia dos concorrentes que punem a falha (Habit-chi, Forest). Não é um detalhe de UI.
- Sem dados pessoais reais no demo (regulamento, item 6.9).
