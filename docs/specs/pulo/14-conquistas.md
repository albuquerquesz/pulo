# Spec 14: Conquistas

Status: a fazer. Origem: rascunho, aba Perfil, seção Conquistas. Não existe modelo, regra nem rota de conquista na API.

## Problem Statement

O Perfil do rascunho mostra seis medalhas: Primeira semana, Foco profundo, Descanso sabido, Mês de fogo (21/30), Ilha inteira (2/5) e uma secreta. Cada uma tem estado conquistada ou em progresso, e algumas mostram quanto falta. Nada disso é calculado hoje, e sem uma regra única cada tela inventaria o progresso.

## Solution

Um catálogo fixo de conquistas no core, cada uma com uma regra pura que olha os dados que o app já guarda e devolve `{ conquistada, progresso, meta, conquistadaEm }`. A data da conquista é gravada uma vez para não mudar quando a pessoa apaga um registro antigo.

Catálogo inicial (proposta minha, valores no `decisions.ts`):

| Id | Nome | Regra |
| --- | --- | --- |
| `primeira-semana` | Primeira semana | 7 dias seguidos (spec 13) |
| `foco-profundo` | Foco profundo | uma sessão de foco de 50 minutos terminada |
| `descanso-sabido` | Descanso sabido | 4 dias de descanso marcados |
| `mes-de-fogo` | Mês de fogo | 30 dias seguidos |
| `casa-inteira` | Casa inteira | todas as partes da casa construídas (spec 18) |
| `segredo` | Segredo | escondida até conquistar; regra decidida pelo Victor |

## User Stories

1. Como pessoa, quero ganhar uma medalha quando faço algo marcante, para sentir que o esforço foi notado.
2. Como pessoa, quero ver as medalhas que já tenho com a data, para lembrar quando conquistei.
3. Como pessoa, quero ver quanto falta para as próximas, como 21 de 30, para ter um alvo claro.
4. Como pessoa, quero que uma medalha conquistada nunca suma, mesmo se eu apagar um registro antigo, para não perder o que ganhei.
5. Como pessoa, quero uma medalha secreta que só aparece quando eu conquisto, para ter uma surpresa.
6. Como pessoa, quero que descansar também renda medalha, para o app não premiar só esforço.
7. Como pessoa, quero que o sapo comemore quando eu ganho uma medalha, para o momento ter peso.
8. Como pessoa, quero ver as conquistas no Perfil num lugar só, para não precisar procurar.
9. Como pessoa no modo demo, quero ver algumas medalhas de exemplo, para entender a ideia.
10. Como pessoa, quero que excluir minha conta apague minhas conquistas, para meus dados saírem junto.

## Implementation Decisions

- **Catálogo no `decisions.ts`** (contrato compartilhado, mudança pedida ao coordenador): id, nome, emoji, se é secreta e o alvo numérico.
- **Regras no core**: uma função por conquista, todas com a mesma assinatura, recebendo um resumo dos dados (contagens e sequências), nunca o banco. A spec 13 fornece a sequência.
- **Gravação mínima**: novo modelo com chave `(userId, conquista)` e `conquistadaEm`. Gravado na primeira vez que a regra passa, numa escrita que já está acontecendo (hábito, sessão, descanso, compra), nunca num job. Progresso não é gravado, é calculado.
- **Contrato**: `/api/sync` ganha `achievements: { id, conquistada, conquistadaEm?, progresso, meta }[]`. A secreta não conquistada vem sem nome.
- **Evento para o sapo**: a resposta da escrita que destravou a conquista inclui a lista das recém conquistadas, para o app disparar a comemoração.
- `DELETE /api/data` apaga as conquistas junto.

## Testing Decisions

- Testar pelo comportamento: dados de entrada viram conquistas e progresso. Não testar a ordem em que as regras rodam.
- Core: uma bateria por conquista com dados sintéticos no limite (6 dias e 7 dias, sessão de 49 e de 50 minutos).
- API: rota de hábito feito que destrava `primeira-semana` devolve a recém conquistada uma vez só; repetir o mesmo `PUT` não duplica (idempotência, como as outras rotas). Prior art: `habit-logs.test.ts`, `island.test.ts`.

## Out of Scope

- Conquistas que dependem de outras pessoas.
- Recompensa em joias por conquista (pode vir depois, ligada à spec 18).
- Notificação push.

## Further Notes

- "Ilha inteira 2/5" do rascunho virou "Casa inteira", porque a spec 18 troca as áreas da ilha pelas partes da casa.
- A regra da conquista secreta é decisão aberta do Victor.
