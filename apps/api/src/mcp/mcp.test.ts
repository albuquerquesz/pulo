import { createHash, randomBytes } from 'node:crypto';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { TEST_ORIGIN, type TestUser, createHarness } from '../testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const API = 'http://localhost:8787';
const RESOURCE = `${API}/mcp`;
const REDIRECT = 'http://localhost:6274/oauth/callback';
const base64url = (bytes: Buffer) => bytes.toString('base64url');

/** O fluxo que um cliente MCP faz: registro dinâmico, authorize com PKCE, consentimento e troca do código pelo token. */
async function tokenDe(me: TestUser): Promise<string> {
  const registro = await h.app.request('/api/auth/oauth2/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Cliente de teste',
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }),
  });
  expect(registro.status, await registro.clone().text()).toBe(201);
  const { client_id: clientId } = await registro.json();

  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const authorize = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    scope: 'openid profile email offline_access',
    state: 'estado',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: RESOURCE,
  });
  const pedido = await h.app.request(`/api/auth/oauth2/authorize?${authorize}`, { headers: { cookie: me.cookie } });
  const paraConsentimento = new URL(pedido.headers.get('location') ?? '');
  expect(paraConsentimento.origin + paraConsentimento.pathname).toBe('http://localhost:3000/oauth/consentimento');

  const consentimento = await h.app.request('/api/auth/oauth2/consent', {
    method: 'POST',
    headers: { cookie: me.cookie, origin: TEST_ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ accept: true, oauth_query: paraConsentimento.search.slice(1) }),
  });
  expect(consentimento.status, await consentimento.clone().text()).toBe(200);
  const volta = new URL((await consentimento.json()).url);
  const code = volta.searchParams.get('code') ?? '';
  expect(code).not.toBe('');

  const troca = await h.app.request('/api/auth/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier, resource: RESOURCE }),
  });
  expect(troca.status, await troca.clone().text()).toBe(200);
  return (await troca.json()).access_token;
}

let rpcId = 0;
async function rpc(token: string | null, method: string, params: Record<string, unknown> = {}) {
  rpcId += 1;
  return h.app.request('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId, method, params }),
  });
}

async function ferramenta(token: string, name: string, args: Record<string, unknown> = {}) {
  const res = await rpc(token, 'tools/call', { name, arguments: args });
  expect(res.status).toBe(200);
  const { result } = await res.json();
  const texto: string = result.content[0].text;
  return { erro: result.isError === true, texto, dados: result.isError ? null : JSON.parse(texto) };
}

describe('servidor MCP', () => {
  it('descoberta: o recurso aponta para o servidor de autorização, que anuncia registro e PKCE', async () => {
    const recurso = await (await h.app.request('/.well-known/oauth-protected-resource/mcp')).json();
    expect(recurso).toMatchObject({ resource: RESOURCE, authorization_servers: [`${API}/api/auth`] });
    const servidor = await (await h.app.request('/.well-known/oauth-authorization-server/api/auth')).json();
    expect(servidor).toMatchObject({
      issuer: `${API}/api/auth`,
      registration_endpoint: `${API}/api/auth/oauth2/register`,
      code_challenge_methods_supported: expect.arrayContaining(['S256']),
    });
  });

  it('sem token, ou com token falso ou de sessão, responde 401 com o desafio da RFC 9728', async () => {
    for (const token of [null, 'falso.falso.falso']) {
      const res = await rpc(token, 'tools/list');
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toContain(`resource_metadata="${API}/.well-known/oauth-protected-resource/mcp"`);
    }
  });

  it('com o token do OAuth: lista as ferramentas e faz o que as telas fazem, como a própria pessoa', async () => {
    const me = await h.newUser();
    const outra = await h.newUser();
    const token = await tokenDe(me);

    const lista = await (await rpc(token, 'tools/list')).json();
    const nomes = lista.result.tools.map((t: { name: string }) => t.name);
    expect(nomes).toEqual(expect.arrayContaining(['ver_hoje', 'ver_sequencia', 'criar_habito', 'marcar_habito', 'comecar_foco', 'criar_meta', 'decidir_proposta', 'ver_ilha', 'comprar_na_ilha', 'mover_decoracao', 'ver_tarefas', 'criar_tarefa', 'mover_tarefa']));

    // Conta nova: precisa criar o sapo primeiro, como no onboarding.
    expect((await ferramenta(token, 'ver_hoje')).erro).toBe(true);
    const onboarding = await ferramenta(token, 'concluir_onboarding', { nomeDoSapo: 'Juca', inicioDoDia: 6, fimDoDia: 23 });
    expect(onboarding.dados).toMatchObject({ criado: true, habitos: 2 });

    // Tarefas: cria, move para feito e lista por coluna, só na conta da pessoa do token.
    const nova = await ferramenta(token, 'criar_tarefa', { titulo: 'Estudar', prioridade: 'alta', etiquetas: ['Faculdade'] });
    expect(nova.dados).toMatchObject({ codigo: 'PULO-1', coluna: 'afazer', prioridade: 'alta' });
    const movida = await ferramenta(token, 'mover_tarefa', { id: nova.dados.id, coluna: 'feito' });
    expect(movida.dados).toMatchObject({ codigo: 'PULO-1', coluna: 'feito' });
    expect((await ferramenta(token, 'ver_tarefas')).dados).toMatchObject({ afazer: [], feito: [{ id: nova.dados.id }] });
    expect((await (await outra.call('GET', '/api/tasks')).json()).tasks).toEqual([]);
    expect(await ferramenta(token, 'mover_tarefa', { id: 'nao-existe', coluna: 'feito' })).toMatchObject({ erro: true });

    // Ilha: conta nova não tem joias, então a compra é recusada com a mensagem da tela.
    const mapa = await ferramenta(token, 'ver_ilha');
    expect(mapa.dados).toMatchObject({ saldo: 0, moeda: 'joias', casa: { construidas: 1, total: 6 } });
    expect(await ferramenta(token, 'comprar_na_ilha', { item: 'cerca' })).toMatchObject({ erro: true, texto: 'Faltam 40 joias.' });
    expect(await ferramenta(token, 'comprar_na_ilha', { item: 'tapete', x: 1, y: 1 })).toMatchObject({ erro: true, texto: 'Faltam 10 joias.' });
    expect(await ferramenta(token, 'mover_decoracao', { item: 'tapete', x: 1, y: 1 })).toMatchObject({ erro: true });

    const habito = await ferramenta(token, 'criar_habito', { titulo: 'Ler 10 páginas', dias: ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] });
    expect(habito.dados).toMatchObject({ titulo: 'Ler 10 páginas', ativo: true });
    await ferramenta(token, 'marcar_habito', { id: habito.dados.id });
    const hoje = await ferramenta(token, 'ver_hoje');
    expect(hoje.dados.habitos).toEqual(expect.arrayContaining([{ id: habito.dados.id, titulo: 'Ler 10 páginas', feito: true }]));
    expect(hoje.dados.sapo.nome).toBe('Juca');
    expect((await ferramenta(token, 'ver_sequencia')).dados).toMatchObject({ atual: 1, recorde: 1 });

    const meta = await ferramenta(token, 'criar_meta', { titulo: 'Correr uma maratona', prazo: '2027-09-20', marcos: ['5 km', '10 km'] });
    expect(meta.dados.progresso).toEqual({ done: 0, total: 2, ratio: 0 });
    const riscada = await ferramenta(token, 'mexer_em_marco', { metaId: meta.dados.id, acao: 'alternar', marcoId: meta.dados.marcos[0].id });
    expect(riscada.dados.progresso.done).toBe(1);

    // Regras do app valem: sobreposição de blocos é recusada com a mensagem da tela.
    const bloco = await ferramenta(token, 'criar_bloco', { dia: 'sabado', inicio: '10:00', minutos: 30, tipo: 'foco' });
    expect(bloco.dados).toMatchObject({ dia: 'sabado', inicio: '10:00', fim: '10:30' });
    expect((await ferramenta(token, 'criar_bloco', { dia: 'sabado', inicio: '10:15', minutos: 30, tipo: 'foco' })).erro).toBe(true);

    const foco = await ferramenta(token, 'comecar_foco', { minutos: 25 });
    expect(foco.dados.minutos).toBe(25);
    expect((await ferramenta(token, 'controlar_foco', { acao: 'interromper' })).dados.encerrou).toBe(true);

    // Tudo foi gravado na conta da pessoa do token, e só nela.
    expect((await (await me.call('GET', '/api/goals')).json()).goals).toHaveLength(1);
    expect((await (await outra.call('GET', '/api/goals')).json()).goals).toHaveLength(0);
  });

  it('apagar tudo pede a confirmação escrita', async () => {
    const me = await h.newUser();
    const token = await tokenDe(me);
    await ferramenta(token, 'concluir_onboarding', {});
    const sem = await rpc(token, 'tools/call', { name: 'apagar_todos_os_dados', arguments: { confirmacao: 'sim' } });
    expect((await sem.json()).result.isError).toBe(true);
    expect((await ferramenta(token, 'apagar_todos_os_dados', { confirmacao: 'APAGAR TUDO' })).dados).toEqual({ apagado: true });
    expect((await ferramenta(token, 'ver_hoje')).erro).toBe(true);
  });
});
