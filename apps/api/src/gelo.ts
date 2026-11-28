import { reconcileSession } from '@pulo/core/domain/foco/timer';
import { acertarGelo } from '@pulo/core/domain/gelo';
import { computeMascotState } from '@pulo/core/domain/phase';
import type { MascotState } from '@pulo/core/domain/types';
import { type Db, dateKeyToDate, dateToDateKey, focusSessionMapper, mascotStateMapper, restDayMapper } from '@pulo/db';
import type { SessionUser } from './http';
import { type StreakRows, freezeReads, refreshMascot, streakInput, streakReads } from './queries';
import { sessionSelect } from './selects';

export interface AcertoGravado {
  /** Os dias protegidos, já com os gastos agora. */
  freezeUses: StreakRows['freezeUses'];
  /** As sessões encerradas, já com o foco vencido que este acerto fechou. */
  sessions: StreakRows['sessions'];
  /** O estado do sapo, só quando o acerto criou a linha dele. */
  mascot?: MascotState;
}

type AcertoRows = StreakRows & {
  gelosComprados: number;
  resolvido: { geloResolvidoAte: Date | null } | null;
};

/**
 * O acerto preguiçoso do gelo (não há job): gasta os gelos dos dias fechados e guarda o último resolvido no cache do
 * sapo. Recebe as linhas já lidas e só escreve quando há o que mudar (no máximo uma vez por dia). Rodar de novo, ou duas
 * vezes ao mesmo tempo, não gasta de novo (`skipDuplicates`).
 */
export async function acertarGelos(db: Db, person: SessionUser, now: number, rows: AcertoRows): Promise<AcertoGravado> {
  const { id: userId, metadata } = person;
  const anterior = rows.resolvido?.geloResolvidoAte ?? null;
  const calcular = (sessions: AcertoRows['sessions']) =>
    acertarGelo({
      ...streakInput(metadata, now, { ...rows, sessions }),
      compras: rows.gelosComprados,
      resolvidoAte: anterior === null ? null : dateToDateKey(anterior),
    });
  let sessions = rows.sessions;
  let acerto = calcular(sessions);
  // Antes de resolver os dias fechados (e gastar gelo): um foco vencido que o app não fechou pode ter cuidado de um deles.
  if (anterior !== null && acerto.mudou) {
    const encerrada = await encerrarFocoVencido(db, person, now);
    if (encerrada) {
      sessions = [...sessions, encerrada];
      acerto = calcular(sessions);
    }
  }
  if (!acerto.mudou) return { freezeUses: rows.freezeUses, sessions };

  const novos = acerto.proteger.map(dateKeyToDate);
  const geloResolvidoAte = dateKeyToDate(acerto.resolvidoAte);
  const mascot = computeMascotState(
    sessions.map(focusSessionMapper.toDomain),
    rows.restDays.map(restDayMapper.toDomain),
    metadata.timezone,
    null,
    now,
  );
  await db.$transaction([
    db.freezeUse.createMany({ data: novos.map((date) => ({ userId, date })), skipDuplicates: true }),
    db.mascotState.upsert({
      where: { userId },
      create: { ...mascotStateMapper.fromDomain(userId, mascot), geloResolvidoAte },
      update: { geloResolvidoAte },
      select: { userId: true },
    }),
  ]);
  return {
    freezeUses: [...rows.freezeUses, ...novos.map((date) => ({ date, vistoEm: null }))],
    sessions,
    ...(rows.resolvido === null ? { mascot } : {}),
  };
}

/** Grava o fim (o planejado) do foco em andamento que o relógio já encerrou. Devolve a linha fechada. */
async function encerrarFocoVencido(db: Db, { id: userId, metadata }: SessionUser, now: number) {
  const row = await db.focusSession.findFirst({ where: { userId, state: 'em_andamento' }, select: sessionSelect });
  if (!row) return null;
  const aberta = focusSessionMapper.toDomain(row);
  const fechada = reconcileSession(aberta, now);
  if (fechada === aberta) return null;
  const { id: _id, userId: _owner, ...data } = focusSessionMapper.fromDomain(userId, fechada);
  const [salva] = await db.focusSession.updateManyAndReturn({
    where: { userId, id: fechada.id, state: 'em_andamento' },
    data,
    select: sessionSelect,
  });
  if (!salva) return null;
  await refreshMascot(db, userId, metadata.timezone, now);
  return salva;
}

/** Lê o que o acerto precisa e acerta. Devolve as linhas da sequência já atualizadas e quantos gelos foram comprados. */
export async function acertarGeloDaPessoa(db: Db, person: SessionUser, now: number) {
  const [habitDays, sessions, restDays, freezeUses, gelosComprados, resolvido] = await db.$transaction([
    ...streakReads(db, person.id),
    ...freezeReads(db, person.id),
  ]);
  const rows = { habitDays, sessions, restDays, freezeUses, gelosComprados, resolvido };
  const acerto = await acertarGelos(db, person, now, rows);
  return { ...rows, sessions: acerto.sessions, freezeUses: acerto.freezeUses };
}
