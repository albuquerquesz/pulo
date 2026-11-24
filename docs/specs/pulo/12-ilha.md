# Spec 12: Ilha do sapo

Status: feita no app web (24/11/2026).

## Problem Statement

A lagoa (spec 04) cresce em 4 fases e para. Depois de umas semanas a pessoa vê "a lagoa está completa" e o app deixa
de devolver alguma coisa pelo cuidado de cada dia. O Victor pediu um mapa de ilha com níveis, misturando duas ideias:
melhorar o ambiente (como o Monke, que decora o acampamento com a moeda ganha) e pagar para ir para a próxima fase
(como as ilhas do Focus Island), tudo a partir dos hábitos e no design system do Pulo.

## Solution

Uma aba **Ilha**, logo depois de Hoje, com um mapa em 2.5D (isométrico, em SVG):

- **Moscas** são a moeda. Cada coisa feita vale moscas (`ISLAND.fliesPer` em `decisions.ts`):
  hábito feito 1, foco que conta como cuidado 3, dia de descanso 2, marco de meta riscado 3, meta concluída 10.
  O descanso também paga: cuidar de si nunca vale menos.
- **Áreas** são os níveis, na ordem do mapa: Lagoa (já aberta), Praia, Bosque, Cachoeira e Farol.
  Cada uma abre pagando o preço dela (`ISLAND.areaCost`), sempre na ordem.
- **Enfeites**: três por área (`ISLAND.decorCost`). Só dá para enfeitar uma área aberta.
  Cada enfeite comprado aparece desenhado na ilhota.
- O sapo fica na área mais alta aberta. Ao abrir uma área ou comprar um enfeite, ele comemora (evento `feliz`).
- O painel ao lado do mapa (embaixo, no celular) mostra a área escolhida: abrir, enfeites e quanto falta.
  Logo abaixo, "Como ganhar moscas" mostra quanto cada coisa vale e quanto já rendeu.

Nada se perde por falhar, como no resto do app: o que foi comprado fica para sempre, e a ilha nunca regride.

## User Stories

1. Como pessoa, quero ver minhas moscas crescerem a cada hábito, foco ou descanso, para sentir que o dia valeu.
2. Como pessoa, quero gastar moscas abrindo áreas novas, para ter um objetivo que dura meses.
3. Como pessoa, quero enfeitar a ilha do meu jeito, para ela ser minha.
4. Como pessoa, quero saber quanto falta para a próxima área, sem sentir cobrança.

## Implementation Decisions

- **Saldo calculado, compras gravadas.** As moscas ganhas vêm dos registros que o app já guarda (hábitos, sessões,
  descansos e metas) e nunca são gravadas. Só as compras (`IslandPurchase`, uma por item) vão para o banco.
  Saldo = ganhas menos gastas, nunca negativo: desmarcar um hábito depois de comprar só deixa o saldo em zero.
- **Regra única.** `packages/core/domain/ilha.ts` tem `estadoDaIlha` (mapa e saldo) e `validarCompra`. O app usa
  `comprarNaIlha`; a API repete `validarCompra` numa transação serializável antes de gravar, então o preço e a ordem
  não dependem do cliente.
- **Catálogo no código.** Nomes e desenhos das áreas ficam em `ilha.ts` e em `apps/web/src/mascot/ilha/MapaDaIlha.tsx`;
  os preços, em `ISLAND` (`decisions.ts`). Todos os números são proposta.
- **Isométrico em SVG**, sem 3D de verdade: leve no celular, sem modelos 3D e no mesmo traço do sapo e da lagoa.
- **A lagoa da tela Hoje continua.** As fases do sapo (spec 04) seguem pelos dias de cuidado; a ilha é uma camada
  a mais, de longo prazo.
- MCP: `ver_ilha` e `comprar_na_ilha` fazem o mesmo que a tela.

## Fora do escopo

- Arrastar enfeites para outro lugar (cada enfeite tem posição fixa).
- Mais áreas depois do Farol, eventos sazonais e amigos do sapo.
