import { Hono } from 'hono';

import { handleError } from './http';

/** Mesmo formato do `DriverAdapterError` do adaptador do Postgres, sem depender do pacote. */
class ErroDoAdaptador extends Error {
  override name = 'DriverAdapterError';
  constructor(readonly kind: string) {
    super(kind);
    this.cause = { kind };
  }
}

function appQueLanca(erro: Error) {
  return new Hono()
    .get('/', () => {
      throw erro;
    })
    .onError(handleError);
}

describe('handleError', () => {
  it('conflito no commit de uma transação serializável vira 409 conflito_concorrente', async () => {
    const res = await appQueLanca(new ErroDoAdaptador('TransactionWriteConflict')).request('/');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'conflito_concorrente' });
  });

  it('outro erro do adaptador continua 500 sem detalhes', async () => {
    const res = await appQueLanca(new ErroDoAdaptador('TableDoesNotExist')).request('/');
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'erro_interno' });
  });
});
