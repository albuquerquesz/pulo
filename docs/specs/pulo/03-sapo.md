# Spec 03: sapo (mascote)

Status (21/11/2026): A rever.

Origem: `design-system-conceito.md`, seção 4, e `conceito-visual-mascote-lagoa.png`. Formato `/to-spec`, sem entrevista. Depende da spec 01 (fases e entradas do estado) e da 02 (cores e constantes de movimento). A spec 04 posiciona este sapo na lagoa.

## Problem Statement

O sapo é o centro do projeto e o que mais pesa no vídeo de 3 minutos. Hoje existe só um placeholder desenhado por código (peças em elipses e polígonos). Falta: peças separadas e nomeadas que dá para animar; uma regra única de **qual estado mostrar em cada momento** (hoje cada tela escolheria o seu); animações com acabamento; e comportamento para quem reduz movimento. Sem isso o sapo vira uma imagem que só troca de rosto.

## Solution

Um componente `<Sapo fase estado tamanho />` feito de peças SVG, mais uma **máquina de estados pura** que decide o estado a partir das entradas do domínio, e um conjunto de animações no Reanimated. A arte do placeholder (corpo médio, verde `#8FE05A`) é o ponto de partida; o sapo final vem da escolha do Victor e de um passo de refinamento (sombra, luz, dedos, pálpebras).

## User Stories

1. Como pessoa usuária, quero ver o sapo reagir quando termino um bloco de foco.
2. Como pessoa usuária, quero ver o sapo cansado depois de alguns focos interrompidos no dia, sem cobrança.
3. Como pessoa usuária, quero ver o sapo focado enquanto o timer roda.
4. Como pessoa usuária, quero ver o sapo pensando enquanto a IA analisa e surpreso quando ela acha um padrão.
5. Como pessoa usuária, quero ver o sapo dormindo fora do meu horário.
6. Como pessoa usuária, quero ver o sapo crescer de fase com uma animação de marco.
7. Como pessoa usuária que reduz movimento, quero o sapo parado, trocando de estado com um desvanecimento curto.
8. Como leitor de tela, quero ouvir o estado do sapo ("Sapo cansado").
9. Como desenvolvedor, quero uma tabela de prioridade clara de estados para não haver dois estados disputando.
10. Como a spec 04, quero posicionar o sapo numa folha e mudar o tamanho sem redesenhar.

## Implementation Decisions

**Peças nomeadas** (cada uma é um grupo SVG com pivô definido): cabeça, olho esquerdo e direito, pálpebra esquerda e direita, boca, corpo, barriga, braço esquerdo e direito, mão esquerda e direita, coxa esquerda e direita, pé esquerdo e direito, bochecha esquerda e direita, mais extras por estado (suor, balão de pensamento, "z", brilhos, linhas de impacto). Viewbox 300 por 300, base do sapo em y igual a 270.

**Estados:** `parado`, `feliz`, `cansado`, `pensando`, `surpreso`, `focado`, `dormindo` e o evento `pouso`. Cada estado é uma combinação de olhos, boca e extras (definida na prancha do conceito).

**Entradas da máquina:** focos interrompidos hoje, sessão em andamento (spec 06), análise da IA em curso (spec 08), proposta recém chegada (spec 08), bloco concluído há pouco, mudança de fase ou semana estável (spec 01), horário atual contra o dia do usuário.

**Prioridade (da maior para a menor):**
1. `pouso` (evento, ~1,2 s) em marco de fase ou semana estável.
2. `surpreso` (evento, ~3 s) quando chega uma proposta da IA.
3. `feliz` (evento, ~4 s) ao concluir um bloco.
4. `pensando` enquanto a IA analisa.
5. `focado` com sessão em andamento.
6. `cansado` com 2 ou mais focos interrompidos no dia (`FROG_TIRED_MIN_INTERRUPTED`).
7. `dormindo` fora do dia do usuário.
8. `parado`.
Eventos transitórios voltam ao estado de base quando acabam.

**Fases visuais (arte necessária):**
| Fase | Sapo | Estados com arte |
|---|---|---|
| 1 | Jovem | todos |
| 2 | Jovem | todos |
| 3 | Jovem | todos |
| 4 | Adulto | todos |
Sem girino: o mascote é sapo desde a fase 1, com todos os estados (decisão do Victor).

**Animações (Reanimated):** respirar (escala 1,04 por 0,96, 3,4 s, loop), piscar a cada 3 a 6 s (intervalo sorteado), pulinho ao marcar um hábito, pouso (squash 1,22 por 0,78 em 120 ms e mola), olhar para o toque (opcional). Todas na thread de UI. Constantes vêm da spec 02.

**Reduzir movimento:** sem loops, sem pulos; a troca de estado é um desvanecimento de 120 ms.

**Acessibilidade:** rótulo "Sapo, <estado>" e a mudança de estado anunciada de forma discreta.

**Biblioteca de SVG:** a mais usual no React Native é `react-native-svg`; **não verifiquei** compatibilidade com a versão atual do Expo nem com a web. Confirmar antes de codificar.

**Código:** `src/mascot/sapo/` (peças, estados, máquina) e `src/mascot/machine.ts` (função pura).

## Testing Decisions

Máquina testada como função pura, com tabela de entradas e saída. Seam: o objeto de entradas.
- Sessão em andamento e focos interrompidos resulta em `focado` (focado vence cansado).
- Chegada de proposta durante `focado` resulta em `surpreso` por 3 s e depois `focado`.
- Fora do dia do usuário e sem eventos resulta em `dormindo`.
- Mudança de fase dispara `pouso` e depois o estado base.
- Fase 1 pedindo `surpreso` cai para `parado`.
- Com reduzir movimento, nenhum loop é registrado.
- Todo estado tem definição de rosto e rótulo de acessibilidade.

## Out of Scope

Rive e outros formatos de animação, sincronia labial, voz, acessórios e skins, interação por toque além do olhar, sapo em 3D.

## Further Notes

- **Risco principal: volume de arte e animação em poucos dias.** Corte em ordem: estados das fases 1 e 2, depois "pouso", depois piscar sorteado.
- O sapo final depende da decisão do Victor. Até lá o placeholder cumpre o papel e os geradores (`sapo_estados_lagoa_gen.py`) produzem as formas.
- A silhueta e o rosto são originais. O desenho não reproduz nenhum personagem existente; a postura sentada é só a ideia de um sapo ágil.
