import { RemoteError } from '@pulo/client';

import { falhaDe } from './falha';

describe('falhaDe', () => {
  test('falta de rede é sem sinal', () => {
    expect(falhaDe(new RemoteError({ kind: 'rede', mensagem: 'x' }))).toEqual({ momento: 'sem-sinal' });
  });

  test('o resto é erro, com um código para o suporte', () => {
    expect(falhaDe(new RemoteError({ kind: 'api', code: 'erro_interno', mensagem: 'x' }))).toEqual({ momento: 'erro', codigo: 'erro_interno' });
    expect(falhaDe(new RemoteError({ kind: 'resposta_invalida', status: 502, mensagem: 'x' }))).toEqual({ momento: 'erro', codigo: 'http_502' });
    expect(falhaDe(new TypeError('boom'))).toEqual({ momento: 'erro', codigo: 'TypeError' });
  });
});
