# Spec 05: rotina, hábitos e blocos do dia

Status (21/11/2026): A rever.

Origem: `design-system-conceito.md`, seção 7 (F3). Formato `/to-spec`, sem entrevista. Depende das specs 01 (entidades e validações) e 02 (componentes). Fornece os dados que a spec 08 lê e a operação `moverBloco` que a IA usa.

## Problem Statement

Sem uma rotina cadastrada não há o que o sapo cuidar nem o que a IA ajustar. Os concorrentes que vimos pesam a pessoa com muita configuração (categorias, recorrências, listas longas). Aqui a rotina precisa ser **curta e rápida de montar**, e cada ação deve ter resposta imediata do sapo. Também precisa haver uma operação segura para **mover um bloco**, porque a IA vai propor isso e a pessoa precisa poder desfazer.

## Solution

Casos de uso e telas para:
- cadastrar, editar e remover **blocos** de rotina (foco ou descanso) por dia da semana;
- listar e marcar **hábitos** do dia (até 5);
- registrar um **dia de descanso** com um botão;
- **mover** e **encurtar** um bloco, com desfazer;
- gerar um **plano inicial de exemplo** no onboarding.
Marcar um hábito ou concluir um bloco dispara uma reação curta do sapo.

## User Stories

1. Como pessoa usuária, quero criar um bloco de foco escolhendo dia, horário e duração.
2. Como pessoa usuária, quero criar um bloco de descanso, para o descanso fazer parte do meu plano.
3. Como pessoa usuária, quero editar ou remover um bloco.
4. Como pessoa usuária, quero ver os blocos do dia em ordem de horário.
5. Como pessoa usuária, quero marcar um hábito como feito com um toque e ver o sapo reagir.
6. Como pessoa usuária, quero registrar "hoje foi dia de descanso" com um botão, sem justificar.
7. Como pessoa usuária, quero que o app me avise com calma se dois blocos se sobrepõem.
8. Como pessoa usuária, quero desfazer uma mudança de bloco por alguns segundos.
9. Como pessoa usuária nova, quero começar com um plano de exemplo que eu possa mudar.
10. Como a spec 08, quero uma operação `moverBloco` e `encurtarBloco` atômicas, com desfazer.
11. Como desenvolvedor, quero que toda regra de validação venha da spec 01.

## Implementation Decisions

**Casos de uso** (funções que usam o `Repository` da spec 01):
`criarBloco`, `editarBloco`, `removerBloco`, `moverBloco(id, novoDia, novoInicio)`, `encurtarBloco(id, novaDuracao)`, `criarHabito`, `marcarHabito(id, data)`, `desmarcarHabito`, `registrarDescanso(data)`.
- `moverBloco` e `encurtarBloco` devolvem o bloco anterior para permitir **desfazer** (janela de cerca de 10 segundos, com `Toast` da spec 02).
- Marcar um bloco `descanso` como feito cria o `RestDay` da spec 01.

**Regras:**
- Duração de 5 a 120 minutos; hábitos até 5 por dia (spec 01).
- **Sobreposição:** dois blocos no mesmo horário são impedidos, com mensagem suave e sugestão do próximo horário livre. Bloco `descanso` pode coexistir com hábito.
- Recorrência **só por dia da semana** (sem regras avançadas).
- Remover um bloco não apaga sessões já feitas, só o agendamento.

**Plano inicial de exemplo (onboarding):** 3 blocos de foco de 25 minutos distribuídos pelo dia e 2 hábitos genéricos editáveis. Dados de exemplo, claramente editáveis.

**Reação do sapo:** um evento `bloco_concluido` ou `habito_marcado` entra num barramento de eventos simples consumido pela máquina da spec 03. Esta spec só emite o evento.

**Telas e componentes:** lista de blocos do dia, formulário de bloco (dia, início, duração, tipo), lista de hábitos com check, botão "Dia de descanso", usando `Cartao`, `Botao` e `Toast` da spec 02. A composição final fica na spec 09.

**Código:** `src/domain/rotina/` (casos de uso puros) e `src/features/rotina/` (telas).

## Testing Decisions

Casos de uso testados com o repositório em memória e relógio fixo. Seam: o `Repository`.
- Criar bloco válido salva; duração fora da faixa é recusada.
- Sobreposição é recusada com a sugestão do próximo horário.
- `moverBloco` muda dia e horário e devolve o estado anterior; desfazer restaura.
- Marcar o mesmo hábito duas vezes no dia mantém um único registro.
- Sexto hábito do dia é recusado.
- Marcar bloco de descanso cria `RestDay`.
- Remover bloco mantém as sessões já registradas.

## Out of Scope

Categorias e tags, recorrência avançada, lembretes e notificações, compartilhar rotina, importar de calendário, metas numéricas por hábito, sequências visíveis (streaks).

## Further Notes

- Sem contador de "sequência perdida": a regra de produto é não punir, e a lagoa já mostra a constância.
- O `desfazer` é o que torna segura a aprovação da IA na spec 08.
- Esforço estimado pequeno, porque quase tudo é formulário e lista.
