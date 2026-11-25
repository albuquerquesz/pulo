import { acertarGelo } from '@pulo/core/domain/gelo';
import { computeMascotState } from '@pulo/core/domain/phase';
import type { MascotState } from '@pulo/core/domain/types';
import { type Db, dateKeyToDate, dateToDateKey, focusSessionMapper, mascotStateMapper, restDayMapper } from '@pulo/db';
import type { SessionUser } from './http';
import { type StreakRows, freezeReads, streakInput, streakReads } from './queries';

export interface AcertoGravado {
  /** Os dias protegidos, já com os gastos agora. */
  freezeUses: StreakRows['freezeUses'];
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
  const acerto = acertarGelo({
    ...streakInput(metadata, now, rows),
    compras: rows.gelosComprados,
    resolvidoAte: anterior === null ? null : dateToDateKey(anterior),
  });
  if (!acerto.mudou) return { freezeUses: rows.freezeUses };

  const novos = acerto.proteger.map(dateKeyToDate);
  const geloResolvidoAte = dateKeyToDate(acerto.resolvidoAte);
  const mascot = computeMascotState(
    rows.sessions.map(focusSessionMapper.toDomain),
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
    ...(rows.resolvido === null ? { mascot } : {}),
  };
}

/** Lê o que o acerto precisa e acerta. Devolve as linhas da sequência já atualizadas e quantos gelos foram comprados. */
export async function acertarGeloDaPessoa(db: Db, person: SessionUser, now: number) {
  const [habitDays, sessions, restDays, freezeUses, gelosComprados, resolvido] = await db.$transaction([
    ...streakReads(db, person.id),
    ...freezeReads(db, person.id),
  ]);
  const rows = { habitDays, sessions, restDays, freezeUses, gelosComprados, resolvido };
  const acerto = await acertarGelos(db, person, now, rows);
  return { ...rows, freezeUses: acerto.freezeUses };
}
