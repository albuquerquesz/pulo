import { SYNC_MAX_DAYS, syncQuerySchema } from '@pulo/core/api/schemas';
import { sp } from '@pulo/core/domain/test-utils';
import { DEFAULT_HISTORY_DAYS, syncRange } from './sync-range';

describe('janela do sync', () => {
  it('180 dias para trás e 2 para frente, no dia lógico de São Paulo', () => {
    expect(syncRange(sp(2026, 11, 22))).toEqual({ from: '2026-05-26', to: '2026-11-24' });
    expect(DEFAULT_HISTORY_DAYS).toBe(180);
  });

  it('sempre cabe no limite do servidor, mesmo pedindo demais', () => {
    expect(syncQuerySchema.safeParse(syncRange(sp(2026, 11, 22), 5000)).success).toBe(true);
    expect(syncQuerySchema.safeParse(syncRange(sp(2026, 11, 22), 1)).success).toBe(true);
    expect(SYNC_MAX_DAYS).toBe(400);
  });
});
