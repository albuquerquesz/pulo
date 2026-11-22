# Spec 02: tema e design system

Status (21/11/2026): A rever.

Origem: `design-system-conceito.md`, seção 3, e `prancha-de-estilo.html`. Formato `/to-spec`, sem entrevista. Independente da spec 01: pode andar em paralelo. As specs 03, 05, 06, 07 e 09 consomem o que esta define.

## Problem Statement

O app precisa parecer um produto único em todas as telas, claro e escuro, com movimento que respeite quem pede menos animação. Sem tokens e componentes base centralizados, cada tela escolhe sua cor e sua duração, o sapo e a lagoa destoam do resto, e o contraste fica ao acaso. O conceito já mostra um caso real: branco sobre o coral de foco tem contraste 2,57 e falha, e só dá para evitar isso com regra escrita e testada.

## Solution

Dois módulos:
1. `theme`: tokens (cores claro e escuro, tipografia, espaçamento, raios, movimento) e um hook `useTheme()`.
2. `ui`: componentes base, todos lendo os tokens, com os estados listados abaixo.
Mais uma **galeria interna** (rota só de desenvolvimento) que mostra todos os componentes em todos os estados, claro e escuro.

## User Stories

1. Como pessoa usuária, quero que o app siga o tema claro ou escuro do aparelho e que eu possa trocar no Perfil.
2. Como pessoa usuária, quero ler todos os textos sem esforço, em qualquer fundo do app.
3. Como pessoa usuária que reduz movimento, quero que loops e pulos desapareçam e as trocas virem desvanecimentos curtos.
4. Como pessoa usuária, quero botões e áreas de toque fáceis de acertar.
5. Como pessoa usuária, quero que os botões "afundem" ao tocar, para sentir resposta.
6. Como desenvolvedor, quero um único lugar para mudar uma cor ou uma duração.
7. Como desenvolvedor, quero um teste que falhe se alguém combinar texto e fundo com contraste baixo.
8. Como desenvolvedor, quero ver todos os componentes numa tela de galeria para revisar o visual de uma vez.
9. Como as specs 03 a 09, quero consumir tokens e componentes sem redefinir nada.

## Implementation Decisions

**Tokens de cor** (valores do conceito; decisão do Victor sobre a paleta final ainda aberta):
- Claro "Dia na lagoa": bg `#F7F3E3`, surface `#FFFFFF`, line `#E4E0CC`, ink `#1F2A24`, muted `#5E6B62`, sapo `#8FE05A` (borda `#6CC23F`), agua `#3FC9A2` (borda `#2EA888`), foco `#FF7A59` (borda `#D9583A`), descanso `#6C63B5` (borda `#54499A`), sol `#FFD166`, atencao `#FFB020`.
- Escuro "Noite na lagoa": bg `#14201A`, surface `#1D2E25`, line `#2A3F33`, ink `#EAFFF0`, muted `#9DB3A5`; as cores de ação mantêm o valor.
- **Regra de texto:** texto sobre sapo, agua, foco, sol e atencao é sempre `ink` (escuro). Branco só sobre `descanso`. Contrastes calculados no conceito: ink sobre sapo 9,17; sobre foco 5,78; sobre agua 7,13; sobre sol 10,29; muted sobre surface 5,59; branco sobre foco 2,57 (proibido).

**Tipografia:** família arredondada. A sugestão é **Nunito**, carregada com `useFonts` do `expo-font`, que a documentação do Expo lista como suportado em Android, iOS e web, mantendo a tela de abertura até a fonte carregar. O pacote de Google Fonts segue o padrão `@expo-google-fonts/<família>`; o nome exato do pacote de Nunito e a licença atual **a confirmar**. Escala: display 32/36 (800), título 24/28 (800), subtítulo 18/24 (700), corpo 16/22 (600), legenda 13/18 (600). Números do timer em tabular. No web, vários pesos da mesma família entram numa única chamada de `useFonts`.

**Espaço e forma:** espaço 4, 8, 12, 16, 24, 32, 48; raios 12, 20, 28 e pílula. **Sem sombras**: profundidade por borda inferior de 4 px na cor escura do próprio elemento.

**Movimento (constantes):** instant 90 ms, quick 160 ms, base 240 ms, slow 420 ms, ambient de 3 a 6 s; mola amortecimento 12 e rigidez 180; squash do pouso 1,22 por 0,78 em 120 ms. A biblioteca é o **Reanimated**, que tem guia de suporte à web. Reduzir movimento usa `useReducedMotion` e `ReducedMotionConfig` do Reanimated (a documentação define `ReduceMotion.System` como seguir o aparelho). O Perfil tem um botão próprio de "reduzir movimento" que vale além do sistema. O plugin do Babel é `react-native-worklets/plugin` no Reanimated 4, segundo a documentação.

**Componentes e estados:**
| Componente | Estados |
|---|---|
| `Botao` (primário, foco, agua, fantasma) | normal, pressionado (desce 3 px), desativado, carregando |
| `Cartao` | normal, selecionado, interativo |
| `ChipEnergia` (5 níveis, SVG simples) | nenhum, selecionado |
| `AnelTimer` | parado, rodando, pausa, concluído |
| `Balao` | uma linha, duas linhas |
| `Toast` | sucesso, aviso, com ação "desfazer" |
| `EstadoVazio` | com sapo, frase e botão |
| `BarraAbas` | aba ativa e inativa |
Todos com área de toque de pelo menos 44 por 44 e rótulo de acessibilidade em PT BR.

**Estrutura:** `src/theme/` (tokens, `useTheme`, `contraste.ts`) e `src/ui/`.

## Testing Decisions

Funções puras e renderização simples. O framework de testes é decisão da spec 10.
- Função `razaoDeContraste` testada com valores conhecidos.
- Teste de tokens: para cada par texto e fundo permitido, razão maior ou igual a 4,5 (3 para texto grande), no claro e no escuro. A combinação branco sobre foco deve falhar o teste de propósito (caso negativo).
- `useTheme` devolve o tema escuro quando o sistema é escuro e respeita o override do Perfil.
- Com reduzir movimento ligado, as constantes de movimento resolvem para 0 ou fade.
- Cada componente renderiza em todos os estados sem erro.

## Out of Scope

Storybook, internacionalização (só PT BR), ilustrações (specs 03 e 04), temas além de claro e escuro, tipografia dinâmica avançada, haptics.

## Further Notes

- **Decisões abertas:** paleta final, família tipográfica, e se o escuro será só "automático".
- A galeria serve também para gravar partes do vídeo.
- Não copiei nenhuma fonte nem componente de app comercial. A borda inferior grossa é um padrão comum de estilo, aqui sem reproduzir elementos específicos de outros apps.
