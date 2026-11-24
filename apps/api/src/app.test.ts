import { computeCandidates } from '@pulo/core/domain/ia/candidates';
import { buildAiRequest } from '@pulo/core/domain/ia/request';
import { generateDemoData } from '@pulo/core/demo/generate';
import { summarizeDemoWeek } from '@pulo/core/demo/summary';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { createApp } from './app';
import { testEnv } from './testing';

let database: TestDatabase;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  database = await createTestDatabase();
  app = createApp(testEnv, database.db);
});
afterAll(async () => {
  await database.close();
});

describe('API', () => {
  it('responde /health', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('rejeita corpo inválido em /weekly-ai', async () => {
    const res = await app.request('/weekly-ai', { method: 'POST', body: '{"texto":"livre"}' });
    expect(res.status).toBe(400);
  });

  it('devolve a sugestão do provedor falso', async () => {
    const data = generateDemoData();
    const summary = summarizeDemoWeek('2026-11-16', data.sessions, data.restDays, 5);
    const request = buildAiRequest(summary, computeCandidates(summary, data.blocks));
    const res = await app.request('/weekly-ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ candidata_escolhida: 0 });
  });

  it('começa o login com Google e manda para o consentimento', async () => {
    const res = await app.request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ provider: 'google', callbackURL: 'http://localhost:3000' }),
    });
    expect(res.status).toBe(200);
    const { url } = await res.json();
    const google = new URL(url);
    expect(google.host).toBe('accounts.google.com');
    expect(google.searchParams.get('client_id')).toBe('google-client-id');
    expect(google.searchParams.get('redirect_uri')).toBe('http://localhost:8787/api/auth/callback/google');
  });

  it('sem cookie, a sessão é nula', async () => {
    const res = await app.request('/api/auth/get-session');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('recusa login vindo de origem desconhecida', async () => {
    const res = await app.request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://golpe.example' },
      body: JSON.stringify({ provider: 'google', callbackURL: 'https://golpe.example' }),
    });
    expect(res.status).toBe(403);
  });

  it('libera CORS só para a origem configurada', async () => {
    const res = await app.request('/health', { headers: { origin: 'http://localhost:3000' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });
});
