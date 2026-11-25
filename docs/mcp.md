# Servidor MCP do Pulo

O Pulo tem um servidor MCP em `https://pulo-api.albqvictor.workers.dev/mcp` (Streamable HTTP, sem estado).
Uma IA conectada a ele faz o que as telas fazem, como a própria pessoa: ver o dia, marcar hábitos, mexer na rotina,
começar e controlar focos, tirar descanso, gerar e decidir a proposta da semana, cuidar das metas, das tarefas e do perfil.

## Conectar

- **claude.ai ou Claude Desktop:** Configurações, Conectores, adicionar conector personalizado com o endereço acima.
- **Claude Code:** `claude mcp add --transport http pulo https://pulo-api.albqvictor.workers.dev/mcp` e depois `/mcp` para entrar.
- **Outros clientes** (Cursor, MCP Inspector): o mesmo endereço, transporte HTTP.

O cliente abre o login: a pessoa entra com o Google na tela `/oauth/entrar` do app web e libera o acesso em `/oauth/consentimento`.
O endereço também aparece em Perfil, "Conectar uma IA".

## Ferramentas

| Ferramenta | O que faz | Tela equivalente |
| --- | --- | --- |
| `ver_hoje` | hábitos do dia, blocos, foco em andamento, descanso, sapo | Hoje |
| `ver_rotina` | todos os blocos e hábitos (arquivados à parte), com ids | Semana |
| `ver_semana` | resumo da semana e propostas | Semana |
| `ver_metas` | metas com marcos, progresso e prazo | Metas |
| `ver_tarefas` | quadro de tarefas por coluna, com filtro hoje ou semana e os pomodoros feitos; cada tarefa vem com o `id` | Tarefas |
| `ver_ilha` | saldo de joias (e de onde vieram), partes da casa e decorações do quarto | Ilha |
| `ver_perfil` | nome do sapo, dia, tema, fuso e preferências | Perfil |
| `concluir_onboarding` | cria o sapo e o plano de exemplo | Onboarding |
| `atualizar_perfil` | nome do sapo, início e fim do dia, tema, reduzir movimento | Perfil |
| `criar_habito`, `editar_habito`, `remover_habito`, `marcar_habito` | hábitos (ícone, cor, período, lembrete e estado: ativo, pausado ou arquivado; `ativo: false` pausa) e marcações | Hoje e Semana |
| `criar_bloco`, `editar_bloco`, `remover_bloco`, `criar_plano_de_exemplo` | rotina semanal (blocos com ícone) | Semana e Hoje |
| `comecar_foco`, `controlar_foco` | começar (com intenção e um hábito, meta ou tarefa), pausar, retomar, interromper, concluir | Foco |
| `dia_de_descanso`, `concluir_bloco_de_descanso` | descanso | Hoje |
| `gerar_proposta_da_semana`, `decidir_proposta` | proposta da semana | Semana |
| `criar_meta`, `editar_meta`, `mexer_em_marco`, `concluir_ou_reabrir_meta`, `apagar_meta` | metas | Metas |
| `criar_tarefa`, `mover_tarefa` | cria um cartão e leva entre colunas (pelo `id`) | Tarefas |
| `comprar_na_ilha` | constrói uma parte da casa ou compra uma decoração com joias | Ilha |
| `mover_decoracao` | muda uma decoração de lugar, sem custo | Ilha |
| `apagar_todos_os_dados` | o mesmo de Perfil, exige escrever `APAGAR TUDO` | Perfil |

## Como funciona

- **Baú e metas (spec 16):** `concluir_ou_reabrir_meta` não rende joias sozinho: o prêmio entra quando a pessoa abre o baú no app
  (não há ferramenta para isso). Editar uma meta ou um hábito pelo MCP mantém ícone, cor e a meta atrelada.
- **Mesmas regras das telas:** cada ferramenta roda o caso de uso do core (`criarHabito`, `iniciarFoco`, `criarMeta`...) sobre um
  `Repository` que chama as rotas da própria API por dentro (`apps/api/src/mcp/repositorio.ts`, `app.fetch` sem rede).
  Validação, limites (5 hábitos por dia, 3 metas ativas), transações e o cálculo do sapo são os mesmos do app.
- **Quem é a pessoa:** o `/mcp` aceita só access tokens JWT do nosso servidor OAuth com `aud` igual ao recurso `/mcp`,
  `typ` `at+jwt` e `azp` (`verifyBearerToken`, chaves do próprio Better Auth). O `sub` vira a pessoa das chamadas internas
  (`usuarioInterno` em `requireSession`, que só existe no segundo argumento de `app.fetch` e nenhuma requisição de fora preenche).
- **Desconectar:** além da assinatura, o `/mcp` exige que o consentimento daquela pessoa para o cliente (`azp`) ainda exista.
  Desconectar no Perfil (`DELETE /api/mcp/connections/:clientId`) ou excluir a conta corta o acesso na hora.
- **Preferências:** `comecar_foco` sem `minutos` usa a duração escolhida no perfil. Exportar, desconectar e excluir a conta não são ferramentas.
- **Servidor de autorização:** Better Auth com os plugins `jwt` e `@better-auth/oauth-provider` (`apps/api/src/auth.ts`).
  Registro dinâmico de clientes aberto (é o que os clientes MCP usam), PKCE obrigatório, clientes nativos inferidos pelo callback
  (`http://localhost` ou esquema próprio), web só com https. Tabelas `jwks` e `oauth_*` (migração `oauth_mcp`).
- **Descoberta:** `/.well-known/oauth-protected-resource/mcp` (RFC 9728) aponta para o emissor `.../api/auth`;
  `/.well-known/oauth-authorization-server/api/auth` (RFC 8414) e `/.well-known/openid-configuration/api/auth`.
  Sem token, o `/mcp` responde 401 com `WWW-Authenticate: Bearer resource_metadata="..."`.
- **Workers:** o SDK usa o validador `@cfworker/json-schema` (o Ajv gera código em tempo de execução, o que o Workers proíbe).

## Configuração

| Variável | Onde | Para quê |
| --- | --- | --- |
| `BETTER_AUTH_URL` | `wrangler.jsonc` | endereço público da API: emissor, recurso `/mcp` e descoberta saem dele |
| `PULO_WEB_URL` | `wrangler.jsonc` | app web com as telas de entrar e de consentimento (padrão `http://localhost:3000`) |

## Testes

`apps/api/src/mcp/mcp.test.ts` faz o caminho de um cliente MCP de verdade: descoberta, registro dinâmico, authorize com PKCE,
consentimento, troca do código pelo token e chamadas de ferramentas, conferindo que tudo cai na conta da pessoa do token e de mais ninguém.
