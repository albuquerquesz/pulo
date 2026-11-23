# Spec 06: foco (Pomodoro)

Status (21/11/2026): A rever.

Origem: `design-system-conceito.md`, seção 7 (F2), e `benchmark-app-habitos.md`. Formato `/to-spec`, sem entrevista. Depende das specs 01 (sessão de foco e dia de cuidado) e 03 (sapo focado). Produz as sessões que a spec 08 lê.

## Problem Statement

O foco com o mascote é o núcleo que o Monke e o Forest mostram que funciona. O problema técnico é que um timer feito contando segundos quebra quando o app vai para segundo plano ou a aba do navegador fica inativa, e a pessoa volta e o tempo está errado. Além disso, os concorrentes punem quem sai (a árvore morre, o modo hardcore do Monke bloqueia apps). Aqui sair não pode custar progresso.

## Solution

Um timer **baseado em horários**: a sessão guarda quando começou e quanto ficou pausada, e o tempo restante é sempre **calculado** a partir do relógio, nunca contado. A tela mostra o anel do timer, o sapo focado e os botões pausar e encerrar. Concluir registra a sessão, dispara a reação do sapo e verifica dia de cuidado e mudança de fase.

## User Stories

1. Como pessoa usuária, quero iniciar um foco de 25 minutos com um toque.
2. Como pessoa usuária, quero escolher a duração do foco e da pausa.
3. Como pessoa usuária, quero pausar e retomar sem perder o tempo.
4. Como pessoa usuária, quero que o timer esteja certo se eu fechar o app ou trocar de aba e voltar.
5. Como pessoa usuária, quero encerrar antes do fim sem culpa, e ainda assim ter meu esforço contado quando passei da metade.
6. Como pessoa usuária, quero ver o sapo focado durante a sessão e feliz ao concluir.
7. Como pessoa usuária, quero uma pausa curta sugerida depois do foco.
8. Como pessoa usuária, quero que a sessão em andamento reapareça se o app for fechado no meio.
9. Como a spec 01, quero a sessão registrada com estado e tempo efetivo.
10. Como a spec 08, quero sessões concluídas e interrompidas por período do dia.
11. Como desenvolvedor, quero testar "reabrir depois do fim" com o relógio injetado.

## Implementation Decisions

**Durações:** foco padrão 25 min (ajustável de 15 a 50) e pausa padrão 5 min (ajustável de 3 a 15). Faixas propostas por mim; decisão do Victor. Sem pausa longa na primeira versão.

**Estados do timer:** `ocioso`, `rodando`, `pausado`, `em_pausa_curta`, `concluido`, `interrompido`.

**Cálculo:** `restante = planejado * 60000 - (agora - inicio - pausadoMs)`. A interface atualiza a tela a cada segundo apenas para **desenhar**; o valor vem sempre da conta acima. Em aba inativa os temporizadores do navegador podem atrasar, por isso a conta por horário é a regra.

**Persistência da sessão em andamento:** gravada a cada mudança (iniciar, pausar, retomar). Ao reabrir:
- se `restante` ainda é maior que zero, continua `rodando` (ou `pausado`);
- se o tempo já acabou, a sessão é **concluída** com `fim = inicio + planejado + pausadoMs`, e a pessoa vê "Você concluiu enquanto estava fora" com o sapo feliz.

**Interromper:** confirmação sem culpa ("Parar por agora?"). Registra `interrompida` com o tempo efetivo. Conta como cuidado se o tempo efetivo for pelo menos a metade do planejado (regra da spec 01).

**Ao concluir:** registra a sessão, emite `bloco_concluido` (sapo `feliz`), recalcula dias de cuidado e fase (spec 01) e, se houve marco, emite `marco` (sapo `pouso`).

**Sem bloqueio de apps, sem punição, sem ranking.**

**Notificação de fim:** **fora do MVP.** A documentação do Expo marca o agendamento de notificações como suportado em Android e iOS, não na web, e o demo é na web. Em celular nativo seria um extra posterior.

**Tela:** `AnelTimer` e `Botao` da spec 02, `<Sapo estado="focado" />` da spec 03, rota na aba Foco (spec 09).

**Código:** `src/domain/foco/` (máquina e cálculo puros) e `src/features/foco/`.

## Testing Decisions

Máquina e cálculo testados com `Clock` injetado. Seam: o relógio.
- Iniciar 25 min e avançar 10 min resulta em 15 restantes.
- Pausar por 5 min e retomar mantém o restante antes da pausa.
- Reabrir com a sessão no meio devolve o tempo certo.
- Reabrir depois do fim conclui com o fim calculado, não com a hora da reabertura.
- Interromper com 12 de 25 minutos não conta; com 13 conta.
- Concluir emite o evento e atualiza o dia de cuidado.
- Sessão duplicada em andamento é impedida (só uma por vez).

## Out of Scope

Modo hardcore, bloqueio de apps, ranking e sessões em grupo, sons, widgets e Live Activity, notificações, integração com saúde do aparelho, pausa longa.

## Further Notes

- **Risco:** comportamento do navegador em aba inativa. Por isso a conta por horário, validada pelos testes de reabertura.
- O ajuste fino (por exemplo 25 em vez de 20 minutos) é decisão do Victor.
- A sessão registrada é a matéria prima do resumo semanal da IA (spec 08).
