# Specs: app do sapo (nome provisório Pulo)

Origem: `design-system-conceito.md`, `benchmark-app-habitos.md` e `hack-brasil-2026-regulamento.md` (21/11/2026). Cada spec segue o formato `/to-spec` do Matt Pocock, o mesmo já usado em `docs/specs/visor-gaps/` do repositório `vault` (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes). Sem entrevista, com os fatos do que já foi decidido. O que é decisão do Victor, o que é proposta minha e o que não foi verificado está marcado em cada spec.

A skill `/to-spec` em si não está instalada neste servidor. O formato vem das specs do `vault`. O repositório do hackathon ainda não existe (precisa nascer depois de 4/11 às 21h), então não há tracker nem label `ready-for-agent`: as specs ficam em markdown e vão para `docs/specs/` quando o repositório existir.

Prazo: entrega em **30/11/2026 às 23h59**. Estimativa de esforço (minha, não medida): **S** meio dia; **M** um dia; **L** mais de um dia.

## Mapa por bloco

| Spec | Tema | Bloco | Esforço | Depende de | Status |
| --- | --- | --- | --- | --- | --- |
| [01](01-dominio-e-dados.md) | Domínio e dados: entidades, dia de cuidado, fases do sapo, resumo da semana | Fundação | M | nada | a rever |
| [02](02-tema-e-design-system.md) | Tema e design system: tokens, componentes base, escuro, reduzir movimento | Fundação | M | nada | a rever |
| [03](03-sapo.md) | Sapo: peças SVG, estados, máquina de estados, animações | Mascote e mundo | L | 01, 02 | a rever |
| [04](04-lagoa.md) | Lagoa: 4 fases, 8 itens, reação aos dados, animações do cenário | Mascote e mundo | L | 01, 02, 03 | a rever |
| [05](05-rotina-habitos-e-blocos.md) | Rotina: hábitos e blocos do dia, mover e desfazer | Rotina e foco | S | 01, 02 | a rever |
| [06](06-foco-pomodoro.md) | Foco: Pomodoro baseado em horário | Rotina e foco | M | 01, 03 | a rever |
| [07](07-check-in-de-energia.md) | Check in de energia | Rotina e foco | S | 01, 02 | cortada |
| [08](08-ia-semanal.md) | IA semanal: candidatas por regra, IA opcional, aprovação, reserva | IA | L | 01, 05, 06, 07 | a rever |
| [09](09-telas-navegacao-e-onboarding.md) | Telas, navegação e onboarding | Casca | M | 02 a 08 | a rever |
| [10](10-demo-web-e-entrega.md) | Demo, web e entrega: exportação, modo demo, regras do hackathon, plano de 9 dias | Entrega | M | todas | a rever |
| [11](11-metas.md) | Metas de longo prazo: aba Metas, marcos, limite de ativas | Rotina e foco | M | 01, 02, 09 | feita no web |

## Como as specs se ligam

```
        01 Domínio e dados ──────────────┐
        /     |      \       \           │
  02 Tema   05 Rotina  07 Check in       │
     |         |          |              │
  03 Sapo ── 06 Foco      │              │
     |         \          |              │
  04 Lagoa      └──── 08 IA semanal ─────┤
     \                    |              │
      └────────── 09 Telas e onboarding ─┘
                          |
                  10 Demo, web e entrega
```

- **01** define o que é um "dia de cuidado" e as fases do sapo. O sapo (03), a lagoa (04) e a IA (08) leem o que a 01 calcula.
- **02** é independente e pode andar em paralelo com a 01.
- **05, 06 e 07** produzem os dados que a **08** lê. A 05 também fornece `moverBloco` e `encurtarBloco`, que a 08 usa com "desfazer".
- **03 e 04** consomem fase, dias de cuidado e estado do dia.
- **09 e 10** só fecham depois de todo o resto.

## Ordem sugerida (uma por vez)
1. 01 Domínio e dados
2. 02 Tema e design system
3. 03 Sapo
4. 05 Rotina, 07 Check in, 06 Foco
5. 04 Lagoa
6. 08 IA semanal
7. 09 Telas e onboarding
8. 10 Demo, web e entrega

O sapo e a lagoa são o que mais pesa no vídeo, e o prazo é curto. Se precisar cortar, a ordem de corte está nas specs 03, 04 e 10.

## Fatos verificados na documentação oficial (21/11/2026)
- `expo-sqlite` suporta a web, mas exige arquivo wasm e cabeçalhos COOP e COEP (`credentialless` e `same-origin`). Por isso o MVP usa um adaptador simples atrás do `Repository` (specs 01 e 10).
- `scheduleNotificationAsync` do `expo-notifications` é suportado em Android e iOS, não na web. Notificações ficam fora do MVP (specs 06, 07 e 10).
- Reanimated tem guia de suporte à web, `useReducedMotion`, `ReducedMotionConfig` e `ReduceMotion.System`. O plugin do Babel é `react-native-worklets/plugin` no Reanimated 4 (specs 02 e 03).
- `useFonts` do Expo funciona na web e mantém a tela de abertura até carregar (specs 02 e 09).
- Exportação web: `npx expo export --platform web` com `web.output` igual a `static` (spec 10).
- `rive-react-native` usa runtimes nativos, sem Expo Go, e não cobre web sozinho. O Rive fica fora do MVP.

## Não verificado (valem para várias specs)
Nome do pacote e licença de Nunito no Expo; `react-native-svg` com a versão atual do Expo e na web; biblioteca de armazenamento de chave e valor na web; framework de testes; Safari e navegadores móveis; host do demo; disponibilidade do nome Pulo.

## Decisões abertas do Victor (valem para várias specs)
- O sapo final (número entre os sentados) e o nome do app.
- O público em uma frase (protege o enquadramento em Saúde e bem estar).
- Backend em nuvem, provedor de IA e host do demo.
- Limites de dias de cuidado para as fases e os itens da lagoa (a 01 e a 04 propõem valores).
- Se sessão interrompida conta como cuidado (a 01 propõe que sim, a partir da metade).
- Horários padrão do dia (a 09 propõe 7h a 22h) e a virada do dia às 4h.

## Regras do regulamento que valem para todas
Repositório novo e público criado depois de 4/11 às 21h, sem copiar código privado anterior (inclusive o Ascend). Dados sintéticos na demo. Código congelado de 30/11 às 23h59 até 12/12. Jurados não são obrigados a rodar o projeto, então demo no ar e vídeo de até 3 minutos carregam a nota.
