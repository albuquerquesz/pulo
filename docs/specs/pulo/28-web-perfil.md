# Spec 28: Perfil

Status: a fazer. Fonte visual: aba Perfil de `apps/web/public/rascunhos/desktop.html` (aberta pela engrenagem do rodapé). Depende da spec 21. Dados das specs 13, 14 e 15.

## Problem Statement

O Perfil atual tem tema e poucos ajustes. O rascunho define um Perfil completo: cabeçalho com o sapo, estatísticas, conquistas, rotina, preferências e conta. A API já entrega tudo.

## Solution

Refazer `/perfil` no layout do rascunho, com títulos fora dos cartões e as seções Rotina e Preferências lado a lado com a mesma altura.

## User Stories

1. Como pessoa, quero ver meu avatar, nome, email e desde quando uso o Pulo.
2. Como pessoa, quero ver o bloco do sapo com fase e dias de cuidado.
3. Como pessoa, quero ver dias seguidos, recorde, hábitos feitos e minutos de foco.
4. Como pessoa, quero ver minhas conquistas com a data, as em progresso com quanto falta e a secreta como um ponto de interrogação.
5. Como pessoa, quero ajustar a hora em que meu dia começa, o lembrete da noite, a duração padrão do foco e ligar o modo férias.
6. Como pessoa, quero escolher o tema claro, escuro ou sistema.
7. Como pessoa, quero ligar e desligar os sons do sapo e o assistente de IA.
8. Como pessoa, quero ver se o Claude está conectado e desconectar.
9. Como pessoa, quero baixar meus dados num arquivo.
10. Como pessoa, quero sair da conta.
11. Como pessoa, quero excluir minha conta digitando EXCLUIR para confirmar.
12. Como pessoa, quero editar meu nome e foto.

## Implementation Decisions

- **Dados**: `stats`, `streak` e `achievements` do sync; preferências no `metadata` (spec 15); conexões em `GET /api/mcp/connections`.
- **Ações de conta**: `GET /api/data/export` baixa o JSON; `DELETE /api/account` com `{ confirm: 'EXCLUIR' }` e volta para `/welcome`; sair pelo `POST /api/auth/sign-out`; desconectar Claude por `DELETE /api/mcp/connections/:clientId`.
- **Foto**: só endereço `https` (regra da API).
- **Layout**: estatísticas em 4 cartões; conquistas em grade de 3; Rotina e Preferências em duas colunas de mesma altura; Conta por último. No celular, tudo em uma coluna.

## Testing Decisions

- Lógica pura: textos de progresso das conquistas, formato de "Desde setembro de 2026", horários.
- Componentes: mudar preferência grava o `metadata`; excluir conta só habilita com EXCLUIR digitado; desconectar remove o item da lista. Prior art: testes de `features/sessao`.

## Out of Scope

- Entrega do lembrete e áudio dos sons.
- Importar dados.
