# Spec 27: Página de Metas com ritmo e baú

Status: a fazer. Fonte visual: aba Metas e cartão Metas do trilho em `apps/web/public/rascunhos/desktop.html`. Depende da spec 21. Dados da spec 16.

## Problem Statement

A aba Metas atual (spec 11) lista metas e marcos, sem ícone, ritmo, baú nem hábitos atrelados. A API já tem tudo isso.

## Solution

Refazer `/metas` no layout do rascunho: lista em andamento e concluídas à esquerda, detalhe à direita com cabeçalho, progresso com linha de ritmo e baú, marcos e hábitos atrelados.

## User Stories

1. Como pessoa, quero ver minhas metas em andamento e concluídas em grupos separados.
2. Como pessoa, quero ver em cada meta o ícone, o título, a barra com a contagem de marcos e o baú.
3. Como pessoa, quero clicar numa meta e ver o detalhe ao lado.
4. Como pessoa, quero ver o porquê da meta entre aspas, a data alvo, o selo No ritmo ou Um pouco atrás, e quantas joias tem no baú.
5. Como pessoa, quero ver na barra grande uma linha de onde eu deveria estar hoje.
6. Como pessoa, quero ver foco na meta, hábitos feitos e dias restantes.
7. Como pessoa, quero riscar marcos, ver o próximo destacado e adicionar marcos.
8. Como pessoa, quero ver os hábitos atrelados com os pontinhos da semana e o foguinho de cada um.
9. Como pessoa, quero atrelar um hábito pela própria meta, escolhendo numa lista dos hábitos sem meta, ou criar um hábito para ela.
10. Como pessoa, quero abrir o baú quando a meta for concluída e ver as joias entrando.
11. Como pessoa, quero criar uma meta nova pelo botão do topo, escolhendo ícone e cor.

## Implementation Decisions

- **Dados**: `goals` e `goalChests` do sync; ritmo e números pela função de domínio da spec 16, nunca recalculados de outro jeito na tela.
- **Baú**: fechado em andamento, pronto para abrir quando concluída e ainda não aberto, aberto depois. Abrir chama `POST /api/goals/:id/chest` e anima as joias para a barra do topo.
- **Atrelar hábito**: `PUT /api/habits/:id` com `goalId`; a lista só mostra hábitos sem meta.
- **Limite**: respeitar `limite_de_metas` ao criar.
- **Trilho**: o cartão Metas do trilho (spec 21) usa os mesmos componentes de item.

## Testing Decisions

- Lógica pura: posição da linha de ritmo na barra, texto do selo, ordem das listas.
- Componentes: abrir baú chama a rota uma vez e atualiza o saldo; atrelar hábito some da lista de opções. Prior art: `features/metas/metas.test.ts`.

## Out of Scope

- Metas compartilhadas e metas dentro de metas.
