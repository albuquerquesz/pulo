# Sessão web: cookie, CSRF e publicação

O Pulo é só web (Expo exportado como site estático). A sessão é um cookie que a API define e o navegador guarda:
**HttpOnly**, o JavaScript do app nunca o lê e nenhum token fica em `localStorage` ou em memória do app.
O app só manda `credentials: 'include'` em cada chamada (`@pulo/client` e o cliente do Better Auth) e a API decide o resto.

## Como funciona

1. `Entrar com Google` chama `POST /api/auth/sign-in/social`; a página vai ao Google e volta para a API (`/api/auth/callback/google`).
2. A API cria a sessão no PostgreSQL e responde `Set-Cookie` (cookie assinado) com o redirecionamento de volta ao app.
3. Cada chamada do app leva o cookie. A API lê a sessão (2 queries) e só mexe nos dados da própria pessoa.
4. Sair (`POST /api/auth/sign-out`) apaga a sessão no banco e o cookie.

### Atributos do cookie (`apps/api/src/web-config.ts`)

Tudo sai de variáveis de ambiente, nada fica fixo no código:

| Atributo | Regra |
| --- | --- |
| `HttpOnly` | sempre |
| `Secure` | quando `BETTER_AUTH_URL` é `https` (produção) e sempre que `SameSite=None`; em `http://localhost` fica sem `Secure` |
| `SameSite` | `Lax` se app e API são do mesmo site; `None` se são de sites diferentes |
| `Domain` | só com `PULO_COOKIE_DOMAIN`; sem ele o cookie vale só para o host da API |
| `Path` | `/` |

"Mesmo site": sem `PULO_COOKIE_DOMAIN`, o host da API e o de todas as origens do app são iguais (a porta não conta: `localhost:8081` e `localhost:8787`
são o mesmo site, por isso o dev local funciona com `Lax`). Com `PULO_COOKIE_DOMAIN`, a API e todas as origens estão sob esse domínio
(`app.exemplo.com` e `api.exemplo.com` sob `exemplo.com`). Se o domínio não cobrir a API ou alguma origem, a API recusa subir (erro de configuração claro).
Subdomínios irmãos sem `PULO_COOKIE_DOMAIN` são tratados como sites diferentes (`None`), porque sem a lista de sufixos públicos não dá para provar o contrário.

Com `Secure` em produção, o Better Auth usa o prefixo `__Secure-` no nome do cookie.

## CSRF

- Nas rotas com cookie (`/api/*`, menos `/api/auth/*`, que o Better Auth já protege com as origens confiáveis), `PUT`, `PATCH`, `POST` e `DELETE`
  só passam se o cabeçalho `Origin` for uma das origens de `PULO_CORS_ORIGIN`:
  outra origem (inclusive `null`) responde 403 `origem_nao_permitida`; sem `Origin`, mas com cookie ou `Sec-Fetch-Site` (navegador), 403 `origem_ausente`.
  `GET` não é afetado. Código em `apps/api/src/csrf.ts`.
- Camadas extras: CORS com `credentials` e origem exata (nunca `*`), `SameSite` do cookie e corpo JSON (um formulário de outro site não consegue enviar `application/json`).
- Cliente que não é navegador (curl, testes) precisa mandar o `Origin` do app junto com o cookie.

## Como publicar

### Recomendado: domínio próprio com `app.` e `api.`

App em `https://app.exemplo.com` (Cloudflare Pages ou outro host estático) e API em `https://api.exemplo.com` (rota ou domínio personalizado do Worker).
App e API ficam no **mesmo site** (`exemplo.com`), então o cookie é `Lax`: não depende de cookie de terceiros e funciona com as proteções
de privacidade dos navegadores ligadas.

Variáveis do Worker (`vars` em `apps/api/wrangler.jsonc`, ou no painel; nada aqui é segredo):

```
BETTER_AUTH_URL=https://api.exemplo.com
PULO_CORS_ORIGIN=https://app.exemplo.com
PULO_COOKIE_DOMAIN=exemplo.com
```

Secrets (`npx wrangler secret put <NOME>`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
Build do app: `EXPO_PUBLIC_API_URL=https://api.exemplo.com`.
No Google Cloud, redirecionamento autorizado: `https://api.exemplo.com/api/auth/callback/google`.

### Funciona, com ressalva: `pages.dev` + `workers.dev`

App em `https://pulo.pages.dev` e API em `https://pulo-api.<conta>.workers.dev` são **sites diferentes**. O cookie vira `SameSite=None; Secure`
e vai em requisições entre sites, ou seja, é um cookie de terceiros do ponto de vista do navegador.
Safari (ITP) bloqueia por padrão, o Firefox em modo estrito e o Chrome com "bloquear cookies de terceiros" também, e a tendência é bloquear mais.
Nesses navegadores o login volta ao app sem sessão. Serve para uma demonstração em navegador sem bloqueio, não para produção.
Além disso, `pages.dev` e `workers.dev` estão na lista de sufixos públicos: não dá para usar `PULO_COOKIE_DOMAIN` entre eles.

```
BETTER_AUTH_URL=https://pulo-api.<conta>.workers.dev
PULO_CORS_ORIGIN=https://pulo.pages.dev
# PULO_COOKIE_DOMAIN: não definir
```

### Desenvolvimento local

Sem nada além do padrão: app em `http://localhost:8081`, API em `http://localhost:8787`, `PULO_CORS_ORIGIN` padrão `http://localhost:8081`.
Cookie `HttpOnly; SameSite=Lax` sem `Secure`.

## Variáveis (resumo)

| Variável | Onde | Para quê |
| --- | --- | --- |
| `PULO_CORS_ORIGIN` | Worker (var) | Origens do app, separadas por vírgula: CORS com credenciais, origens confiáveis do Better Auth, checagem de `Origin`. Padrão `http://localhost:8081` |
| `BETTER_AUTH_URL` | Worker (var) | Endereço público da API; `https` liga `Secure` e fixa o callback do Google |
| `PULO_COOKIE_DOMAIN` | Worker (var, opcional) | Domínio pai do cookie para `app.x` e `api.x`. Padrão: só o host da API |
| `BETTER_AUTH_SECRET`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Worker (secrets) | Veja o README |
| `EXPO_PUBLIC_API_URL` | build do app | Endereço da API |

## O que não foi testado em ambiente real

Os testes (`apps/api/src/cookies.test.ts`, `csrf.test.ts`, `web-config.test.ts`) verificam os atributos do `Set-Cookie` e a checagem de `Origin` em processo.
O login real com o Google, o comportamento de cada navegador com cookies de terceiros e um deploy com domínio próprio ainda precisam ser conferidos à mão.
