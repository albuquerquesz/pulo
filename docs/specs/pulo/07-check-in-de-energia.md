# Spec 07: check in de energia

Status (21/11/2026): A rever.

Origem: `design-system-conceito.md`, seção 7 (F4), e `benchmark-app-habitos.md` (check ins do Finch). Formato `/to-spec`, sem entrevista. Depende das specs 01 e 02. Alimenta a spec 08 e o estado `cansado` do sapo (spec 03).

## Problem Statement

A IA só consegue propor um ajuste útil se souber **como a pessoa se sentiu** ao longo da semana, não só quanto tempo focou. O Finch mostra que check ins rápidos funcionam ("não parecem uma tarefa"), mas eles também viram obrigação se aparecem demais. E o assunto é sensível: o app é de bem estar, não clínico, e não pode perguntar nem concluir nada sobre saúde mental.

## Solution

Um check in de **energia**, de 1 a 5, em um toque. Aparece de forma suave na tela Hoje (uma vez por período do dia, ignorável) e, opcionalmente, ao fim de um foco. O valor fica ligado ao dia lógico e ao período, e alimenta a IA e o estado do sapo.

## User Stories

1. Como pessoa usuária, quero responder "como está sua energia agora?" com um toque.
2. Como pessoa usuária, quero poder ignorar a pergunta sem consequência.
3. Como pessoa usuária, quero mudar minha resposta do período se eu me enganei.
4. Como pessoa usuária, quero que o app não me pergunte de novo no mesmo período.
5. Como pessoa usuária, quero ver o sapo cansado se minha energia está baixa, sem cobrança.
6. Como leitor de tela, quero ouvir "Energia 3 de 5".
7. Como a spec 08, quero a energia média por período da semana.
8. Como a spec 03, quero saber a energia mais recente do dia.
9. Como desenvolvedor, quero que o texto da pergunta seja o mesmo em toda parte.

## Implementation Decisions

**Escala:** 1 a 5 (spec 01), rotulada de "muito baixa" a "muito alta". **Pergunta:** "Como está sua energia agora?". Nada de "humor", "ansiedade" ou termos clínicos.

**Períodos:** manhã 5h a 12h, tarde 12h a 18h, noite 18h a 23h (as mesmas faixas da spec 01).

**Frequência:** no máximo **um convite por período**; se a pessoa responder de novo no mesmo período, o último valor vale. Se ignorar, o convite não volta no período. Ao fim de um foco, a pergunta aparece **opcional**, só se ainda não houve resposta no período.

**Componente `ChipEnergia`** (spec 02): 5 rostos simples em SVG (decisão minha: SVG em vez de emojis, porque emojis variam por plataforma e o sapo precisa combinar), com rótulos de acessibilidade "Energia N de 5".

**Efeito no sapo:** energia 1 ou 2 no dia faz o sapo ficar `cansado` (spec 03). Nunca mostra mensagem de alerta.

**Dados para a IA:** só o número e o período. Sem texto livre, sem notas.

**Copy para energia baixa:** "Parece que hoje pede casco. Quer um dia mais leve?" (convite, não diagnóstico).

**Código:** `src/domain/checkin/` (casos de uso, média por período) e `src/ui/ChipEnergia` da spec 02.

## Testing Decisions

Funções puras com relógio injetado. Seam: o `Repository`.
- Responder duas vezes no mesmo período mantém só a última.
- Ignorar um período não registra nada e não repete o convite.
- A média por período considera só os check ins daquele período.
- Energia fora de 1 a 5 é recusada.
- O texto salvo nunca inclui campos livres.
- O convite ao fim do foco só aparece sem resposta no período.

## Out of Scope

Diário e notas, escala de humor, perguntas clínicas ou de sono, gráficos de humor, lembretes e notificações, exportação.

## Further Notes

- **Enquadramento:** o app mede energia e rotina, não saúde mental. Isso protege o ponto de "sem diagnóstico" do regulamento e a trilha Saúde e bem estar.
- Dados reais de pessoas não entram na demo; só dados sintéticos (regulamento, item 6.9).
- Esforço pequeno. O valor está em manter o check in leve, não em construir muito.
