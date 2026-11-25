# Spec 23: Casa, foco e decoração do quarto

Status: a fazer. Fonte visual: aba Casa de `apps/web/public/rascunhos/desktop.html` (rota `#foco` no rascunho). Depende da spec 21. Dados das specs 18 e 19.

## Problem Statement

O foco atual é uma tela com timer em anel. O rascunho aprovado troca o foco por um quarto em perspectiva onde o sapo mora: a pessoa abre o timer numa caixa com mostradores, foca sem ver contagem, o sapo passeia e as joias sobem; e no modo decorar ela compra e posiciona itens do quarto num modal de loja.

## Solution

Uma tela de imersão `/casa`, sem trilho e sem título, com o quarto em SVG ocupando a área toda, câmera controlada pela pessoa, timer em modal, modo decorar com lugares marcados por +, e modal de compra com tipos e cores.

## User Stories

1. Como pessoa, quero entrar na Casa e ver o quarto do sapo grande, com nuvens passando ao fundo, para sentir que é um lugar.
2. Como pessoa, quero aproximar e afastar com a rodinha do mouse, mirando onde o mouse está, para olhar detalhes.
3. Como pessoa, quero arrastar a tela para passear pelo quarto.
4. Como pessoa no celular, quero arrastar com o dedo e aproximar com pinça.
5. Como pessoa, quero um botão de tela cheia, para focar sem distração.
6. Como pessoa, quero ver no topo meu saldo de joias e meus dias seguidos em barras brancas com ícone grande.
7. Como pessoa, quero um botão Focar em forma de placa de madeira embaixo, para começar.
8. Como pessoa, quero escolher os minutos de foco de 15 a 50, de 5 em 5, numa caixa com dois mostradores, um controle deslizante e botões menos e mais.
9. Como pessoa, quero escolher para que é o foco (um hábito, uma meta, uma tarefa ou livre) antes de começar.
10. Como pessoa, quero Voltar e Começar no modal do timer.
11. Como pessoa focando, quero que não apareça contagem regressiva, para não ficar olhando o relógio.
12. Como pessoa focando, quero ver o sapo passeando pelo quarto com pulinhos.
13. Como pessoa focando, quero ver um +1 com uma joia subindo do sapo a cada 5 minutos, e o saldo subir junto.
14. Como pessoa, quero que o foco termine sozinho no tempo escolhido, e que Parar encerre antes.
15. Como pessoa, quero botões de canto só com ícone: Loja, Sair de casa e Decorar.
16. Como pessoa, quero que Sair de casa me leve para a Ilha.
17. Como pessoa, quero entrar no modo decorar e ver lugares com + pulsando nas paredes, no chão e no centro para o tapete, com a dica Toque num + para decorar o quarto do Pulo.
18. Como pessoa, quero que a placa vire Pronto no modo decorar, para sair dele.
19. Como pessoa, quero tocar num + e abrir um modal de loja com moldura de madeira, com prévia grande do item no topo.
20. Como pessoa, quero escolher o tipo de item que cabe naquele lugar (parede: quadro, relógio, prateleira, bandeirinhas, planta pendurada, janela; chão: planta, cadeira, cama, sofá, luminária, baú, pelúcia, violão; tapete: só cores).
21. Como pessoa, quero escolher entre 8 cores de cada item, com o preço em joias em cada uma, e as que já são minhas marcadas.
22. Como pessoa, quero Ver no quarto antes de comprar, com uma barra Gostou? Comprar ou Voltar.
23. Como pessoa, quero comprar com joias e ver o item aparecer no lugar; se já tenho a cor, colocar de graça.
24. Como pessoa, quero tirar um item de um lugar, e mover um item meu para outro lugar sem pagar de novo.
25. Como pessoa sem joias suficientes, quero ver o botão Comprar apagado.
26. Como pessoa, quero Cancelar o modal sem mudar nada.
27. Como pessoa, quero que o quarto venha vazio no começo e só tenha o que eu comprei.

## Implementation Decisions

- **Rota `/casa`**: tela de imersão (trilho escondido, sem título). O quarto é um componente SVG portado do rascunho: paredes, chão de tábuas, sapo de contorno grosso (olhos, bochechas, braços), sem tapete, porta, quadro ou vaso fixos.
- **Câmera**: componente reutilizado na Ilha (spec 24). Estado `{cx, cy, w}`, `viewBox` calculado pelo tamanho do contêiner, zoom pela rodinha em torno do ponteiro com limites mínimo e máximo, arrastar com pointer events e captura, pinça no toque. Zoom inicial maior em contêineres estreitos, como no rascunho.
- **Tela cheia**: Fullscreen API no contêiner do quarto.
- **Timer**: modal com a caixa verde, mostradores creme e controle deslizante; limites de `FOCUS` (`decisions.ts`). O vínculo vira o alvo da sessão (`habitId`, `goalId` ou `taskId`, spec 19). A sessão é gravada pelo `PUT /api/sessions/:id` existente; joias vêm do saldo calculado (spec 18), não do cliente.
- **Durante o foco**: o sapo anda entre pontos fixos do chão com animação CSS; o +1 aparece quando o saldo recalculado sobe. O cliente pode mostrar o +1 por estimativa a cada 5 minutos e corrigir pelo saldo do servidor ao terminar.
- **Decorar**: os lugares e seus tipos são um catálogo no core (`ROOM_DECOR` da spec 18 ganha `slots` com tipo e posição). Comprar chama `PUT /api/room/:item` com a cor; mover chama `PATCH /api/room/:item`. Verificar com a spec 18 se a cor faz parte do id do item ou é um campo; se faltar, é mudança pequena na API.
- **Cores dos itens**: no rascunho são filtros sobre emoji. No app, cada item vira um SVG próprio no traço do quarto, com as 8 cores como paleta. Até a arte existir, usar o mesmo recurso do rascunho.
- **Loja (botão de canto)**: abre o mesmo modal no modo de navegação, sem lugar escolhido.

## Testing Decisions

- Lógica pura: limites e passos do timer, conta das joias estimadas, transformação da câmera (zoom em torno do ponteiro mantém o ponto sob o mouse, limites respeitados), itens válidos por tipo de lugar, preço de item mais cor.
- Componentes: abrir timer, escolher minutos e vínculo, Começar grava a sessão no repositório; no modo decorar, comprar desconta o saldo e o item aparece no lugar; Cancelar não grava nada.
- Prior art: `features/foco/foco.test.ts` e `mascot/mascot.test.tsx`.

## Out of Scope

- Outros cômodos.
- Sons de fundo tocando (a preferência existe na spec 15; o áudio vem depois).
- Arte final dos itens.
