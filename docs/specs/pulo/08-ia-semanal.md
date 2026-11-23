# Spec 08: IA semanal

Status (21/11/2026): A rever.

Origem: `design-system-conceito.md`, seções 7 (F5) e 8, e `benchmark-app-habitos.md`. Formato `/to-spec`, sem entrevista. Depende das specs 01 (resumo da semana), 05 (mover e encurtar bloco) e 06 (sessões). É o diferencial do produto e o que sustenta o critério de impacto.

## Problem Statement

No benchmark não achei nenhum app de hábito que **replaneje a semana com aprovação da pessoa**. O mais próximo, o Habit AI, faz resumos e sugestões no aparelho, sem replanejamento descrito. Aqui a IA precisa fazer algo concreto e seguro: ler a semana, achar um padrão e propor um ajuste na rotina que a pessoa aceita, edita ou nega. Os riscos são três: a IA inventar um horário que não existe ou conflita; falar de saúde de forma clínica (o regulamento proíbe diagnóstico e o app é de bem estar); e o demo falhar na hora do vídeo por causa de rede ou provedor.

## Solution

Um pipeline em quatro passos, em que **a IA nunca decide sozinha o que mudar**:
1. **Resumo** da semana (spec 01), agregado, sem nomes nem texto livre.
2. **Candidatas por regra:** um analisador determinístico gera até 3 mudanças já válidas (mover ou encurtar um bloco).
3. **IA opcional:** recebe o resumo e as candidatas, **escolhe uma** e redige o padrão e o motivo em tom leve. Não inventa horários.
4. **Validação e aprovação:** a resposta é validada por schema e por uma lista de termos proibidos; a pessoa aceita, edita ou nega. Se a IA falhar, vale a **proposta por regra**, com rótulo honesto.

## User Stories

1. Como pessoa usuária, quero ver o que a IA notou na minha semana em uma frase simples.
2. Como pessoa usuária, quero ver o "antes e depois" da mudança proposta.
3. Como pessoa usuária, quero aceitar, editar o horário ou negar a proposta.
4. Como pessoa usuária, quero que nada mude na minha rotina sem eu aprovar.
5. Como pessoa usuária, quero desfazer uma mudança aceita por alguns segundos.
6. Como pessoa usuária, quero que uma proposta negada não volte nas próximas duas semanas.
7. Como pessoa usuária com poucos dados, quero ouvir "ainda estou conhecendo sua semana", sem cobrança.
8. Como pessoa usuária, quero que o app diga com clareza quando a sugestão veio da IA e quando veio de uma regra simples.
9. Como pessoa usuária, quero que meus textos e nomes nunca saiam do aparelho para a IA.
10. Como pessoa usuária, quero ver o sapo pensando enquanto a análise roda e surpreso quando acha um padrão.
11. Como desenvolvedor, quero que a chave da IA nunca esteja no app.
12. Como desenvolvedor, quero que falha, demora e resposta inválida da IA caiam sempre na proposta por regra.

## Implementation Decisions

**Quando roda:** ao abrir a aba Semana quando há dados suficientes e não existe proposta pendente da semana; no domingo; e sob demanda no modo demo. Uma proposta por semana, guardada (`WeeklyProposal`, spec 01).

**Dados mínimos:** pelo menos 3 dias com registro e 5 sessões na semana. Abaixo disso, estado "conhecendo sua semana", sem proposta.

**Candidatas por regra** (limites propostos por mim; decisão do Victor):
- **Mover foco:** se um período tem taxa de focos concluídos menor que outro com horário livre, propor mover um bloco de foco do período fraco para o forte. Mínimo de 3 sessões no período para contar.
- **Encurtar foco:** se um período tem várias interrupções (mais de 2 na semana), propor encurtar o bloco em 5 ou 10 minutos.
- Máximo de **2 mudanças** por proposta. Só os tipos `mover_foco` e `encurtar_foco` na primeira versão.

**Entrada da IA:** o `WeekSummary` (agregados por período), as candidatas já validadas e o tom desejado. **Nunca** títulos de bloco, nomes, o nome do sapo nem texto livre.

**Saída esperada (schema, validado):**
```json
{
  "candidata_escolhida": 0,
  "padrao": "As tardes têm mais interrupções",
  "motivo": "Seu foco rende mais de manhã",
  "tom": "leve"
}
```
A IA devolve o **índice** da candidata e os textos. Os horários vêm das candidatas, não da IA.

**Guardas:** tamanho máximo dos textos; **lista de termos proibidos** (diagnóstico, tratamento, doença, depressão, ansiedade, medicamento e similares): se aparecer, a resposta é descartada e vale a regra; qualquer erro, timeout ou JSON inválido cai na regra.

**Rótulo honesto:** proposta de origem `ia` mostra "Sugestão da IA"; origem `regra` mostra "Sugestão". **A interface não pode afirmar IA quando não usou IA.** No vídeo e no demo, isso deve bater com o que realmente rodou.

**Aprovação:** aceitar aplica `moverBloco` ou `encurtarBloco` (spec 05) e abre "desfazer" por cerca de 10 segundos. Editar deixa a pessoa mudar o horário destino (validado pela spec 05). Negar guarda o estado e **bloqueia a mesma candidata por 2 semanas**.

**Onde roda a IA:** em uma função de servidor com a chave guardada lá. **Provedor, modelo e hospedagem são decisão aberta do Victor.** Sem backend pronto até o fim do prazo, o demo funciona só com a regra, rotulada como "Sugestão".

**Sapo:** `pensando` enquanto roda, `surpreso` ao chegar proposta (spec 03).

**Código:** `src/domain/ia/` (candidatas, validação, termos proibidos, escolha de reserva) e `src/features/semana/`; a função de servidor fica fora do app.

## Testing Decisions

Funções puras e testes de contrato com resposta da IA simulada. Seam: o cliente da IA (injetado).
- Semana com focos interrompidos à tarde e concluídos pela manhã gera candidata "mover foco da tarde para a manhã".
- Menos de 3 dias de dados resulta em "conhecendo sua semana", sem proposta.
- Candidata com horário ocupado nunca é gerada.
- Resposta da IA com índice inválido, JSON quebrado ou texto com termo proibido é descartada e vale a regra.
- Timeout da IA resulta em proposta por regra com rótulo "Sugestão".
- O corpo enviado à IA não contém títulos, nomes nem texto livre.
- Aceitar altera o bloco e desfazer restaura.
- Candidata negada não reaparece por 2 semanas.

## Out of Scope

Chat com a IA, memória de longo prazo, outros tipos de mudança (criar bloco, apagar hábito), comparação com outras pessoas, recomendações de saúde, personalização por modelo, aprendizado a partir das respostas.

## Further Notes

- **Decisões do Victor:** provedor e modelo, onde hospedar a função, limites das regras.
- **Riscos:** custo e latência da IA no vídeo (por isso a regra de reserva e uma proposta pré calculada na demo, rotulada corretamente); dependência de dados suficientes na demo (use o modo demo da spec 10).
- Privacidade: dados sintéticos na demo; com dados reais, a LGPD vale e o envio de agregados é o mínimo.
- Esforço grande, mas o miolo (regras e validação) é função pura e fácil de testar.
