# Spec 30: Web com gelo, descanso e métricas no Perfil

Status: feito. Origem: conversa com o Victor de 25/11/2026. Frontend em `apps/web`. Depende das specs 22 (Hoje), 28 (Perfil) e 29 (backend).

## Problem Statement

As telas novas (specs 21 a 28) não têm botão de descanso, não conhecem o gelo e o Perfil só mostra 4 números. A spec 29 entrega o gelo, a regra do descanso e as métricas; falta mostrar e permitir agir.

## Solution

- **Hoje:** o cartão Sequência ganha o botão Descansar hoje e o dia de gelo na barra da semana. Também entra um cartão novo, "Seu mês", com 3 números e um link para as métricas do Perfil.
- **Trilho:** o contador de gelos aparece ao lado do foguinho.
- **Perfil:** ganha a seção Métricas com descanso, gelo, ritmo e o que foi concluído.
- **Loja:** o gelo entra na loja, comprado com joias.

O rascunho `apps/web/public/rascunhos/desktop.html` é a fonte visual. Antes de implementar, desenho estas peças nele e o Victor aprova (regra do projeto: rascunho primeiro).

## User Stories

1. Como pessoa, quero um botão Descansar hoje no cartão Sequência, para marcar a pausa sem sair do Hoje.
2. Como pessoa, quero ver quantos descansos ainda posso marcar nesta semana, perto do botão.
3. Como pessoa, quero desmarcar o descanso de hoje, caso tenha marcado por engano.
4. Como pessoa, quero ver na barra da semana o dia salvo pelo gelo em azul com um floco, diferente do descanso (lua) e do feito (fogo).
5. Como pessoa, quero ver no trilho, ao lado dos dias seguidos, quantos gelos tenho, como 1 de 2.
6. Como pessoa, quero um aviso com o sapo quando abro o app depois de um gelo gasto, dizendo que o gelo segurou meu foguinho ontem.
7. Como pessoa, quero comprar gelo na loja com joias, vendo o preço, quantos tenho e o máximo.
8. Como pessoa no máximo de gelos, quero ver o botão de compra desligado com o motivo.
9. Como pessoa, quero um cartão "Seu mês" no Hoje com dias de cuidado, descansos e gelos usados no mês, e um link Ver métricas que abre o Perfil já na seção Métricas.
10. Como pessoa, quero ver no Perfil o descanso: total, no mês e a comparação de foco nas semanas com e sem descanso.
11. Como pessoa com pouca história, quero ver um texto explicando que a comparação aparece depois de algumas semanas, em vez de números vazios.
12. Como pessoa, quero ver meu ritmo: foco médio por dia, taxa de hábitos em 30 dias, melhor período, melhor dia da semana e sessões terminadas.
13. Como pessoa, quero ver o que concluí: tarefas, metas e joias ganhas.
14. Como pessoa, quero ver os erros da API em palavras, como "Você já usou os 2 descansos desta semana".
15. Como pessoa no celular, quero tudo isso em uma coluna, sem rolagem lateral.

## Implementation Decisions

- **Dados:**
  - `gelo` e `descanso` vêm do `/api/sync` (spec 29);
  - as métricas vêm de `GET /api/profile/metrics`, carregadas ao abrir o Perfil ou o cartão "Seu mês", com cache curto;
  - no modo demo, tudo sai das funções puras do core.
- **Escritas** pelo `RemoteRepository`, com escrita otimista:
  - descansar: `PUT` e `DELETE /api/rest-days/:date`;
  - comprar gelo: `POST /api/gelo`;
  - marcar o aviso como visto: `PUT /api/gelo/visto`.

  Se a API recusar, desfaz e mostra a mensagem.
- **Mensagens de erro** num mapa único de código para texto em `features/casca`: `descanso_so_hoje`, `limite_de_descanso`, `joias_insuficientes` e `gelo_no_maximo`.
- **Cores:** gelo usa o token `agua` e descanso o token `descanso` (`ACCENT_COLORS`), nos dois temas. Nada de cor solta.
- **Cartão "Seu mês"** fica na coluna do Hoje abaixo de Esta semana. No celular ele vem depois de Hábitos de hoje. O link vai para `/perfil#metricas` com rolagem suave e foco na seção.
- **Seção Métricas** fica no Perfil, entre Conquistas e Rotina:
  - 3 grupos (Descanso e gelo, Ritmo, Concluído) em cartões com o título fora, como as outras seções;
  - a comparação de descanso usa duas barras horizontais simples, sem biblioteca de gráfico.
- **Aviso do gelo:** é um balão do sapo, uma vez por dia gasto, que some sozinho ou ao tocar.
- **Loja:** o gelo entra como primeiro item da loja do quarto e aparece também no clique do contador do trilho. O preço vem de `GELO.preco` do core.
- **Acessibilidade:**
  - os estados da barra da semana têm texto para leitor de tela ("sábado, protegido por gelo");
  - o botão de compra desligado tem `aria-disabled` e o motivo.

## Testing Decisions

- **Lógica pura:**
  - texto de quantos descansos restam;
  - texto do aviso do gelo para 1 e 2 dias;
  - formato das métricas (minutos em horas, porcentagem);
  - escolha do texto de pouca história.
- **Componentes:**
  - Descansar hoje chama a rota e muda o dia na barra;
  - limite da semana mostra a mensagem e desfaz;
  - comprar gelo desconta joias e sobe o contador;
  - gelo no máximo deixa o botão desligado;
  - o aviso aparece uma vez e chama `visto`;
  - o link do cartão abre o Perfil na seção Métricas.
- **Prior art:** testes de `features/hoje` e `features/perfil`.

## Out of Scope

- Gráficos históricos longos (meses e anos).
- Compartilhar métricas.
- Animação nova do sapo para o gelo (usa a comemoração que já existe).
