// Roda a API de verdade (Hono + Better Auth + Prisma) no mesmo processo, sobre o Postgres de teste.
// O `fetch` do cliente é o `app.fetch`: nenhuma rede, nenhum mock da API.
import { createHarness, TEST_NOW, TEST_ORIGIN, type TestUser } from '@pulo/api/src/testing';
import { MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import { criarPlanoInicial } from '@pulo/core/domain/routine';
import { defineRepositoryContract } from '@pulo/core/data/repository-contract';
import type { Habit, RoutineBlock, User } from '@pulo/core/domain/types';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { type FetchLike, RemoteError, createRemoteRepository } from './index';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const clock = { now: () => TEST_NOW };

/** `fetch` que anota cada chamada e repassa para a API real. */
function recordingFetch(): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    fetch: (request) => {
      calls.push(`${request.method} ${new URL(request.url).pathname}`);
      return h.app.fetch(request);
    },
  };
}

/** O navegador mandaria o cookie HttpOnly e o Origin sozinho; no teste (sem navegador) o `fetch` os acrescenta. */
function asBrowser(me: TestUser, fetch: FetchLike): FetchLike {
  return (request) => {
    const headers = new Headers(request.headers);
    headers.set('cookie', me.cookie);
    headers.set('origin', TEST_ORIGIN);
    return fetch(new Request(request, { headers }));
  };
}

async function open(me: TestUser, fetch: FetchLike = (request) => h.app.fetch(request)) {
  return createRemoteRepository({
    baseUrl: 'http://api.test',
    fetch: asBrowser(me, fetch),
    clock,
    retries: 0,
  });
}

const uuid = () => crypto.randomUUID();
const bloco = (extra: Partial<RoutineBlock> = {}): RoutineBlock => ({
  id: uuid(), weekday: 1, startMinutes: 540, durationMinutes: 30, kind: 'foco', ...extra,
});
const habito = (extra: Partial<Habit> = {}): Habit => ({ id: uuid(), title: 'Ler', weekdays: [0], active: true, ...extra });

// ---------- O contrato compartilhado do Repository ----------

defineRepositoryContract(
  'RemoteRepository (API real)',
  async () => {
    const me = await h.newUser();
    return { repository: await open(me), userId: me.id };
  },
  { mascotIsServerDerived: true },
);

// ---------- Comportamento próprio do remoto ----------

describe('RemoteRepository: sync e cache', () => {
  it('abre com UM GET /api/sync, lê tudo do cache e cada escrita é uma chamada', async () => {
    const me = await h.newUser();
    const first = await open(me);
    await first.saveBlock(bloco());
    await first.saveHabit(habito());

    const { fetch, calls } = recordingFetch();
    const repo = await open(me, fetch);
    expect(calls).toEqual(['GET /api/sync']);

    await repo.listBlocks();
    await repo.listHabits();
    await repo.listHabitLogs();
    await repo.listSessions();
    await repo.listRestDays();
    await repo.listProposals();
    await repo.getMascotState();
    await repo.getUser();
    expect(calls).toEqual(['GET /api/sync']);

    const b = bloco();
    await repo.saveBlock(b);
    await repo.deleteBlock(b.id);
    expect(calls.slice(1)).toEqual([`PUT /api/blocks/${b.id}`, `DELETE /api/blocks/${b.id}`]);
    expect(await repo.listBlocks()).toHaveLength(1);
  });

  it('a conta e os dados vêm só da pessoa logada', async () => {
    const [ana, beto] = [await h.newUser(), await h.newUser()];
    const a = await open(ana);
    await a.saveBlock(bloco());
    const b = await open(beto);
    expect(await b.listBlocks()).toEqual([]);
    expect(b.account.id).toBe(beto.id);
    expect(b.account.id).not.toBe(a.account.id);
  });

  it('reload troca o cache pelo que o servidor tem', async () => {
    const me = await h.newUser();
    const a = await open(me);
    const outroAparelho = await open(me);
    await outroAparelho.saveBlock(bloco({ title: 'Do outro aparelho' }));
    expect(await a.listBlocks()).toEqual([]);
    await a.reload();
    expect((await a.listBlocks()).map((x) => x.title)).toEqual(['Do outro aparelho']);
  });

  it('blocos saem em ordem de dia e horário', async () => {
    const repo = await open(await h.newUser());
    await repo.saveBlock(bloco({ weekday: 3, startMinutes: 600 }));
    await repo.saveBlock(bloco({ weekday: 1, startMinutes: 900 }));
    await repo.saveBlock(bloco({ weekday: 1, startMinutes: 60 }));
    expect((await repo.listBlocks()).map((x) => [x.weekday, x.startMinutes])).toEqual([[1, 60], [1, 900], [3, 600]]);
  });

  it('o sapo vem do servidor ao encerrar uma sessão', async () => {
    const repo = await open(await h.newUser());
    const start = TEST_NOW - 3_600_000;
    await repo.saveSession({ id: uuid(), startedAt: start, endedAt: start + 25 * 60_000, plannedMinutes: 25, state: 'concluida', pausedMs: 0 });
    const mascot = await repo.getMascotState();
    expect(mascot).toMatchObject({ phase: 1, updatedAt: TEST_NOW });
    expect(mascot?.careDays).toBeGreaterThanOrEqual(1);
  });
});

describe('RemoteRepository: usuário nos metadados da conta', () => {
  const user = (id: string): User => ({
    id, frogName: 'Pulinho', timezone: 'America/Recife', dayStartMinutes: 360, dayEndMinutes: 1260,
    theme: 'escuro', reduceMotion: true, createdAt: TEST_NOW,
  });

  it('guarda no servidor e outro aparelho lê o mesmo User', async () => {
    const me = await h.newUser();
    const a = await open(me);
    expect(await a.getUser()).toBeNull();
    await a.saveUser(user(me.id));
    const b = await open(me);
    expect(await b.getUser()).toEqual(user(me.id));
    const meta = await (await me.call('GET', '/api/me')).json();
    expect(meta.metadata).toMatchObject({ theme: 'escuro', timezone: 'America/Recife', onboarding: { completed: true } });
  });

  it('clearAll volta ao onboarding mas mantém a conta e o tema', async () => {
    const me = await h.newUser();
    const a = await open(me);
    await a.saveUser(user(me.id));
    await a.saveBlock(bloco());
    await a.clearAll();
    const b = await open(me);
    expect(await b.getUser()).toBeNull();
    expect(await b.listBlocks()).toEqual([]);
    expect((await (await me.call('GET', '/api/me')).json()).metadata.onboarding).toEqual({ completed: false, completedAt: null });
  });

  it('nome do sapo inválido é recusado e o cache volta', async () => {
    const me = await h.newUser();
    const a = await open(me);
    await a.saveUser(user(me.id));
    await expect(a.saveUser({ ...user(me.id), frogName: '   ' })).rejects.toMatchObject({ kind: 'api', code: 'corpo_invalido' });
    expect((await a.getUser())?.frogName).toBe('Pulinho');
  });
});

describe('RemoteRepository: erros e rollback', () => {
  it('sem login o sync falha com erro de sessão', async () => {
    const erro = await createRemoteRepository({ baseUrl: 'http://api.test', fetch: (r) => h.app.fetch(r), clock }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(RemoteError);
    expect(erro).toMatchObject({ kind: 'sessao', status: 401, code: 'nao_autenticado' });
  });

  it('bloco inválido no servidor: erro em português e o cache volta', async () => {
    const repo = await open(await h.newUser());
    const bom = bloco();
    await repo.saveBlock(bom);
    const erro = await repo.saveBlock({ ...bom, durationMinutes: 500 }).catch((e: unknown) => e);
    expect(erro).toMatchObject({ kind: 'api', status: 400, code: 'corpo_invalido' });
    expect(erro).toHaveProperty('mensagem', 'Alguma informação não ficou certa. Confira os campos e tente de novo.');
    expect(await repo.listBlocks()).toEqual([bom]);
  });

  it('um bloco novo recusado some do cache', async () => {
    const repo = await open(await h.newUser());
    await expect(repo.saveBlock(bloco({ durationMinutes: 1 }))).rejects.toBeInstanceOf(RemoteError);
    expect(await repo.listBlocks()).toEqual([]);
  });

  it('limite de hábitos por dia: 409 e o hábito não fica no cache', async () => {
    const repo = await open(await h.newUser());
    for (let i = 0; i < MAX_HABITS_PER_DAY; i += 1) await repo.saveHabit(habito({ title: `H${i}` }));
    const sexto = habito({ title: 'sobra' });
    await expect(repo.saveHabit(sexto)).rejects.toMatchObject({ code: 'limite_por_dia', status: 409 });
    expect((await repo.listHabits()).some((x) => x.id === sexto.id)).toBe(false);
    expect(await repo.listHabits()).toHaveLength(MAX_HABITS_PER_DAY);
  });

  it('apagar hábito recusado devolve o hábito e os registros', async () => {
    const me = await h.newUser();
    let falhar = false;
    const repo = await open(me, (request) => (falhar && request.method === 'DELETE' ? Response.json({ error: 'erro_interno' }, { status: 500 }) : h.app.fetch(request)));
    const x = habito();
    await repo.saveHabit(x);
    await repo.saveHabitLog({ habitId: x.id, date: '2026-11-10', doneAt: 1 });
    falhar = true;
    await expect(repo.deleteHabit(x.id)).rejects.toMatchObject({ code: 'erro_interno' });
    expect(await repo.listHabits()).toEqual([x]);
    expect(await repo.listHabitLogs()).toHaveLength(1);
  });

  it('sem rede: erro "rede" com o texto da lagoa, e a leitura continua do cache', async () => {
    const me = await h.newUser();
    let caiu = false;
    const repo = await open(me, (request) => {
      if (caiu) throw new TypeError('Network request failed');
      return h.app.fetch(request);
    });
    const b = bloco();
    await repo.saveBlock(b);
    caiu = true;
    const erro = await repo.saveBlock(bloco()).catch((e: unknown) => e);
    expect(erro).toMatchObject({ kind: 'rede', transitorio: true });
    expect(erro).toHaveProperty('mensagem', expect.stringContaining('A lagoa ficou sem sinal'));
    await expect(repo.deleteBlock(b.id)).rejects.toMatchObject({ kind: 'rede' });
    expect(await repo.listBlocks()).toEqual([b]);
    await expect(repo.reload()).rejects.toMatchObject({ kind: 'rede' });
    expect(await repo.listBlocks()).toEqual([b]);
  });

  it('sessão encerrada não muda: o cache fica com a versão do servidor', async () => {
    const repo = await open(await h.newUser());
    const start = TEST_NOW - 3_600_000;
    const s = { id: uuid(), startedAt: start, endedAt: start + 60_000, plannedMinutes: 25, state: 'interrompida' as const, pausedMs: 0 };
    await repo.saveSession(s);
    await expect(repo.saveSession({ ...s, state: 'concluida' })).rejects.toMatchObject({ code: 'sessao_encerrada' });
    expect(await repo.listSessions()).toEqual([s]);
  });

  it('o rollback não desfaz uma escrita mais nova da mesma chave', async () => {
    let chamada = 0;
    const repo = await open(await h.newUser(), (request) => {
      if (request.method === 'PUT') {
        chamada += 1;
        // A primeira escrita falha; a segunda passa.
        if (chamada === 1) return Response.json({ error: 'erro_interno' }, { status: 500 });
      }
      return h.app.fetch(request);
    });
    const id = uuid();
    const [primeira, segunda] = [bloco({ id, title: 'A' }), bloco({ id, title: 'B' })];
    const falha = repo.saveBlock(primeira).catch((e: unknown) => e);
    const ok = repo.saveBlock(segunda);
    expect(await falha).toBeInstanceOf(RemoteError);
    await ok;
    expect(await repo.listBlocks()).toEqual([segunda]);
    await repo.reload();
    expect(await repo.listBlocks()).toEqual([segunda]);
  });

  it('colisão no servidor (conflito_concorrente) é repetida e passa', async () => {
    const me = await h.newUser();
    let tentativas = 0;
    const repo = await createRemoteRepository({
      baseUrl: 'http://api.test',
      clock,
      retries: 2,
      fetch: asBrowser(me, (request) => {
        if (request.method === 'PUT') {
          tentativas += 1;
          if (tentativas < 3) return Response.json({ error: 'conflito_concorrente' }, { status: 409 });
        }
        return h.app.fetch(request);
      }),
    });
    const b = bloco();
    await repo.saveBlock(b);
    expect(tentativas).toBe(3);
    await repo.reload();
    expect(await repo.listBlocks()).toEqual([b]);
  });

  it('corpo de erro fora do contrato vira resposta_invalida', async () => {
    const me = await h.newUser();
    const repo = await open(me, (request) => (request.method === 'PUT' ? new Response('<html>502</html>', { status: 502 }) : h.app.fetch(request)));
    await expect(repo.saveBlock(bloco())).rejects.toMatchObject({ kind: 'resposta_invalida', status: 502 });
  });

  it('escritas em lote: o plano inicial vira 2 chamadas e grava tudo no servidor', async () => {
    const me = await h.newUser();
    const { fetch, calls } = recordingFetch();
    const repo = await open(me, fetch);
    const plan = await criarPlanoInicial(repo, TEST_NOW);
    expect(calls.filter((c) => c !== 'GET /api/sync').sort()).toEqual(['PUT /api/blocks', 'PUT /api/habits']);
    expect(await repo.listBlocks()).toHaveLength(plan.blocks.length);

    const fresh = await open(me);
    expect((await fresh.listBlocks()).map((b) => b.id).sort()).toEqual(plan.blocks.map((b) => b.id).sort());
    expect((await fresh.listHabits()).map((x) => x.id).sort()).toEqual(plan.habits.map((x) => x.id).sort());
  });

  it('lote recusado pelo servidor desfaz o cache inteiro e sobe o erro', async () => {
    const dona = await h.newUser();
    const outra = await h.newUser();
    const alheio = bloco();
    await (await open(dona)).saveBlock(alheio);

    const repo = await open(outra);
    const meu = bloco({ weekday: 3 });
    await expect(repo.saveBlocks([meu, alheio])).rejects.toMatchObject({ kind: 'api', code: 'conflito_de_id', status: 409 });
    expect(await repo.listBlocks()).toEqual([]);

    const cheio = Array.from({ length: MAX_HABITS_PER_DAY + 1 }, () => habito({ weekdays: [4] }));
    await expect(repo.saveHabits(cheio)).rejects.toMatchObject({ code: 'limite_por_dia' });
    expect(await repo.listHabits()).toEqual([]);
  });

  it('lote vazio não chama o servidor', async () => {
    const me = await h.newUser();
    const { fetch, calls } = recordingFetch();
    const repo = await open(me, fetch);
    await repo.saveBlocks([]);
    await repo.saveHabits([]);
    expect(calls).toEqual(['GET /api/sync']);
  });
});
