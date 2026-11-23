# Spec 09: telas, navegação e onboarding

Status (21/11/2026): A rever.

Origem: `design-system-conceito.md`, seção 6. Formato `/to-spec`, sem entrevista. Depende das specs 02 a 08: esta spec **compõe** o que as outras produzem em telas. Por isso vem quase no fim.

## Problem Statement

Cada spec anterior entrega uma peça (sapo, lagoa, rotina, foco, check in, IA). Falta a costura: qual tela mostra o quê, como a pessoa chega lá, o que aparece quando não há dados, e como é a primeira abertura. Sem essa spec, as peças ficam soltas e o vídeo de 3 minutos mostra telas desencontradas.

## Solution

Navegação com **Expo Router** e **4 abas** (Hoje, Foco, Semana, Perfil), mais um **onboarding de um passo** na primeira abertura. Cada aba tem um papel único e estados definidos para vazio, carregando e erro.

## User Stories

1. Como pessoa usuária nova, quero escolher o nome do meu sapo e meus horários em um passo e já cair na tela Hoje.
2. Como pessoa usuária, quero ver na tela Hoje o sapo na lagoa, o plano do dia e um botão para começar o foco.
3. Como pessoa usuária, quero marcar meus hábitos com um toque, logo abaixo da lagoa.
4. Como pessoa usuária, quero ter uma aba só para o foco, com o timer e o sapo concentrado.
5. Como pessoa usuária, quero ver minha semana e a proposta da IA em uma aba própria.
6. Como pessoa usuária, quero ajustar horários, tema, reduzir movimento e apagar meus dados no Perfil.
7. Como pessoa usuária, quero ver mensagens amigáveis quando ainda não há nada para mostrar.
8. Como pessoa usuária no computador, quero o app em uma coluna estreita centralizada, não esticado.
9. Como pessoa usuária, quero a fonte carregada antes de ver a tela, sem piscar.
10. Como desenvolvedor, quero uma rota de galeria de componentes só em desenvolvimento.
11. Como a spec 10, quero um ponto único para ligar o modo demo.

## Implementation Decisions

**Estrutura de rotas:**
```
app/
  _layout.tsx              fonte, tema, redirecionamento para onboarding
  onboarding.tsx
  (tabs)/
    _layout.tsx            barra de abas
    index.tsx              Hoje
    foco.tsx
    semana.tsx
    perfil.tsx
  dev/galeria.tsx          só em desenvolvimento
```

**Carregamento:** o layout raiz mantém a tela de abertura até a fonte carregar (padrão da documentação do Expo com `expo-splash-screen` e `useFonts`).

**Primeira abertura:** se não há `User`, vai para `onboarding`. Um passo: nome do sapo, início e fim do dia (padrão 7h e 22h, decisão minha), botão "Começar". Cria o `User`, o plano de exemplo (spec 05) e abre a aba Hoje.

**Hoje:** `Lagoa` com o `Sapo` (specs 04 e 03), `Balao` com uma frase curta, hábitos do dia em grade de 2 colunas com uma linha de progresso (hábitos feitos, dias de cuidado e quanto falta para a próxima fase), o próximo bloco com "Focar" ou, sem blocos pendentes, "Começar um foco livre" (specs 05 e 06), e "Tirar o dia de descanso" no fim. Estados: **vazio** (sem blocos: sapo e "Vamos montar seu dia?" com botão), **carregando** (lagoa em esqueleto simples), **erro** ("A lagoa ficou sem sinal. Seus dados estão salvos aqui.").

**Foco:** `AnelTimer`, `Sapo` focado, pausar e encerrar (spec 06). Com sessão em andamento, a aba abre direto nela.

**Semana:** resumo da semana com uma `Lagoa` pequena, cartão de proposta com antes e depois (spec 08), estado "ainda estou conhecendo sua semana".

**Perfil:** horários do dia, tema claro ou escuro, **reduzir movimento**, **apagar todos os meus dados** (única ação que zera o progresso, spec 01) e, em modo demo, o painel da spec 10.

**Layout na web:** coluna de largura máxima de 480 px centralizada, com o fundo do tema ao redor (decisão minha).

**Acessibilidade:** ordem de foco lógica, rótulos em PT BR, áreas de toque de 44 px, anúncio discreto de mudanças do sapo.

**Textos:** microcopy do conceito (seção 2), tom leve, sem culpa.

**Código:** `app/` (rotas) e `src/features/*` (conteúdo de cada tela).

## Testing Decisions

Testes de navegação e de estado com o repositório em memória. O framework é decisão da spec 10.
- Sem `User`, a primeira rota é o onboarding; com `User`, é a aba Hoje.
- Concluir o onboarding cria o plano de exemplo e abre Hoje.
- Hoje sem blocos mostra o estado vazio com o botão.
- Com sessão em andamento, a aba Foco abre no timer.
- Apagar todos os dados volta ao onboarding e zera o sapo.
- Com reduzir movimento ligado, nenhuma tela registra animação em loop.
- Todas as telas têm rótulos de acessibilidade nos controles.

## Out of Scope

Login e contas, deep links, telas de tablet e de modo paisagem, internacionalização (só PT BR), animações de transição customizadas, onboarding em várias etapas.

## Further Notes

- **Decisões abertas do Victor:** horário padrão do dia, textos finais, nome do app.
- A ordem das abas e o conteúdo de Hoje seguem o conceito; ajustes finos saem da revisão visual da prancha.
- É onde o vídeo de 3 minutos é gravado: vale ensaiar o caminho "um dia" (hábitos, foco, bloco concluído, sapo cansado, IA, lagoa evoluindo) nas telas reais.
