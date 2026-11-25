# Spec 32: Sapo expressivo e telas de estado

Status: a fazer. Origem: anotação do Victor de 25/11/2026 na tela "Sem sinal por aqui" ("procura referências melhores para as telas de erro; adicionar expressões diferentes para o sapo, como o Duo funciona; o mascote deve funcionar de forma parecida e animada"). Web. Depende das specs 03 (sapo) e 21 (casca).

## Problem Statement

O sapo tem 8 estados (`FrogMood`: parado, feliz, cansado, pensando, surpreso, focado, dormindo, pouso). Quase todas as telas usam o parado. As telas de erro, vazio e "não encontrado" são uma pilha solta de texto e botões, cada uma montada de um jeito. Até 25/11 os botões da tela "Sem sinal" esticavam pela tela toda no desktop; um ajuste rápido (`37264c4`) já centralizou essa tela.

O Duolingo trata o Duo como um personagem com reações. As expressões são ligadas a eventos por uma máquina de estados (Rive), e o personagem reage ao que acontece: acerto, erro, sequência em risco, conquista. O sapo do Pulo deve seguir a mesma ideia: cada momento do app tem uma cara.

## Referências

- **Duolingo e Rive:** a máquina de estados liga expressões e animações a eventos, em camadas: corpo e rosto separados, rodando juntos ([Duolingo, visemes](https://blog.duolingo.com/world-character-visemes), [Rive, Lily](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life)).
- **Telas de erro:** a boa tela diz o que falhou, o que ainda funciona, o que fazer e se tentar de novo resolve ([Smashing, error states](https://www.smashingmagazine.com/2016/09/how-to-design-error-states-for-mobile-apps/), [exemplos de error states](https://screensdesign.com/articles/mobile-app-error-state-examples/)).
- **Offline:** separar offline com dados guardados, offline vazio, dado velho e falha ([LogRocket, empty states](https://blog.logrocket.com/ux-design/empty-states-ux-examples/)).

## Solution

1. **Rostos e corpos novos para o sapo.** Expressões entram como peças SVG do rosto e poses do corpo, combináveis como camadas (rosto + corpo + acessório). A animação continua em CSS e Web Animations, e para com movimento reduzido.
2. **Mapa de momentos.** Uma tabela única liga cada momento do app a um humor. As telas pedem o momento, não o humor.
3. **Tela de estado única.** Um componente `TelaDeEstado` serve para erro, sem sinal, não encontrado e vazio, sempre no mesmo layout: coluna centralizada de até 384px, sapo grande, título, texto, ação principal cheia e ações secundárias fantasma embaixo.
4. **Vida parada.** No estado parado, o sapo pisca de tempos em tempos, respira e às vezes olha para o lado, como o Duo na tela inicial.

### Humores novos (proposta)

| Humor | Rosto | Corpo e acessório | Quando |
| --- | --- | --- | --- |
| `triste` | olhos caídos, boca para baixo | ombros baixos, uma gota | sequência perdida, erro sem saída |
| `preocupado` | sobrancelhas inclinadas, boca ondulada | mãos juntas | sequência em risco à noite, gelo acabando |
| `sem-sinal` | olhos em espiral leve | segura uma antena de folha murcha | sem internet |
| `confuso` | um olho maior, boca de lado | coça a cabeça, ponto de interrogação | erro inesperado, página não encontrada |
| `comemorando` | olhos felizes | braços para cima, confete | conquista, meta concluída, casa inteira |
| `orgulhoso` | olhos meio fechados, sorriso | peito estufado, brilho | sequência longa, recorde batido |
| `acenando` | sorriso aberto | acena com a mão | boas vindas, volta depois de dias |
| `congelado` | olhos apertados | cachecol azul, tremendo | o gelo salvou a sequência (spec 30) |
| `construindo` | focado, língua de fora | martelo | comprou uma parte da casa |

### Mapa de momentos (proposta)

| Momento | Humor |
| --- | --- |
| Boas vindas | `acenando` |
| Sem internet | `sem-sinal` |
| Erro inesperado, 404 | `confuso` |
| Lista vazia (hábitos, metas, tarefas) | `pensando` |
| Fim do dia sem nada feito | `preocupado` |
| Sequência perdida | `triste` |
| Gelo gasto | `congelado` |
| Conquista, meta, baú | `comemorando` |
| Recorde | `orgulhoso` |
| Compra na ilha | `construindo` |
| Foco rodando | `focado` (já existe) |
| Descanso marcado | `dormindo` (já existe) |

## User Stories

1. Como pessoa, quero que o sapo reaja ao que acontece comigo, para ele parecer vivo e não um desenho parado.
2. Como pessoa sem internet, quero uma tela que diga o que aconteceu, o que ainda dá para fazer e um botão claro para tentar de novo.
3. Como pessoa, quero ver o sapo comemorando quando ganho uma conquista ou concluo uma meta.
4. Como pessoa, quero ver o sapo preocupado à noite quando ainda não cuidei de mim, para lembrar sem bronca.
5. Como pessoa que perdeu a sequência, quero ver o sapo triste mas com um texto de recomeço, para não desistir.
6. Como pessoa, quero ver o sapo de cachecol quando o gelo salvou meu dia.
7. Como pessoa, quero que as telas de erro, vazio e página não encontrada sigam o mesmo layout, centralizadas no desktop.
8. Como pessoa sensível a movimento, quero o sapo parado nas mesmas expressões, sem animação.
9. Como pessoa que usa leitor de tela, quero que o sapo tenha um rótulo com o humor ("Sapo, comemorando").

## Implementation Decisions

- **Contrato:** `FrogMood` em `@pulo/core/domain/types` ganha os humores novos. Mudança de contrato autorizada por esta spec. `ROSTO_DO_ESTADO` em `apps/web/src/mascot/machine.ts` ganha olhos, bocas, corpos e extras novos.
- **Momentos:** um mapa `HUMOR_DO_MOMENTO` em `apps/web/src/mascot/momentos.ts`, com tipo `Momento`. As telas chamam `<Sapo momento="sem-sinal" />` ou `EstadoVazio` com `momento`. Nenhuma tela escolhe o humor direto.
- **Desenho:** as peças novas ficam em `apps/web/src/mascot/sapo/pecas.tsx`, no traço atual (contorno, sombras e cores por token). Sem bibliotecas novas. O Rive continua fora, como na spec 03.
- **Vida parada:**
  - piscada a cada 3 a 6 segundos, sorteada sem `Math.random` nos testes (semente injetável);
  - respiração por escala leve;
  - olhar de lado a cada 15 segundos;
  - tudo desligado com movimento reduzido.
- **`TelaDeEstado`** em `apps/web/src/ui`:
  - props `momento`, `titulo`, `texto`, `acao` (principal) e `secundarias` (lista);
  - substitui o uso de `EstadoVazio` nas telas de página inteira (welcome sem sinal, erro de carregamento das abas, 404 do roteador);
  - o `EstadoVazio` de dentro de cartões continua, com `momento`.
- **Textos:**
  - **sem sinal:** dizer que o que já está na tela continua visível, quando houver dados guardados;
  - **erro:** um botão "Tentar de novo" e, escondido num detalhe, o código do erro para suporte.
- **Ligações com eventos que já existem:**
  - `emitirEvento('feliz')` passa a aceitar `comemorando` e `construindo`;
  - o aviso do gelo (spec 30) usa `congelado`;
  - o cartão Sequência usa `preocupado` depois das 20h sem nada feito.

## Testing Decisions

- **Lógica pura:**
  - todo `Momento` tem humor;
  - todo humor tem rosto completo;
  - a piscada com semente fixa dá a sequência esperada.
- **Componentes:**
  - `TelaDeEstado` renderiza o rótulo do sapo com o humor do momento;
  - a ação principal vem antes das secundárias;
  - com movimento reduzido não há animação.
- **Telas:**
  - a welcome sem sinal mostra "Sapo, sem sinal";
  - a conquista mostra "Sapo, comemorando".
- **Prior art:** testes de `mascot/` e `features/welcome`.

## Out of Scope

- Fala com boca sincronizada (visemes) e voz.
- Sapo interativo por toque (cutucar e ele reage) fica para depois.
- Rive.
