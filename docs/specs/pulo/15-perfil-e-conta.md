# Spec 15: Perfil, preferências e conta

Status: a fazer. Origem: rascunho, aba Perfil (aberta pela engrenagem do rodapé da barra lateral). Algumas peças já existem; esta spec cobre só o que falta.

## Problem Statement

O Perfil do rascunho tem estatísticas de todo o tempo, uma seção Rotina, uma seção Preferências e uma seção Conta. A API hoje guarda `theme`, `reduceMotion`, `timezone` e `profile.dayStartMinutes` no `metadata` do usuário, e apaga dados com `DELETE /api/data`, mas:

- não há rota de estatísticas agregadas (hábitos feitos, minutos de foco, desde quando);
- a duração do foco é global (`FOCUS` no `decisions.ts`), não por pessoa;
- não existem as preferências de lembrete da noite, modo férias, sons do sapo, assistente de IA ligado e meta diária de foco;
- não dá para baixar os próprios dados;
- `DELETE /api/data` mantém a conta e o `metadata`, então "Excluir conta" não exclui a conta;
- o Perfil quer mostrar se o Claude está conectado, mas nenhuma rota diz isso;
- nome e foto não são editáveis pelo app.

## Solution

O Perfil passa a ser alimentado por três coisas: um resumo de estatísticas no sync, um `metadata` com as preferências novas e três ações de conta (baixar dados, desconectar o Claude, excluir conta).

## User Stories

1. Como pessoa, quero ver quantos hábitos já fiz desde o começo, para sentir o tamanho do caminho.
2. Como pessoa, quero ver quantos minutos de foco já somei, para valorizar o tempo investido.
3. Como pessoa, quero ver desde quando uso o Pulo, para lembrar quando comecei.
4. Como pessoa, quero ver minha sequência e meu recorde no Perfil (spec 13), para tudo de mim ficar num lugar.
5. Como pessoa, quero definir a duração padrão do meu foco, para o timer já abrir no tempo que funciona para mim.
6. Como pessoa, quero definir quantos minutos de foco quero fazer por dia, para o Hoje me mostrar o quanto falta.
7. Como pessoa, quero ligar um lembrete à noite num horário meu, para não perder a sequência por esquecimento.
8. Como pessoa, quero ligar o modo férias, para a sequência não quebrar enquanto viajo.
9. Como pessoa, quero desligar os sons do sapo, para usar o app em silêncio.
10. Como pessoa, quero desligar o assistente de IA, para nada do meu uso ir para um modelo.
11. Como pessoa, quero escolher o som de fundo padrão do foco, para não escolher toda vez.
12. Como pessoa, quero mudar meu nome e minha foto, para o app falar comigo do jeito certo.
13. Como pessoa, quero baixar todos os meus dados num arquivo, para ter uma cópia e poder levar para outro lugar.
14. Como pessoa, quero ver se o Claude está conectado à minha conta e quando foi, para saber quem tem acesso.
15. Como pessoa, quero desconectar o Claude, para revogar o acesso quando quiser.
16. Como pessoa, quero excluir minha conta de vez, para meus dados e meu login sumirem.
17. Como pessoa, quero confirmar antes de excluir, para não apagar tudo sem querer.
18. Como pessoa, quero sair da conta neste aparelho, para usar um computador compartilhado com segurança.

## Implementation Decisions

- **Estatísticas**: campo `stats` no `/api/sync` com `habitosFeitos`, `minutosDeFoco`, `desde` (data de criação do usuário). Contagens com agregação no banco, número de queries fixo.
- **Preferências no `metadata`** (o schema de `user-metadata` cresce, versão continua 1 e tudo é opcional na leitura, como foi feito com `profile`):
  `focusMinutes` (dentro de `FOCUS.minMinutes` e `FOCUS.maxMinutes`), `breakMinutes`, `dailyFocusGoalMinutes`, `eveningReminder: { ligado, minutos }`, `vacation: { ligado, desde }`, `sounds: boolean`, `aiEnabled: boolean`, `ambientSound: 'silencio' | 'lagoa' | 'chuva'`.
- **Modo férias** é lido pela spec 13: dias em férias contam como descanso.
- **IA desligada**: a geração da proposta semanal (spec 08) usa só a regra, sem chamar o provedor.
- **Lembrete da noite**: esta spec só grava a preferência. A entrega (web push, email ou outro canal) é uma decisão de infraestrutura separada.
- **Exportar**: `GET /api/data/export` devolve um JSON com tudo da pessoa (usuário sem segredos, hábitos, registros, sessões, descansos, metas, tarefas, compras, conquistas). Sem tokens, sem sessões, sem contas OAuth.
- **Excluir conta**: rota nova que apaga o usuário (o banco já cascateia tudo por `onDelete: Cascade`) e encerra a sessão. Usa a exclusão de usuário do Better Auth se estiver habilitada; senão, apaga direto e invalida o cookie.
- **Claude conectado**: `GET /api/mcp/connections` lista os consentimentos OAuth da pessoa (`OauthConsent` com o nome do cliente e a data) e `DELETE` revoga consentimento e tokens daquele cliente.
- **Nome e foto**: rota de atualização do usuário pelo Better Auth (`updateUser`); confirmar que está ligada.

## Testing Decisions

- Testar pelo que a pessoa vê: depois de gravar, o sync devolve a preferência; depois de excluir, o login some e as tabelas não têm linhas dela.
- API: testes de rota no Postgres de teste, no padrão de `data.test.ts`. Excluir conta checa que outra pessoa não perde nada. Exportar checa que não sai nenhum token.
- Core: testes do schema de `metadata` lendo contas antigas sem os campos novos (prior art: `user-metadata.test.ts`).

## Out of Scope

- Canal de entrega do lembrete.
- Importar dados de outro app.
- Várias contas ou perfis por pessoa.

## Further Notes

- "Começo do dia" e "Tema" já existem e não entram aqui.
- Mudar `FOCUS` é mudar contrato compartilhado: os limites continuam no `decisions.ts`, só o valor escolhido vai para o `metadata`.
