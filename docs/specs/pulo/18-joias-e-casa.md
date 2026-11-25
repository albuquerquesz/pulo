# Spec 18: Joias, casa na ilha e decoração do quarto

Status: a fazer. Origem: rascunho, abas Ilha e Casa, barrinha do trilho e cartão Sua casa. Substitui o mapa de áreas da spec 12.

## Problem Statement

A API tem a ilha da spec 12: moeda chamada moscas, cinco áreas abertas em ordem e três enfeites por área. O Victor mudou a direção:

- a moeda passa a se chamar **joias**;
- a ilha vira uma ilha só, onde a pessoa constrói a **casa do sapo** por partes (quarto, cozinha, varanda, jardim, árvore, cerca). Outras ilhas só no futuro, depois da casa completa;
- dentro do quarto (a aba Casa, onde o foco acontece), a pessoa compra **decorações** com joias; o quarto começa vazio;
- o jogo fica mais lento: ganhar joias depende mais do foco.

Hoje o catálogo `ISLAND`, as regras de compra (`fora_de_ordem`, `area_fechada`) e os nomes de erro (`moscas_insuficientes`) estão amarrados às áreas antigas.

## Solution

Trocar o catálogo e a nomenclatura, manter a mecânica que já funciona (saldo calculado, compras gravadas, nada regride) e acrescentar o catálogo de decoração do quarto.

## User Stories

1. Como pessoa, quero ganhar joias quando foco, para o foco virar algo concreto.
2. Como pessoa, quero ganhar 1 joia a cada 5 minutos focados, para entender a conta.
3. Como pessoa, quero ver meu saldo de joias no topo de todas as telas, para saber quanto tenho.
4. Como pessoa, quero ver a casa do sapo na ilha com as partes que faltam apagadas, para saber o que posso construir.
5. Como pessoa, quero comprar uma parte da casa com joias e ver ela surgir, para sentir o progresso.
6. Como pessoa, quero ver quantas partes da casa já tenho, como 1 de 6, para saber o quanto falta.
7. Como pessoa, quero que o quarto já venha pronto, para ter onde o sapo morar desde o começo.
8. Como pessoa, quero ver quanto falta em joias e em horas de foco para a próxima parte, para planejar.
9. Como pessoa, quero que o quarto comece vazio e eu decore com o que compro, para ele ficar do meu jeito.
10. Como pessoa, quero comprar itens de decoração na loja e ver o item aparecer no quarto, para a compra ter efeito visível.
11. Como pessoa, quero escolher onde colocar cada item no quarto, para montar o meu canto.
12. Como pessoa, quero ver os itens caros demais apagados, para não tentar comprar sem saldo.
13. Como pessoa, quero que nada que comprei se perca, mesmo se eu desfizer um hábito depois, para não ser punida.
14. Como pessoa que já tinha moscas e compras da ilha antiga, quero manter meu saldo, para não perder o que juntei.
15. Como pessoa, quero que a casa completa destrave a próxima ilha no futuro, para o jogo continuar.

## Implementation Decisions

- **Renomear moscas para joias** no core, na API, no MCP e nos códigos de erro (`joias_insuficientes`). O saldo continua calculado, nunca gravado.
- **Ganho**: além do que já rende (hábito, descanso, marco, meta pelo baú da spec 16), o foco passa a render por minuto: `floor(minutosFocados / 5)` por sessão terminada, no lugar do valor fixo por sessão de cuidado. Valores no `decisions.ts` (contrato compartilhado). Proposta minha: casa com preços de 40 a 120 joias, o que dá de 3 a 10 horas de foco por parte.
- **Catálogo `HOUSE`** no lugar das áreas: `quarto` (0, já vem), `cozinha`, `varanda`, `jardim`, `arvore`, `cerca`, cada um com preço. Sem ordem obrigatória: qualquer parte pode ser comprada se o saldo paga.
- **Catálogo `ROOM_DECOR`**: itens do quarto com preço. A compra grava o item e uma posição na grade do chão (`x`, `y`) e uma rotação; mover um item já comprado é grátis.
- **Modelo**: `IslandPurchase` vira o registro genérico de compra com `kind: 'casa' | 'decoracao'`, mantendo `(userId, item)` como chave. A posição da decoração mora num modelo próprio porque muda sem nova compra.
- **Migração**: compras antigas de áreas e enfeites são convertidas em saldo devolvido (somam como ganho histórico) para ninguém perder joias. Detalhe da conversão decidido na implementação, com teste.
- **Contrato**: `PUT /api/house/:item` compra parte da casa; `PUT /api/room/:item` compra decoração; `PATCH /api/room/:item` move. Erros: `item_inexistente`, `preco_divergente`, `ja_comprado`, `joias_insuficientes`.

## Testing Decisions

- Core: saldo com foco de 4, 5 e 49 minutos; compra que deixaria o saldo negativo é recusada; desfazer hábito depois da compra deixa saldo em zero, nunca negativo.
- API: compra idempotente; dois aparelhos comprando o mesmo item ao mesmo tempo, só um paga; migração mantém o saldo de quem tinha compras antigas. Prior art: `island.test.ts`, `ilha.test.ts`.

## Out of Scope

- Outras ilhas e outros cômodos além do quarto.
- Comprar joias com dinheiro.
- Itens animados ou interativos.

## Further Notes

- A arte final do quarto, da casa e dos itens não é desta spec; os desenhos do rascunho são provisórios.
- A spec 12 fica como histórico.
