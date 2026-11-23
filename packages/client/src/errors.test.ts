import { API_ERROR_CODES } from '@pulo/core/api/schemas';
import { MENSAGENS_DA_API, MENSAGEM_SEM_SINAL, RemoteError, errorFromResponse, mensagemDeErro } from './errors';

const reply = (status: number, body: unknown) => errorFromResponse(Response.json(body, { status }));

describe('erros da API em português', () => {
  it('todo código tem mensagem própria, sem inglês nem pontuação vazia', () => {
    for (const code of API_ERROR_CODES) {
      const texto = MENSAGENS_DA_API[code];
      expect(texto.length).toBeGreaterThan(10);
      expect(texto).toMatch(/[.?]$/);
    }
  });

  it('401 vira erro de sessão; os outros viram api com o código', async () => {
    expect(await reply(401, { error: 'nao_autenticado' })).toMatchObject({ kind: 'sessao', status: 401, code: 'nao_autenticado' });
    const limite = await reply(409, { error: 'limite_por_dia', message: 'texto do servidor' });
    expect(limite).toMatchObject({ kind: 'api', code: 'limite_por_dia', mensagem: MENSAGENS_DA_API.limite_por_dia });
    expect(limite.transitorio).toBe(false);
    expect((await reply(500, { error: 'erro_interno' })).transitorio).toBe(true);
  });

  it('guarda os campos inválidos (issues)', async () => {
    const erro = await reply(400, { error: 'corpo_invalido', issues: [{ path: 'durationMinutes', message: 'min 5' }] });
    expect(erro.issues).toEqual([{ path: 'durationMinutes', message: 'min 5' }]);
  });

  it('código desconhecido ou corpo que não é JSON vira resposta_invalida', async () => {
    expect(await reply(400, { error: 'inventado' })).toMatchObject({ kind: 'resposta_invalida' });
    expect(await errorFromResponse(new Response('oops', { status: 502 }))).toMatchObject({ kind: 'resposta_invalida', status: 502 });
  });

  it('mensagemDeErro aceita qualquer coisa', () => {
    expect(mensagemDeErro(new RemoteError({ kind: 'api', mensagem: 'x.' }))).toBe('x.');
    expect(mensagemDeErro(new Error('boom'))).toBe(MENSAGEM_SEM_SINAL);
  });
});
