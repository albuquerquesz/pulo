# Spec 04: lagoa

Status (21/11/2026): A rever.

Origem: `design-system-conceito.md`, seção 5, e `conceito-visual-mascote-lagoa.png`. Formato `/to-spec`, sem entrevista. Depende das specs 01 (dias de cuidado, descanso, semana estável), 02 (cores) e 03 (o sapo). O Victor pediu a lagoa como feature central, independente do corte de escopo.

## Problem Statement

O app não pode ter painel de números: a ideia é que **o mundo seja o gráfico**. A pessoa precisa ver, sem ler nada, que cuidou de si (a lagoa cresce) e que descansar também é bonito (noite, vaga lumes, chuva). Os apps concorrentes que têm "mundo" (como a ilha do Monke) o ligam a moeda e loja. Aqui o mundo deve vir só dos dados de cuidado, e precisa caber em poucos dias de arte e animação.

## Solution

Um componente `<Lagoa />` que desenha o cenário em **camadas SVG**, a partir de entradas do domínio:
- **4 fases do cenário**, ligadas 1 para 1 à fase do sapo (spec 01).
- **8 itens fixos** em espaços fixos, que aparecem por dias de cuidado ou por estado do momento.
- **Dia ou noite**, conforme o horário e o descanso.
- O **sapo** (spec 03) posicionado na folha certa.
Sem edição pela pessoa, sem moeda, sem loja.

## User Stories

1. Como pessoa usuária, quero ver a lagoa crescer conforme cuido de mim.
2. Como pessoa usuária, quero que um dia de descanso deixe a lagoa bonita (noite calma, vaga lumes, chuva suave), não vazia.
3. Como pessoa usuária, quero que itens que já ganhei nunca sumam.
4. Como pessoa usuária, quero ver o sapo na folha da lagoa, na fase em que ele está.
5. Como pessoa usuária, quero que uma semana estável deixe o dia claro e o sapo subir na folha mais alta.
6. Como pessoa usuária que reduz movimento, quero a lagoa parada.
7. Como a tela Hoje, quero um componente que só recebe o resumo do domínio e se desenha.
8. Como desenvolvedor, quero uma função pura que diga quais itens aparecem, para testar sem renderizar.
9. Como o modo demo, quero ver a lagoa mudar de fase ao avançar o relógio.

## Implementation Decisions

**Fase do cenário** = fase do sapo (1 a 4), calculada na spec 01.
| Fase | Cenário base |
|---|---|
| 1 Poça | Lama com borda marrom, água rasa |
| 2 Lagoinha | Água limpa e maior |
| 3 Lagoa | Água ampla, vitória régia |
| 4 Lagoa viva | Entardecer ou noite, flores |

**Itens e regras de aparecimento** (limites propostos por mim; decisão do Victor). Itens de progresso dependem de dias de cuidado e **nunca somem**; itens de estado dependem do momento e podem sumir.
| # | Item | Tipo | Regra |
|---|---|---|---|
| 1 | Pedra | progresso | 0 dias |
| 2 | Juncos | progresso | 1 dia de cuidado |
| 3 | Folha de vitória régia | progresso | 3 dias |
| 4 | Aguapé | progresso | 5 dias |
| 5 | Tronco | progresso | 8 dias |
| 6 | Flor (na folha) | progresso | 11 dias |
| 7 | Vaga lumes | estado | noite (fora do dia do usuário) e pelo menos 3 dias de cuidado na semana |
| 8 | Nuvem de chuva | estado | descanso registrado hoje |

**Espaços fixos** no viewbox 300 por 300 (coordenadas aproximadas tiradas do conceito, a calibrar na arte final): pedra à esquerda da água; juncos à direita; duas folhas (uma à esquerda, uma à direita, onde o sapo se senta); tronco na margem esquerda; aguapé à direita; flor sobre a folha da direita; vaga lumes e nuvem no céu.

**Dia e noite:** céu claro dentro do dia do usuário (spec 01); fora dele, ou com descanso registrado hoje, paleta noturna (céu `#243A6B`, lua, água mais escura).

**Semana estável (spec 01):** céu mais claro e o sapo se senta na folha maior.

**Animações ambientes:** ondinhas na água (loop de 4 s), folhas balançando (5 s), vaga lumes piscando e flutuando (2 a 3 s), gotas de chuva. Limite de **12 elementos animados ao mesmo tempo**, para manter a web fluida (limite que eu proponho; não medi). Reduzir movimento: cenário estático.

**Montagem:** o sapo da spec 03 entra com escala menor (cerca de 0,55 a 0,6 do tamanho de tela cheia) e posição sobre a folha.

**Código:** `src/mascot/lagoa/` (camadas e itens), `src/domain/lagoa.ts` com a função pura `itensVisiveis(resumo, agora)`.

## Testing Decisions

Funções puras com tabelas de casos. Seam: o resumo do domínio e o relógio.
- Com 0 dias aparece só a pedra; com 3, pedra, juncos e folha.
- Os itens de progresso são monotônicos: com mais dias, nenhum desaparece.
- A nuvem aparece com descanso hoje e some no dia seguinte sem descanso.
- Vaga lumes só à noite e só com 3 dias de cuidado na semana.
- Fase do cenário igual à fase do sapo.
- Com reduzir movimento, nenhuma animação ambiente é registrada.

## Out of Scope

Editor livre, loja, moeda, clima real, sons, interação por toque nos itens, estações do ano, mais de uma lagoa.

## Further Notes

- **Corte se faltar tempo:** 6 itens em vez de 8 (tire flor e tronco), depois 3 fases em vez de 4. O sapo com estados e a ação da IA não entram no corte.
- Os itens têm sabor brasileiro (vitória régia, aguapé, vaga lumes), diferentes do cenário de ilha do Monke (tendas, barcos, fogueira). Não reproduzi itens de outros apps.
- Esta spec lê dados; não os grava.
