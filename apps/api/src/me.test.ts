import { DEFAULT_USER_METADATA } from '@pulo/core/domain/user-metadata';
import { createApp } from './app';
import { createAuth } from './auth';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { signIn, testEnv } from './testing';
import { resolveWebConfig } from './web-config';

const NOW = 1_795_000_000_000;
const ORIGINS = ['http://localhost:3000'];

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database.close();
});

function setup() {
  const auth = createAuth(testEnv, resolveWebConfig(testEnv), database.db);
  return { auth, app: createApp(testEnv, database.db, () => NOW) };
}

function patch(app: ReturnType<typeof setup>['app'], cookie: string, body: string) {
  return app.request('/api/me/metadata', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json', origin: ORIGINS[0] },
    body,
  });
}

describe('/api/me', () => {
  it('sem sessão responde 401', async () => {
    const { app } = setup();
    expect((await app.request('/api/me')).status).toBe(401);
    expect((await patch(app, '', '{"theme":"escuro"}')).status).toBe(401);
  });

  it('usuário novo recebe os metadados padrão', async () => {
    const { app, auth } = setup();
    const { cookie } = await signIn(auth, 'nova@example.com');
    const res = await app.request('/api/me', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { email: 'nova@example.com' }, metadata: DEFAULT_USER_METADATA });
  });

  it('salva tema e onboarding e devolve na leitura seguinte', async () => {
    const { app, auth } = setup();
    const { cookie } = await signIn(auth, 'tema@example.com');
    const res = await patch(app, cookie, '{"theme":"escuro","onboardingCompleted":true}');
    expect(res.status).toBe(200);

    const me = await (await app.request('/api/me', { headers: { cookie } })).json();
    expect(me.metadata).toMatchObject({ theme: 'escuro', onboarding: { completed: true, completedAt: NOW } });
  });

  it('recusa campo desconhecido e JSON quebrado', async () => {
    const { app, auth } = setup();
    const { cookie } = await signIn(auth, 'erro@example.com');
    expect((await patch(app, cookie, '{"frogName":"Zé"}')).status).toBe(400);
    expect((await patch(app, cookie, '{quebrado')).status).toBe(400);
  });

  it('GET /api/me faz um número fixo e pequeno de queries (sem N+1)', async () => {
    const { app, auth } = setup();
    const { cookie } = await signIn(auth, 'queries@example.com');
    const { count, queries } = await database.countQueries(async () => app.request('/api/me', { headers: { cookie } }));
    expect(count, queries.join('\n')).toBeLessThanOrEqual(2);
  });
});

describe('perfil do app nos metadados', () => {
  it('grava o perfil, devolve na leitura e apaga com null', async () => {
    const { app, auth } = setup();
    const { cookie } = await signIn(auth, 'perfil@example.com');
    const profile = { frogName: 'Pulinho', dayStartMinutes: 360, dayEndMinutes: 1260, createdAt: NOW };

    const salvo = await patch(app, cookie, JSON.stringify({ profile, onboardingCompleted: true }));
    expect(salvo.status).toBe(200);
    const me = await (await app.request('/api/me', { headers: { cookie } })).json();
    expect(me.metadata).toMatchObject({ profile, onboarding: { completed: true, completedAt: NOW } });

    const apagado = await patch(app, cookie, JSON.stringify({ profile: null, onboardingCompleted: false }));
    expect((await apagado.json()).metadata).toMatchObject({ profile: null, onboarding: { completed: false, completedAt: null } });
  });

  it('recusa perfil inválido com o corpo de erro padrão', async () => {
    const { app, auth } = setup();
    const { cookie } = await signIn(auth, 'perfil-ruim@example.com');
    const res = await patch(app, cookie, JSON.stringify({ profile: { frogName: '', dayStartMinutes: 600, dayEndMinutes: 500, createdAt: 1 } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'corpo_invalido' });
  });

  it('conta antiga, sem profile no JSON guardado, lê profile nulo', async () => {
    const { app, auth } = setup();
    const { user, cookie } = await signIn(auth, 'antiga@example.com');
    const context = await auth.$context;
    await context.internalAdapter.updateUser(user.id, {
      metadata: { version: 1, theme: 'escuro', reduceMotion: false, timezone: 'America/Recife', onboarding: { completed: true, completedAt: 5 } },
    });
    const me = await (await app.request('/api/me', { headers: { cookie } })).json();
    expect(me.metadata).toEqual({
      version: 1, theme: 'escuro', reduceMotion: false, timezone: 'America/Recife',
      onboarding: { completed: true, completedAt: 5 }, profile: null,
    });
  });
});
