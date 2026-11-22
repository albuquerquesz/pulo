import { DEFAULT_USER_METADATA } from '@pulo/core/domain/user-metadata';
import { createApp } from './app';
import { createAuth } from './auth';
import { createTestDatabase, signIn, testEnv } from './testing';

const NOW = 1_795_000_000_000;
const ORIGINS = ['http://localhost:3000'];

function setup() {
  const database = createTestDatabase();
  const auth = createAuth(testEnv, ORIGINS, database);
  return { auth, app: createApp(testEnv, database, () => NOW) };
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
});
