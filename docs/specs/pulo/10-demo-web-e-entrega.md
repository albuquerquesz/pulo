# Spec 10: demo, web e entrega

Status (21/11/2026): A rever.

Origem: `hack-brasil-2026-regulamento.md` (digest do regulamento de 18/11/2026) e `design-system-conceito.md`, seções 9 a 11. Formato `/to-spec`, sem entrevista. Depende de todas as outras. Cobre o que fica de fora do app em si: como ele chega ao júri, com que dados, e o que precisa estar certo para a entrega valer.

## Problem Statement

O regulamento não obriga o júri a instalar nem rodar o projeto, e pede link de demo funcionando e vídeo de até 3 minutos. A nota depende de quatro critérios de mesmo peso (execução, implementação, impacto e comunicação), e uma entrega errada (repositório criado antes de 4/11, demo fora do ar, dados reais, commit durante o congelamento) pode desclassificar. Além disso, o app só mostra tudo o que tem **depois de dias de uso** (fases do sapo, itens da lagoa, proposta da IA), e o júri vai ver em minutos. Sem um modo demo, as partes mais bonitas não aparecem.

## Solution

1. **Demo na web:** exportação estática do Expo, hospedada em URL pública.
2. **Modo demo:** dados sintéticos de várias semanas e controles para avançar o relógio.
3. **Checklist de entrega** com as regras do regulamento, e um **plano de 9 dias** de trabalho.
4. **Roteiro do vídeo** de 3 minutos e como gravá-lo.

## User Stories

1. Como jurado, quero abrir um link e ver o app funcionando, sem instalar nada e sem login.
2. Como jurado, quero ver o sapo em fases avançadas e a lagoa cheia sem esperar semanas.
3. Como jurado, quero ver a IA propor um ajuste e a pessoa aprovar.
4. Como jurado, quero um vídeo de até 3 minutos, em português, sem login, que mostre o produto funcionando.
5. Como jurado, quero ler um repositório legível e executável, com instruções de como rodar.
6. Como Victor, quero ter certeza de que o repositório respeita as regras (criado depois de 4/11 às 21h, sem fork, sem código privado anterior).
7. Como Victor, quero submeter com folga antes de 30/11 às 23h59.
8. Como Victor, quero que nenhum dado real de pessoas apareça no demo.
9. Como Victor, quero saber o que fazer no congelamento e na final presencial.
10. Como desenvolvedor, quero testes e checagens simples que impeçam publicar algo quebrado.

## Implementation Decisions

**Exportação web:** `npx expo export --platform web` com `web.output` igual a `static` no `app.json`, que gera uma pasta de arquivos estáticos servíveis por qualquer host (documentação do Expo). **Host e domínio: decisão aberta.** O host precisa servir os arquivos estáticos e manter o demo no ar durante toda a avaliação (regulamento, item 7.3).

**Armazenamento na web:** a documentação do `expo-sqlite` confirma suporte à web, mas exige **arquivo wasm e cabeçalhos COOP e COEP** (`Cross-Origin-Embedder-Policy: credentialless` e `Cross-Origin-Opener-Policy: same-origin`) para `SharedArrayBuffer`. Isso complica hospedagem estática. **Decisão proposta:** usar um adaptador de armazenamento simples de chave e valor atrás do `Repository` da spec 01 (a biblioteca exata não foi verificada), e deixar SQLite de fora do MVP.

**Notificações:** fora do MVP. O agendamento do `expo-notifications` é suportado em Android e iOS, não na web (documentação).

**Modo demo** (ligado por um painel no Perfil ou um parâmetro de endereço):
- Carrega **4 semanas de dados sintéticos** coerentes: blocos, sessões, hábitos, descansos.
- Controles: **avançar 1 dia**, **avançar 1 semana**, **limpar**.
- **Relógio injetável** da spec 01 é o que torna isso possível.
- Mostra um selo claro "Modo demo, dados de exemplo". Não deve se passar por uso real.
- Permite ver o sapo chegar à fase 4 e a lagoa completa em poucos toques.

**IA no demo:** a chave fica só no servidor (spec 08). Se a função não estiver disponível, o demo usa a regra e o rótulo "Sugestão". O vídeo deve dizer a verdade sobre o que rodou.

**Checklist de entrega (campos obrigatórios do painel):** nome, frase de apresentação, descrição, **trilha Saúde e bem estar**, link do repositório, link da demo, link do vídeo (até 3 min, sem login, em português) e o aceite do regulamento. Prazo: **30/11/2026 às 23h59**; alvo interno **30/11 às 18h**.

**Regras do repositório:**
- Público no GitHub, **criado depois de 4/11 às 21h**, todos os commits depois disso, **sem fork e sem histórico importado**.
- **Nada de código privado anterior**, inclusive o Ascend. Código aberto já público (por exemplo, o Kubo, MIT) pode entrar como dependência ou ser copiado **sem histórico**, em um commit que diga a origem.
- Licença que **não impeça** ler, executar e testar (recomendação: MIT, decisão do Victor). README com como rodar e como ativar o modo demo.
- Nenhum segredo ou chave no repositório.
- Fica público e acessível **até 15/12**.

**Congelamento:** de 30/11 às 23h59 até a final, **sem commits**. A demo precisa continuar no ar. Slides, roteiro e ensaios podem ser preparados. Finalistas saem em 2/12 e confirmam presença até 4/12; a final é presencial em São Paulo em 12/12, com todos os integrantes presentes e viagem por conta própria.

**Testes:** framework a confirmar (o padrão do ecossistema Expo é o Jest com preset do Expo; não verifiquei a versão atual). O domínio (spec 01) e as máquinas (specs 03, 06, 08) são funções puras e ganham testes primeiro.

**Plano de 9 dias** (estimativa minha, não medida; hoje é 21/11):
| Data | Foco |
|---|---|
| 21 e 22/11 | Decidir o sapo, o nome e o público. Criar o repositório e o esqueleto do Expo. Spec 01 em código, spec 02 |
| 23 e 24/11 | Sapo (03) e lagoa (04): peças, estados, cenário |
| 25/11 | Rotina (05) |
| 26/11 | Foco (06) |
| 27/11 | IA semanal (08) e a função de servidor |
| 28/11 | Telas e onboarding (09), integração |
| 29/11 | Modo demo, polimento, publicar a demo, gravar o vídeo |
| 30/11 | Revisão final, submissão antes das 18h, congelar |

**Roteiro do vídeo (3 min):** 0:00 problema e público; 0:20 sapo e lagoa; 0:40 um dia (hábitos, foco, bloco concluído); 1:20 sapo cansado, descanso conta; 1:50 a IA lê a semana, o sapo surpreso, aprovação; 2:30 a lagoa evoluiu; 2:50 fechamento e onde achar a demo. Gravar a tela do demo web, narrar em português, hospedar em um link sem login.

## Testing Decisions

Checagens automáticas e manuais. Seam: a pasta exportada e o repositório.
- A exportação web roda sem erro e a pasta gerada abre localmente.
- O modo demo leva o sapo à fase 4 com o relógio avançado em 15 dias.
- Nenhum arquivo do repositório contém chave ou segredo.
- A data do primeiro commit é posterior a 4/11 às 21h (`git log`).
- O repositório não é um fork e não tem histórico anterior.
- O vídeo tem até 3 minutos e abre sem login.
- O demo carrega com os dados sintéticos e sem nenhum dado pessoal real.
- A demo continua no ar depois do congelamento.

## Out of Scope

Publicar nas lojas, builds nativos com EAS, analytics, SEO, domínio personalizado, monetização, notificações.

## Further Notes

- **Não verificado:** compatibilidade de todas as bibliotecas escolhidas na web, Safari e navegadores móveis, escolha de host, framework de testes e versão do Expo.
- **Riscos:** volume de arte e animação, IA falhando no vídeo, demo fora do ar, e o enquadramento em Saúde (o júri pode reenquadrar; por isso o público e o problema precisam estar claros em uma frase).
- Se faltar tempo, corte de baixo para cima: itens da lagoa, fases da lagoa, estados das fases 1 e 2 do sapo. O sapo com estados e a ação da IA ficam.
- Vale perguntar à organização (oi@hackbrasil.com) se um app de rotina e foco com esse recorte entra em Saúde e bem estar; eu posso redigir o e-mail, sem enviar.
