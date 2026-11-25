# Spec 31: Mansão do sapo, a casa grande com cômodos e detalhes

Status: feito. Origem: pedido do Victor de 25/11/2026 ("aumentar a estrutura da casa, comprar mais partes; no Focus Friend é basicamente uma mansão, com muito mais detalhes do que a nossa ilha"). Backend e web. Depende das specs 18, 23 e 24.

## Problem Statement

A casa tem 6 partes (`HOUSE.partCost`): o quarto, que vem pronto, mais cozinha, varanda, jardim, árvore e cerca. Somando tudo dá 390 joias, e uma pessoa ativa fecha a casa em menos de um mês. Depois disso as joias não têm mais para onde ir. A arte da ilha também é simples perto do Focus Friend, onde a casa vira uma mansão cheia de detalhes, com vários cômodos para decorar.

## Solution

A casa vira um projeto longo, em três camadas compradas com joias:

1. **Cômodos.** São espaços novos da casa. Cada um aparece na ilha como uma parte da construção e vira um cômodo decorável na Casa.
2. **Estrutura.** São andares e peças que mudam a silhueta: segundo andar, sótão, torre e chaminé. Alguns exigem outros antes (pré requisito).
3. **Exterior.** São detalhes ao redor da casa que deixam a ilha viva: horta, lago com deque, balanço, poste de luz, caixa de correio, ponte, piscina e estufa.

O catálogo proposto, para o `decisions.ts` (proposta minha, o Victor decide os preços):

| Id | Nome | Camada | Preço | Requer |
| --- | --- | --- | --- | --- |
| `quarto` | Quarto | cômodo | 0 | (pronto) |
| `cozinha` | Cozinha | cômodo | 200 | |
| `sala` | Sala de estar | cômodo | 300 | |
| `banheiro` | Banheiro | cômodo | 180 | |
| `escritorio` | Escritório | cômodo | 500 | `segundo-andar` |
| `biblioteca` | Biblioteca | cômodo | 700 | `segundo-andar` |
| `estudio` | Estúdio de música | cômodo | 850 | `segundo-andar` |
| `observatorio` | Observatório | cômodo | 1500 | `torre` |
| `segundo-andar` | Segundo andar | estrutura | 800 | `sala` |
| `sotao` | Sótão | estrutura | 450 | `segundo-andar` |
| `torre` | Torre | estrutura | 1200 | `segundo-andar` |
| `chamine` | Chaminé | estrutura | 90 | `cozinha` |
| `varanda` | Varanda | exterior | 120 | |
| `jardim` | Jardim | exterior | 80 | |
| `arvore` | Árvore | exterior | 120 | |
| `cerca` | Cerca | exterior | 50 | |
| `horta` | Horta | exterior | 110 | `jardim` |
| `caixa-correio` | Caixa de correio | exterior | 30 | |
| `poste` | Poste de luz | exterior | 45 | |
| `balanco` | Balanço | exterior | 80 | `arvore` |
| `lago` | Lago com deque | exterior | 400 | |
| `ponte` | Ponte | exterior | 300 | `lago` |
| `estufa` | Estufa | exterior | 650 | `horta` |
| `piscina` | Piscina | exterior | 1100 | `varanda` |

A casa toda custa 9.855 joias (preços subidos pelo Victor em 25/11/2026: "tudo tá muito barato"), de 13 a 25 meses de uso, conforme a pessoa rende de 13 a 25 joias por dia. Os preços das 6 partes antigas também subiram; quem já comprou fica com elas.

## User Stories

1. Como pessoa, quero muito mais partes para comprar, para as joias sempre terem um destino.
2. Como pessoa, quero ver na ilha uma casa grande que cresce: andares, torre, chaminé soltando fumaça e um jardim cheio.
3. Como pessoa, quero ver as partes que ainda faltam como prévia apagada e tracejada, como hoje, inclusive as do segundo andar.
4. Como pessoa, quero que uma parte com pré requisito apareça trancada com o motivo ("Precisa do Segundo andar"), para entender a ordem.
5. Como pessoa, quero ver as partes agrupadas em Cômodos, Estrutura e Exterior, com o progresso de cada grupo, para o pé da ilha não virar uma lista enorme.
6. Como pessoa, quero ver no topo quantas partes tenho de quantas, como 7 de 24.
7. Como pessoa, quero ver a próxima parte que cabe no meu saldo destacada, para ter um alvo.
8. Como pessoa, quero que cada cômodo comprado vire um espaço próprio na Casa, para decorar cada um do meu jeito.
9. Como pessoa, quero trocar de cômodo na Casa por um seletor, e o sapo andar no cômodo escolhido.
10. Como pessoa, quero escolher em qual cômodo fico durante o foco, para focar na biblioteca ou no escritório.
11. Como pessoa, quero que a decoração de um cômodo não apareça nos outros.
12. Como pessoa, quero detalhes vivos na ilha: luzes acesas nas janelas no tema escuro, fumaça na chaminé, água no lago e balanço mexendo, todos parados quando o sistema pede menos movimento.
13. Como pessoa, quero ver o sapo pela janela do cômodo em que ele está.
14. Como pessoa que já tinha comprado partes, quero continuar com todas elas no mesmo lugar.
15. Como pessoa, quero que a conquista Casa inteira peça a casa toda nova, e ganhar conquistas no caminho (primeiro andar novo, cinco cômodos).
16. Como pessoa no celular, quero aproximar e arrastar a mansão, e ver as partes numa faixa que rola na horizontal dentro do próprio painel.
17. Como pessoa no modo demo, quero ver uma casa de exemplo já pela metade.

## Implementation Decisions

### Core e contrato

- **Catálogo no `decisions.ts`**, autorizado por esta spec: `HOUSE.parts` com `{ id, nome, emoji, camada, custo, requer? }` na ordem da tabela. `HOUSE.partCost` continua derivado dele, para não quebrar quem lê. O `ParteId` em `@pulo/core/domain/casa` vem do catálogo.
- **Regra pura** em `domain/casa.ts`:
  - `podeComprar(parte, compradas, saldo)` devolve `ok`, `ja_tem`, `falta_requisito` (com o id que falta) ou `joias_insuficientes`;
  - `progressoPorCamada(compradas)` diz quantas partes de cada camada a pessoa já tem.
- **Cômodos decoráveis:** `camada: 'comodo'` marca as partes que viram um cômodo na Casa. O `ROOM_GRID` vale para todos os cômodos.
- **Conquistas** (spec 14): `casa-inteira` passa a contar o catálogo inteiro. Entram `dois-andares` (comprou o Segundo andar) e `cinco-comodos` (tem 5 cômodos), com metas no catálogo.

### API

- `PUT /api/house/:item` valida o pré requisito e responde 409 com `falta_requisito` e o `requer`. A validação do preço e do saldo não muda. Não precisa de migração: as partes já são linhas de compra com `item` em texto.
- **Decoração por cômodo:** `RoomPlacement` ganha a coluna `comodo` (texto, padrão `quarto`), e a chave vira `(userId, item)`. Cada item continua comprado uma vez só e fica em um cômodo de cada vez. Mover para outro cômodo é um `PUT` com o `comodo` novo. A migração preenche `quarto` nas linhas que já existem.
- **Rotas de decoração:**
  - `PUT /api/room/:item` aceita `comodo` e recusa um cômodo que a pessoa não tem (`comodo_nao_comprado`);
  - o sync devolve `comodo` em cada item.
- **Foco no cômodo:** a sessão de foco já aceita metadados de vínculo (spec 19). O cômodo escolhido fica só no cliente (preferência local), sem coluna nova.

### Web

- **Ilha** (`features/ilha`):
  - a arte vira uma mansão isométrica, com o gerador de polígonos da spec 24 ampliado para o segundo andar, a torre com telhado cônico e o sótão;
  - cada parte tem a sua forma nas coordenadas da ilha, e as partes apagadas seguem o estilo tracejado de hoje;
  - a ilha cresce para caber o lago, a ponte e a piscina;
  - a câmera abre afastada o bastante para mostrar a casa toda.
- **Detalhes animados:** fumaça na chaminé, luz nas janelas no tema escuro, ondas no lago e balanço. Só CSS e SVG, e tudo para com `prefers-reduced-motion`.
- **Painel de partes:**
  - abas Cômodos, Estrutura e Exterior, cada uma com um contador;
  - as partes trancadas mostram um cadeado e o motivo;
  - a próxima parte que cabe no saldo ganha destaque;
  - no celular, o painel é uma faixa horizontal com rolagem própria.
- **Casa** (`features/casa`):
  - um seletor de cômodo no topo, com emoji e nome, só com os cômodos comprados;
  - cada cômodo tem uma cor de parede e de piso própria, definida no catálogo de cômodos do web e sem cor solta (tokens);
  - a decoração e a loja filtram pelo cômodo atual;
  - o timer usa o cômodo atual.
- **Rascunho:** as peças novas são desenhadas no padrão visual do rascunho (contorno 4px `--pulo-contorno`, sombras internas, paleta do tema). Não mexer em `apps/web/public/rascunhos/`.

## Testing Decisions

- **Core:**
  - `podeComprar` para cada resultado;
  - a cadeia de requisitos (torre sem segundo andar);
  - o progresso por camada;
  - o catálogo sem ciclos e sem requisito apontando para um id que não existe;
  - o total do catálogo bate com a tabela.
- **API:**
  - comprar torre sem segundo andar devolve 409 `falta_requisito`;
  - as compras antigas continuam válidas;
  - mover um item de cômodo funciona;
  - cômodo não comprado devolve 400;
  - a migração põe `quarto` nas decorações existentes.

  Prior art: `house.test.ts`.
- **Web:**
  - as abas filtram;
  - uma parte trancada não chama o repositório e mostra o motivo;
  - comprar muda o contador da camada;
  - o seletor de cômodo troca a decoração mostrada.

  Prior art: `IlhaScreen.test.tsx` e `CasaScreen.test.tsx`.

### Acesso à próxima ilha

- Um cais sai da beira da grama, com um arco de pedra e madeira e, ao longe, a próxima ilha apagada e tracejada.
- Fica trancado (corrente e cadeado) até a casa inteira estar pronta (`casaCompleta` no core). Tocar mostra quantas partes faltam; com a casa inteira, avisa que a próxima ilha chega em breve.
- A próxima ilha em si é outra spec.

## Out of Scope

- Ilhas novas e vizinhos.
- Melhorias por nível da mesma parte (cozinha nível 2).
- Itens de decoração novos para os cômodos novos (a loja do quarto continua com o catálogo atual).
- Visitar a casa de outra pessoa.

## Further Notes

- Os preços são a decisão mais sensível: com o gelo a 50 joias (spec 29), a pessoa escolhe entre proteger a sequência e construir.
