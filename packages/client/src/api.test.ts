import type { RoutineBlock } from '@pulo/core/domain/types';
import { type FetchLike, createApiClient } from './api';
import { RemoteError } from './errors';

function capture(): { fetch: FetchLike; requests: Request[] } {
  const requests: Request[] = [];
  return {
    requests,
    fetch: (request) => {
      requests.push(request);
      return Response.json({ blocks: [] });
    },
  };
}

describe('createApiClient', () => {
  it('manda sempre credenciais (o cookie HttpOnly da sessão vai por conta do navegador)', async () => {
    const { fetch, requests } = capture();
    const client = createApiClient({ baseUrl: 'http://api.test/', fetch });
    await client.api.blocks.$get();
    expect(requests[0].url).toBe('http://api.test/api/blocks');
    expect(requests[0].credentials).toBe('include');
    expect(requests[0].headers.get('cookie')).toBeNull();
  });

  it('as respostas têm tipo inferido da API, sem any', async () => {
    const { fetch } = capture();
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });
    const body = await (await client.api.blocks.$get()).json();
    expectTypeOf(body.blocks).toEqualTypeOf<RoutineBlock[]>();
  });

  it('falha de rede vira RemoteError "rede"', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: () => {
        throw new TypeError('Network request failed');
      },
    });
    await expect(client.api.blocks.$get()).rejects.toBeInstanceOf(RemoteError);
    await expect(client.api.blocks.$get()).rejects.toMatchObject({ kind: 'rede' });
  });
});
