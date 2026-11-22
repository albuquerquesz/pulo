import { computeCandidates } from '@pulo/core/domain/ia/candidates';
import { buildAiRequest } from '@pulo/core/domain/ia/request';
import { generateDemoData } from '@pulo/core/demo/generate';
import { summarizeDemoWeek } from '@pulo/core/demo/summary';
import { createApp } from './app';

const app = createApp({});

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
    const summary = summarizeDemoWeek('2026-11-16', data.sessions, data.checkIns, data.restDays, 5);
    const request = buildAiRequest(summary, computeCandidates(summary, data.blocks));
    const res = await app.request('/weekly-ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ candidata_escolhida: 0 });
  });

  it('libera CORS só para a origem configurada', async () => {
    const res = await app.request('/health', { headers: { origin: 'http://localhost:8081' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
  });
});
