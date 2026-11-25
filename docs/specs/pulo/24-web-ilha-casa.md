# Spec 24: Ilha com a casa em partes

Status: a fazer. Fonte visual: aba Ilha de `apps/web/public/rascunhos/desktop.html`. Depende das specs 21 e 23 (câmera e nuvens). Dados da spec 18.

## Problem Statement

A Ilha atual é um mapa de cinco áreas com enfeites e moscas. A direção nova é uma ilha só, onde a pessoa constrói a casa do sapo por partes com joias. A API já tem `GET /api/house` e `PUT /api/house/:item`; falta a tela.

## Solution

Uma tela de imersão `/ilha` com a ilha isométrica em SVG, a casa com as partes compradas sólidas e as que faltam apagadas e tracejadas, barra de joias no topo, contador de partes e as partes à venda embaixo.

## User Stories

1. Como pessoa, quero ver minha ilha com grama, terra e a casa do sapo, para ver o que construí.
2. Como pessoa, quero ver as partes que ainda não tenho como uma prévia apagada e tracejada, para saber o que posso construir.
3. Como pessoa, quero ver o quarto pronto desde o começo, com porta, janelas e caminho de pedras.
4. Como pessoa, quero ver 1 de 6 partes da casa no topo, para saber quanto falta.
5. Como pessoa, quero ver meu saldo de joias no topo, na barra branca com ícone grande.
6. Como pessoa, quero ver embaixo as partes (Quarto, Cozinha, Varanda, Jardim, Árvore, Cerca) com emoji e preço, e as minhas com um visto.
7. Como pessoa, quero comprar uma parte com um toque e ver ela cair do alto e ficar sólida.
8. Como pessoa sem joias, quero ver a parte cara apagada.
9. Como pessoa, quero aproximar, afastar e arrastar a ilha como no quarto.
10. Como pessoa, quero nuvens passando ao fundo.
11. Como pessoa, quero um botão de canto para Entrar em casa, que leva para a Casa.

## Implementation Decisions

- **Arte**: a ilha e as partes são portadas do rascunho como componentes SVG (projeção isométrica com caixas, telhados de duas águas, janelas, porta, jardim, árvore e cerca). Uma função pura gera os polígonos a partir das coordenadas, como o gerador do rascunho.
- **Estado**: partes compradas vêm de `GET /api/house` (e do sync); o catálogo e os preços vêm de `HOUSE` no core, nunca de números na tela.
- **Compra**: `PUT /api/house/:item` com o preço do catálogo; a resposta pode trazer `newAchievements` (spec 14), que dispara a comemoração do sapo.
- **Miniatura do trilho** (spec 21) usa o mesmo componente da ilha em escala menor e sem interação.
- **Câmera e nuvens**: as mesmas da spec 23.

## Testing Decisions

- Lógica pura: geração dos polígonos (pontos esperados para uma caixa simples), contagem de partes, próxima parte mais barata.
- Componentes: comprar parte desconta o saldo e muda o contador; parte sem saldo não chama o repositório; a resposta de erro `joias_insuficientes` mostra a mensagem.

## Out of Scope

- Outras ilhas (só depois da casa completa).
- A loja da ilha antiga: some da interface. A API ainda aceita a compra antiga, decisão aberta para bloquear.
