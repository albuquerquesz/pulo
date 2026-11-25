# Spec 21: Casca do app web no layout do rascunho

Status: a fazer. Fonte da verdade visual: `apps/web/public/rascunhos/desktop.html` (publicado em `/rascunhos/desktop`). Toda medida, cor, texto e comportamento citado aqui vem desse arquivo; em caso de dúvida, o rascunho vence esta spec.

## Problem Statement

O app web (`apps/web`) ainda é a versão antiga: abas Hoje, Ilha, Foco, Semana, Metas e Perfil numa barra estreita, a lagoa com o sapo dormindo no centro, e tudo falando em "moscas". O rascunho aprovado tem outra casca: barra lateral com marca e perfil, conteúdo no meio e um trilho à direita com os números do dia, a casa do sapo e as metas. A API já entrega tudo que essa casca precisa (specs 13 a 20, em produção). Falta a tela.

## Solution

Reconstruir a casca do app seguindo o rascunho: três colunas no desktop, navegação nova, trilho com os números e os cartões, troca de moscas por joias em toda a interface e as peças visuais compartilhadas (joia, foguinho, nuvens, botões de contorno grosso). No celular, a mesma informação em uma coluna, como manda o AGENTS.md (mobile first).

## User Stories

1. Como pessoa, quero uma barra lateral com o logo do Pulo, para saber onde estou.
2. Como pessoa, quero navegar por Hoje, Ilha, Tarefas, Hábitos e Metas, nessa ordem, para chegar em cada área com um clique.
3. Como pessoa, quero que a aba atual fique destacada em verde, para não me perder.
4. Como pessoa, quero ver meu avatar, nome e email no rodapé da barra lateral, para confirmar a conta.
5. Como pessoa, quero abrir meu Perfil pela engrenagem do rodapé, para não ocupar espaço no menu.
6. Como pessoa, quero ver no topo do trilho meus dias seguidos, hábitos feitos hoje, minutos de foco hoje e meu saldo de joias, cada um com seu ícone, para saber como está meu dia em qualquer tela.
7. Como pessoa, quero ver no trilho uma miniatura da minha casa com quantas partes já construí e qual é a próxima, para lembrar do que estou juntando joias.
8. Como pessoa, quero um botão Focar no cartão da casa, para começar a juntar joias na hora.
9. Como pessoa, quero ver minhas metas no trilho com barra de progresso e baú fechado ou aberto, para acompanhar sem abrir a aba Metas.
10. Como pessoa, quero que as telas de imersão (Casa, Ilha, Tarefas) escondam o trilho, para ganhar espaço.
11. Como pessoa, quero que o app inteiro fale em joias, com o ícone de joia ametista, para a moeda ser uma só.
12. Como pessoa no celular, quero a navegação embaixo e o conteúdo do trilho dentro do Hoje, para usar tudo com o polegar.
13. Como pessoa, quero que o tema escuro do rascunho seja o padrão do desktop, respeitando claro, escuro e sistema do Perfil.
14. Como pessoa que reduz animações no sistema, quero nuvens, pulsos e o sapo parados, para não me incomodar.
15. Como pessoa, quero que os números do trilho mudem na hora quando faço um hábito ou ganho joias, sem recarregar.

## Implementation Decisions

- **Layout**: grade de três colunas no `md:` e acima, com sidebar de 312px, conteúdo flexível e trilho de 460px, como no rascunho. Abaixo do `md:`, uma coluna com barra de abas embaixo. O layout atual `_abas` vira este layout; as rotas continuam por arquivo em `src/routes/_abas`.
- **Rotas**: `/` Hoje, `/ilha`, `/tarefas`, `/habitos`, `/metas`, `/casa` (quarto e foco) e `/perfil`. A rota `/foco` vira redirecionamento para `/casa`; `/semana` sai do menu (o gráfico da semana mora no Hoje) e redireciona para `/`.
- **Trilho**: componente próprio com três blocos. Números do dia (sequência, hábitos, foco, joias) a partir do `/api/sync` (`streak`, `stats` e saldo). Cartão Sua casa com a miniatura da ilha (a mesma arte da spec 24 em escala menor), progresso "N de 6 partes", próxima parte mais barata e quanto falta em joias e horas de foco. Cartão Metas com até 3 metas ativas, barra e baú (spec 27).
- **Tokens**: as cores e raios do rascunho entram como variáveis do Tailwind v4 (`--sapo`, `--foco`, `--descanso`, `--agua`, `--sol`, contorno `#3B2A2F`, cores da joia `#EBDDFF`, `#B583FF`, `#7B3FE4`). `apps/web/src/theme/tokens.ts` é contrato compartilhado: pedir ao coordenador a inclusão das cores novas.
- **Peças compartilhadas** em `src/ui`: `Joia` (hexágono com recorte e contorno branco opcional), `Foguinho`, `BarraValor` (barra branca com ícone vazando e botão +, usada no topo da Casa e da Ilha), `BotaoCanto` (botão quadrado de contorno grosso), `Placa` (botão de madeira do Focar), `Nuvens` (camada de nuvens SVG com rabiscos, animadas em faixas que não se cruzam), `Modal` com moldura de madeira.
- **Joias**: toda menção a moscas na interface vira joias, incluindo textos, ícones, gráfico da semana e mensagens de erro. A API já fala `joias`.
- **Dados**: telas continuam usando `useApp().repo`; nada de escolher repositório na tela. O `RemoteRepository` já tem os métodos novos (specs 13 a 20); o modo demo precisa de dados sintéticos para tudo que o trilho mostra.
- **Branch `feat/desktop`**: tem um esboço antigo não publicado. Começar da `main` atual e reaproveitar só o que bater com o rascunho.

## Testing Decisions

- Testar comportamento visível, não estrutura: a aba certa fica ativa, o trilho some nas telas de imersão, os números do trilho refletem o repositório, e nenhum texto da interface diz "moscas".
- Lógica pura (próxima parte da casa, horas de foco que faltam, ordem das metas do trilho) em `logic.ts` com Vitest, como `features/hoje/logic.ts` e `hoje.test.ts`.
- Componentes com Testing Library, como `features/app/redirecionar.test.tsx`, usando o repositório de memória do modo demo.
- Contraste das cores novas no teste existente `theme/contraste.test.ts`.

## Out of Scope

- As telas internas (specs 22 a 28).
- Arte final desenhada por ilustrador; usar as SVGs do rascunho.
- Aplicativo nativo.

## Further Notes

- O AGENTS.md pede mobile first: desenhar a coluna única primeiro e ampliar com `md:`. O rascunho mostra só o desktop; a versão de celular segue a mesma ordem de blocos.
- Esta spec é a base das 22 a 28 e deve ser feita primeiro.
