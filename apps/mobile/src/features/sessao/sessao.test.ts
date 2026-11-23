import { RemoteError } from '@pulo/client';
import { type BatchRepository, supportsBatch } from '@pulo/core/data/batch';
import { createMemoryRepository } from '@/data';

import { escolherOrigem } from '../app/origem';
import { comAvisosDeErro, repositorioFechado } from '../app/repositorio';
import { API_LOCAL, apiUrl, endpointDaIa } from './config';

describe('endereços do ambiente', () => {
  test('API: variável, sem barra no fim; em desenvolvimento cai no wrangler local; em produção fica sem', () => {
    expect(apiUrl({ EXPO_PUBLIC_API_URL: ' https://api.exemplo.dev/// ' }, false)).toBe('https://api.exemplo.dev');
    expect(apiUrl({}, true)).toBe(API_LOCAL);
    expect(apiUrl({ EXPO_PUBLIC_API_URL: '  ' }, false)).toBeNull();
  });

  test('IA: endereço próprio vence; senão /weekly-ai da API; sem nenhum, regras locais', () => {
    expect(endpointDaIa({ EXPO_PUBLIC_WEEKLY_AI_ENDPOINT: 'https://ia.exemplo.dev/x', EXPO_PUBLIC_API_URL: 'https://api.exemplo.dev' }, false)).toBe(
      'https://ia.exemplo.dev/x',
    );
    expect(endpointDaIa({ EXPO_PUBLIC_API_URL: 'https://api.exemplo.dev/' }, false)).toBe('https://api.exemplo.dev/weekly-ai');
    expect(endpointDaIa({}, false)).toBeUndefined();
    expect(endpointDaIa({}, true)).toBe(`${API_LOCAL}/weekly-ai`);
  });
});

describe('de onde vêm os dados', () => {
  test('demo vence tudo e nunca precisa de sessão', () => {
    expect(escolherOrigem({ demo: true, temSessao: false })).toBe('demo');
    expect(escolherOrigem({ demo: true, temSessao: true })).toBe('demo');
  });
  test('sem demo: sessão usa o servidor, sem sessão pede login', () => {
    expect(escolherOrigem({ demo: false, temSessao: true })).toBe('remoto');
    expect(escolherOrigem({ demo: false, temSessao: false })).toBe('login');
  });
});

describe('repositório fechado e avisos de erro', () => {
  test('o fechado recusa leitura e escrita', async () => {
    await expect(repositorioFechado.listBlocks()).rejects.toMatchObject({ kind: 'sessao' });
    await expect(repositorioFechado.clearAll()).rejects.toBeInstanceOf(RemoteError);
  });

  test('erro de escrita avisa em português e repassa; leitura e sucesso não avisam', async () => {
    const avisos: string[] = [];
    let expirou = 0;
    const base = createMemoryRepository();
    const falha = new RemoteError({ kind: 'rede', mensagem: 'A lagoa ficou sem sinal.' });
    const repo = comAvisosDeErro(
      { ...base, saveBlock: () => Promise.reject(falha), deleteBlock: () => Promise.reject(new RemoteError({ kind: 'sessao', mensagem: 'x' })) },
      { avisar: (m) => avisos.push(m), sessaoExpirou: () => void (expirou += 1) },
    );
    await repo.saveHabit({ id: 'h', title: 'a', weekdays: [0], active: true });
    expect(await repo.listHabits()).toHaveLength(1);
    expect(avisos).toEqual([]);
    await expect(repo.saveBlock({ id: 'b', weekday: 0, startMinutes: 0, durationMinutes: 5, kind: 'foco' })).rejects.toBe(falha);
    expect(avisos).toEqual(['A lagoa ficou sem sinal.']);
    await expect(repo.deleteBlock('b')).rejects.toMatchObject({ kind: 'sessao' });
    expect(expirou).toBe(1);
    expect(avisos).toHaveLength(1);
  });

  test('escritas em lote passam pelo aviso de erro quando o repositório as tem, e somem quando não tem', async () => {
    const avisos: string[] = [];
    const falha = new RemoteError({ kind: 'rede', mensagem: 'A lagoa ficou sem sinal.' });
    const opcoes = { avisar: (m: string) => avisos.push(m), sessaoExpirou: () => undefined };
    const base = createMemoryRepository();
    const emLote: BatchRepository = { ...base, saveBlocks: () => Promise.reject(falha), saveHabits: () => Promise.resolve() };
    const comLote = comAvisosDeErro(emLote, opcoes);
    expect(supportsBatch(comLote)).toBe(true);
    if (!supportsBatch(comLote)) return;
    await expect(comLote.saveBlocks([])).rejects.toBe(falha);
    await comLote.saveHabits([]);
    expect(avisos).toEqual(['A lagoa ficou sem sinal.']);
    expect(supportsBatch(comAvisosDeErro(base, opcoes))).toBe(false);
  });
});
