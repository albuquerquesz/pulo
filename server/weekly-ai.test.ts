import { computeCandidates } from '../src/domain/ia/candidates';
import { buildAiRequest } from '../src/domain/ia/request';
import { generateDemoData } from '../src/demo/generate';
import { summarizeDemoWeek } from '../src/demo/summary';
import { createProviderFromEnv, FakeProvider, handleWeeklyAi, parseRequestBody } from './weekly-ai';

const d = generateDemoData();
const s = summarizeDemoWeek('2026-11-16', d.sessions, d.checkIns, d.restDays, 5);
const body = buildAiRequest(s, computeCandidates(s, d.blocks));

describe('server/weekly-ai', () => {
  it('responde 200 com saída validada usando o provedor falso', async () => {
    const provider = new FakeProvider();
    const res = await handleWeeklyAi({ method: 'POST', body }, { provider });
    expect(res.status).toBe(200);
    expect((res.body as { candidata_escolhida: number }).candidata_escolhida).toBe(0);
    expect(provider.prompts[0].user).not.toMatch(/Foco da manhã|Sapo de exemplo|title|frogName/);
  });
  it('rejeita método, corpo inválido e corpo com índice de candidata ausente', async () => {
    const provider = new FakeProvider();
    expect((await handleWeeklyAi({ method: 'GET', body }, { provider })).status).toBe(405);
    expect((await handleWeeklyAi({ method: 'POST', body: { summary: 1 } }, { provider })).status).toBe(400);
    expect(parseRequestBody({ ...body, candidates: [] })).toBeNull();
  });
  it('502 quando o provedor falha ou devolve resposta inválida ou proibida', async () => {
    const boom = { complete: async () => Promise.reject(new Error('x')) };
    expect((await handleWeeklyAi({ method: 'POST', body }, { provider: boom })).status).toBe(502);
    expect((await handleWeeklyAi({ method: 'POST', body }, { provider: new FakeProvider(() => 'não é json') })).status).toBe(502);
    const bad = new FakeProvider(() => JSON.stringify({ candidata_escolhida: 0, padrao: 'sinal de depressão', motivo: 'ok', tom: 'leve' }));
    expect((await handleWeeklyAi({ method: 'POST', body }, { provider: bad })).status).toBe(502);
  });
  it('ambiente: sem variáveis usa o falso; provedor real ainda não existe', () => {
    expect(createProviderFromEnv({})).toBeInstanceOf(FakeProvider);
    expect(() => createProviderFromEnv({ PULO_AI_PROVIDER: 'x' })).toThrow();
  });
});
