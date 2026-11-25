import { GELO } from '../config/decisions';
import { createMemoryRepository } from '../data/memory-repository';
import { createDemoClock, seedRepository } from '../demo';
import { verCasa } from './casa';
import { type AcertoInput, acertarGelo, comprarGelo, gelosGuardados, marcarGeloVisto, validarCompraDeGelo, verGelo } from './gelo';
import { verSequencia } from './streak';
import { TZ, sp } from './test-utils';

/** Quarta, 18/11/2026, meio dia em São Paulo. */
const NOW = sp(2026, 11, 18);
const dia = (n: number) => `2026-11-${String(n).padStart(2, '0')}`;
const days = (...n: number[]) => n.map((d) => ({ date: dia(d) }));

const acerto = (extra: Partial<AcertoInput> = {}) =>
  acertarGelo({
    habitLogs: days(15),
    sessions: [],
    restDays: [],
    freezes: [],
    compras: 0,
    resolvidoAte: dia(15),
    timeZone: TZ,
    dayStartMinutes: 240,
    now: NOW,
    ...extra,
  });

describe('acertarGelo', () => {
  it('um dia vazio com 1 gelo fica protegido', () => {
    expect(acerto({ habitLogs: days(15, 16) })).toEqual({ proteger: [dia(17)], resolvidoAte: dia(17), mudou: true });
  });

  it('dois dias vazios com 1 gelo: protege o primeiro e a sequência quebra no segundo', () => {
    expect(acerto().proteger).toEqual([dia(16)]);
  });

  it('dois dias vazios com 2 gelos gastam os dois', () => {
    expect(acerto({ compras: 1 }).proteger).toEqual([dia(16), dia(17)]);
  });

  it('depois que quebra, uma sequência nova não usa gelo que não existe', () => {
    expect(acerto({ habitLogs: days(13), resolvidoAte: dia(13), now: sp(2026, 11, 18) }).proteger).toEqual([dia(14)]);
  });

  it('descanso e férias não gastam gelo', () => {
    expect(acerto({ restDays: days(16, 17) }).proteger).toEqual([]);
    const vacation = { ligado: false, desde: null, periodos: [{ de: dia(16), ate: dia(17) }] };
    expect(acerto({ vacation }).proteger).toEqual([]);
  });

  it('sequência zero não gasta gelo', () => {
    expect(acerto({ habitLogs: days(10), resolvidoAte: dia(15) }).proteger).toEqual([]);
    expect(acerto({ habitLogs: [], resolvidoAte: dia(10) }).proteger).toEqual([]);
  });

  it('rodar duas vezes não gasta de novo', () => {
    const primeiro = acerto();
    const segundo = acerto({ freezes: primeiro.proteger, resolvidoAte: primeiro.resolvidoAte });
    expect(segundo).toEqual({ proteger: [], resolvidoAte: dia(17), mudou: false });
  });

  it('hoje vazio não gasta gelo', () => {
    expect(acerto({ habitLogs: days(16, 17), resolvidoAte: dia(17) }).proteger).toEqual([]);
  });

  it('na primeira vez, os dias antigos não gastam gelo', () => {
    expect(acerto({ resolvidoAte: null })).toEqual({ proteger: [], resolvidoAte: dia(17), mudou: true });
    expect(acerto({ habitLogs: [], resolvidoAte: null }).mudou).toBe(false);
  });

  it('o dia só fecha no começo do dia da pessoa', () => {
    const cedo = { habitLogs: days(16), resolvidoAte: dia(16), now: sp(2026, 11, 18, 6), dayStartMinutes: 7 * 60 };
    expect(acerto(cedo).proteger).toEqual([]);
    expect(acerto({ ...cedo, now: sp(2026, 11, 18, 7) }).proteger).toEqual([dia(17)]);
  });
});

describe('saldo e compra', () => {
  it('presente mais compras menos usos, entre zero e o máximo', () => {
    expect(gelosGuardados(0, 0)).toBe(GELO.presenteInicial);
    expect(gelosGuardados(0, 3)).toBe(0);
    expect(gelosGuardados(9, 0)).toBe(GELO.maxGuardados);
  });

  it('recusa no máximo e sem joias', () => {
    expect(validarCompraDeGelo(GELO.maxGuardados, 999)).toMatchObject({ ok: false, error: { code: 'gelo_no_maximo' } });
    expect(validarCompraDeGelo(0, GELO.preco - 1)).toMatchObject({ ok: false, error: { code: 'joias_insuficientes' } });
    expect(validarCompraDeGelo(0, GELO.preco)).toEqual({ ok: true, value: GELO.preco });
  });
});

describe('gelo no repositório local', () => {
  const clock = { now: () => NOW };

  it('gasta sozinho, avisa uma vez e a sequência segue', async () => {
    const repo = createMemoryRepository({ habitLogs: [{ habitId: 'h', date: dia(16), doneAt: 1 }], freezeResolvedUntil: dia(16) });
    expect(await verGelo(repo, clock)).toEqual({ guardados: 0, max: GELO.maxGuardados, recentes: [dia(17)] });
    expect(await verSequencia(repo, clock)).toMatchObject({ atual: 1 });
    await marcarGeloVisto(repo, clock);
    expect((await verGelo(repo, clock))?.recentes).toEqual([]);
  });

  it('comprar gasta joias da casa; sem joias não grava nada', async () => {
    const pobre = createMemoryRepository();
    expect(await comprarGelo(pobre, clock)).toMatchObject({ ok: false, error: { code: 'joias_insuficientes' } });
    expect(await pobre.listFreezePurchases()).toEqual([]);

    const repo = createMemoryRepository({ joiaCredit: 80 });
    expect(await comprarGelo(repo, clock)).toMatchObject({ ok: true, value: { guardados: 2 } });
    expect((await verCasa(repo)).saldo).toBe(80 - GELO.preco);
    expect(await comprarGelo(repo, clock)).toMatchObject({ ok: false, error: { code: 'gelo_no_maximo' } });
  });

  it('o demo tem um dia protegido', async () => {
    const repo = createMemoryRepository();
    const demo = createDemoClock();
    await seedRepository(repo, demo);
    expect(await repo.listFreezeUses()).toHaveLength(1);
  });
});
