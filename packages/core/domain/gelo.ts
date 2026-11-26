import { DEFAULT_TIMEZONE, GELO } from '../config/decisions';
import { verCasa } from './casa';
import { addDays } from './day';
import { providesFreezeStore } from './gelo-store';
import { textoDeFalta } from './joias';
import { type Result, fail, ok } from './result';
import { type StreakInput, streakDaySets } from './streak';
import type { Clock, DateKey, FreezeStatus, FreezeSummary, FreezeUse, Repository } from './types';

export type FreezeErrorCode = 'gelo_no_maximo' | 'joias_insuficientes';

/** Gelos guardados: o presente mais as compras menos os usos, entre zero e o máximo. */
export function gelosGuardados(compras: number, usos: number): number {
  return Math.max(0, Math.min(GELO.maxGuardados, GELO.presenteInicial + compras - usos));
}

export function resumoDoGelo(compras: number, usos: readonly FreezeUse[]): FreezeStatus {
  const ordenados = [...usos].sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    guardados: gelosGuardados(compras, usos.length),
    max: GELO.maxGuardados,
    usados: ordenados.map((use) => use.date),
    recentes: ordenados.filter((use) => use.vistoEm === undefined).map((use) => use.date),
  };
}

export interface DiasAProtegerInput {
  /** Dias com hábito feito ou foco que conta como cuidado. */
  cuidados: ReadonlySet<DateKey>;
  descansos: ReadonlySet<DateKey>;
  ferias: ReadonlySet<DateKey>;
  /** Dias já protegidos. */
  usados: ReadonlySet<DateKey>;
  /** Gelos guardados agora. */
  saldo: number;
  /** Último dia lógico já resolvido. */
  resolvidoAte: DateKey;
  hoje: DateKey;
}

/**
 * Os dias a proteger entre o último resolvido e ontem, do mais antigo ao mais novo. Só gasta gelo com a sequência
 * viva: o dia vazio sem gelo a quebra, e os dias seguintes não gastam nada. Hoje ainda não terminou e não entra.
 */
export function diasAProteger({ cuidados, descansos, ferias, usados, saldo, resolvidoAte, hoje }: DiasAProtegerInput): DateKey[] {
  const protegido = (date: DateKey) => descansos.has(date) || ferias.has(date) || usados.has(date);

  // A sequência está viva se, voltando do último dia resolvido, há um dia feito antes de qualquer dia vazio.
  let viva = false;
  for (let date = resolvidoAte; cuidados.has(date) || protegido(date); date = addDays(date, -1)) {
    if (!cuidados.has(date)) continue;
    viva = true;
    break;
  }

  const dias: DateKey[] = [];
  let restam = saldo;
  for (let date = addDays(resolvidoAte, 1); date < hoje; date = addDays(date, 1)) {
    if (cuidados.has(date)) viva = true;
    if (cuidados.has(date) || protegido(date) || !viva) continue;
    if (restam <= 0) {
      viva = false;
      continue;
    }
    restam -= 1;
    dias.push(date);
  }
  return dias;
}

export interface AcertoInput extends StreakInput {
  /** Dias já protegidos. */
  freezes: readonly DateKey[];
  /** Quantos gelos a pessoa já comprou. */
  compras: number;
  /** `null` na primeira vez: os dias antigos não gastam gelo. */
  resolvidoAte: DateKey | null;
}

export interface Acerto {
  proteger: DateKey[];
  resolvidoAte: DateKey;
  /** Há algo a gravar. Sem nenhum registro, o primeiro acerto não precisa ficar guardado. */
  mudou: boolean;
}

/** O acerto preguiçoso do gelo: resolve os dias lógicos fechados desde o último resolvido. Rodar de novo não muda nada. */
export function acertarGelo(input: AcertoInput): Acerto {
  const { today, done, rest, vacation } = streakDaySets(input);
  const ontem = addDays(today, -1);
  const desde = input.resolvidoAte ?? ontem;
  const usados = new Set(input.freezes);
  const proteger = diasAProteger({
    cuidados: done,
    descansos: rest,
    ferias: vacation,
    usados,
    saldo: gelosGuardados(input.compras, usados.size),
    resolvidoAte: desde,
    hoje: today,
  });
  // O último resolvido nunca volta (ex.: mudança de fuso).
  const resolvidoAte = desde > ontem ? desde : ontem;
  const mudou = input.resolvidoAte === null ? done.size > 0 || rest.size > 0 : resolvidoAte !== input.resolvidoAte;
  return { proteger, resolvidoAte, mudou };
}

/** Se dá para comprar um gelo agora. O servidor usa a mesma regra antes de gravar. */
export function validarCompraDeGelo(guardados: number, joias: number): Result<number, FreezeErrorCode> {
  if (guardados >= GELO.maxGuardados) {
    return fail('gelo_no_maximo', `Você já guarda ${GELO.maxGuardados} gelos, que é o máximo.`);
  }
  if (joias < GELO.preco) return fail('joias_insuficientes', textoDeFalta(GELO.preco - joias));
  return ok(GELO.preco);
}

/** Repositório em que o servidor cuida do gelo (o remoto). */
export interface FreezeSource {
  getFreezes(): Promise<FreezeSummary>;
  buyFreeze(): Promise<void>;
  /** Marca como vistos os gastos que o aviso mostrou. */
  markFreezesSeen(): Promise<void>;
}

export function providesFreezes(repo: Repository): repo is Repository & FreezeSource {
  return 'getFreezes' in repo && typeof repo.getFreezes === 'function';
}

/** Num repositório local, gasta os gelos devidos e devolve a situação atual. `null` se ele não guarda gelo. */
export async function acertarGeloLocal(repo: Repository, clock: Clock): Promise<FreezeStatus | null> {
  if (!providesFreezeStore(repo)) return null;
  const [user, habitLogs, sessions, restDays, usos, compras, resolvidoAte] = await Promise.all([
    repo.getUser(),
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    repo.listFreezeUses(),
    repo.listFreezePurchases(),
    repo.getFreezeResolvedUntil(),
  ]);
  const acerto = acertarGelo({
    habitLogs,
    sessions,
    restDays,
    freezes: usos.map((use) => use.date),
    compras: compras.length,
    resolvidoAte,
    timeZone: user?.timezone ?? DEFAULT_TIMEZONE,
    dayStartMinutes: user?.dayStartMinutes,
    now: clock.now(),
  });
  const novos: FreezeUse[] = acerto.proteger.map((date) => ({ date }));
  if (novos.length > 0) await repo.saveFreezeUses(novos);
  if (acerto.mudou) await repo.saveFreezeResolvedUntil(acerto.resolvidoAte);
  return resumoDoGelo(compras.length, [...usos, ...novos]);
}

/** A situação do gelo: a do servidor, quando ele a fornece; senão (memória), acertada aqui. */
export async function verGelo(repo: Repository, clock: Clock): Promise<FreezeSummary | null> {
  if (providesFreezes(repo)) return repo.getFreezes();
  const status = await acertarGeloLocal(repo, clock);
  if (!status) return null;
  const { guardados, max, recentes } = status;
  return { guardados, max, recentes };
}

/** Compra um gelo com joias. No remoto, a recusa do servidor sobe como erro. */
export async function comprarGelo(repo: Repository, clock: Clock): Promise<Result<FreezeSummary, FreezeErrorCode | 'indisponivel'>> {
  if (providesFreezes(repo)) {
    await repo.buyFreeze();
    return ok(await repo.getFreezes());
  }
  // Acerta antes: um gelo comprado agora não salva um dia que já terminou.
  const antes = await acertarGeloLocal(repo, clock);
  if (!antes || !providesFreezeStore(repo)) return fail('indisponivel', 'O gelo não está disponível aqui.');
  const { saldo } = await verCasa(repo);
  const preco = validarCompraDeGelo(antes.guardados, saldo);
  if (!preco.ok) return preco;
  const compras = await repo.listFreezePurchases();
  await repo.saveFreezePurchase({ item: `gelo-${compras.length + 1}`, cost: preco.value, createdAt: clock.now() });
  const depois = await verGelo(repo, clock);
  return depois ? ok(depois) : fail('indisponivel', 'O gelo não está disponível aqui.');
}

export async function marcarGeloVisto(repo: Repository, clock: Clock): Promise<void> {
  if (providesFreezes(repo)) return repo.markFreezesSeen();
  if (!providesFreezeStore(repo)) return;
  const novos = (await repo.listFreezeUses()).filter((use) => use.vistoEm === undefined);
  await repo.saveFreezeUses(novos.map((use) => ({ ...use, vistoEm: clock.now() })));
}
