import { ISLAND, JOIAS } from '../config/decisions';
import { createMemoryRepository } from '../data/memory-repository';
import { AREAS, comprarNaIlha, estadoDaIlha, validarCompra } from './ilha';
import { joiasGanhas, type FontesDeJoias } from './joias';
import { endedSession, sp } from './test-utils';

const clock = { now: () => 5 };
const nada: FontesDeJoias = { habitLogs: [], sessions: [], restDays: [], goals: [], baus: [], credito: 0 };
const habitos = (n: number) => Array.from({ length: n }, (_, i) => ({ habitId: 'h', date: `2026-11-${String(i + 1).padStart(2, '0')}`, doneAt: i }));

describe('ilha: joias', () => {
  it('soma hábitos, focos que contam como cuidado, descansos, marcos e metas concluídas', () => {
    const ganhas = joiasGanhas({
      credito: 7,
      habitLogs: habitos(4),
      sessions: [endedSession(sp(2026, 11, 2), 25, 'concluida'), endedSession(sp(2026, 11, 3), 25, 'interrompida', 5)],
      restDays: [{ date: '2026-11-04' }],
      baus: [{ goalId: 'g', abertoEm: 2, joias: JOIAS.por.goalCompleted }],
      goals: [
        { id: 'g', title: 'x', state: 'concluida', completedAt: 1, createdAt: 0, milestones: [{ id: 'm1', title: 'a', doneAt: 1 }, { id: 'm2', title: 'b' }] },
      ],
    });
    const por = JOIAS.por;
    // 25 minutos concluídos e 5 de uma interrompida.
    const focos = 6;
    expect(ganhas).toEqual({
      habitos: 4 * por.habitDone,
      focos,
      anteriores: 7,
      descansos: por.restDay,
      marcos: por.milestoneDone,
      metas: por.goalCompleted,
      total: 4 * por.habitDone + focos + 7 + por.restDay + por.milestoneDone + por.goalCompleted,
    });
  });

  it('o saldo nunca fica negativo', () => {
    expect(estadoDaIlha(nada, [{ item: 'banco', cost: 8, createdAt: 1 }]).saldo).toBe(0);
  });
});

describe('ilha: mapa e compras', () => {
  it('começa com a lagoa aberta, a praia como próxima e o resto fechado', () => {
    const ilha = estadoDaIlha(nada, []);
    expect(ilha.nivel).toBe(1);
    expect(ilha.areas.map((a) => a.estado)).toEqual(['aberta', 'proxima', 'fechada', 'fechada', 'fechada']);
  });

  it('valida item, ordem, área aberta, compra repetida e saldo', () => {
    const rica = estadoDaIlha({ ...nada, habitLogs: habitos(30) }, [{ item: 'banco', cost: 8, createdAt: 1 }]);
    expect(validarCompra('dragao', rica)).toMatchObject({ ok: false, error: { code: 'item_inexistente' } });
    expect(validarCompra('bosque', rica)).toMatchObject({ ok: false, error: { code: 'fora_de_ordem' } });
    expect(validarCompra('lagoa', rica)).toMatchObject({ ok: false, error: { code: 'ja_comprado' } });
    expect(validarCompra('banco', rica)).toMatchObject({ ok: false, error: { code: 'ja_comprado' } });
    expect(validarCompra('castelo', rica)).toMatchObject({ ok: false, error: { code: 'area_fechada' } });
    expect(validarCompra('lanterna', rica)).toEqual({ ok: true, value: ISLAND.decorCost.lanterna });
    expect(validarCompra('praia', rica)).toMatchObject({ ok: false, error: { code: 'joias_insuficientes', message: 'Faltam 18 joias.' } });
  });

  it('comprar grava a compra pelo preço do catálogo e abre a próxima área', async () => {
    const repo = createMemoryRepository();
    for (const log of habitos(ISLAND.areaCost.praia)) await repo.saveHabitLog(log);
    const r = await comprarNaIlha(repo, clock, 'praia');
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.nivel).toBe(2);
    expect(r.value.saldo).toBe(0);
    expect(r.value.areas[2].estado).toBe('proxima');
    expect(await repo.listIslandPurchases()).toEqual([{ item: 'praia', cost: ISLAND.areaCost.praia, createdAt: 5 }]);
    expect((await comprarNaIlha(repo, clock, 'castelo')).ok).toBe(false);
  });

  it('o catálogo tem preço para toda área e todo enfeite', () => {
    expect(AREAS.map((a) => a.id)).toEqual(Object.keys(ISLAND.areaCost));
    expect(AREAS.flatMap((a) => a.enfeites.map((e) => e.id)).sort()).toEqual(Object.keys(ISLAND.decorCost).sort());
  });
});
