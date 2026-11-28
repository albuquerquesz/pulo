import { FOCUS } from '../../config/decisions';
import { DAY_MS } from '../clock';
import { effectiveMs } from '../care-days';
import { fail, ok, type Result } from '../result';
import type { FocusSession } from '../types';
import { plannedMs } from './timer';

export type RegistroDeFocoErrorCode = 'foco_antigo_demais' | 'foco_incompleto' | 'foco_sobreposto';

const TOLERANCIA_MS = FOCUS.toleranciaSegundos * 1000;

type Intervalo = Pick<FocusSession, 'startedAt' | 'endedAt'>;

/** Sessão em andamento ocupa até agora. */
const fim = (s: Intervalo, now: number) => s.endedAt ?? Math.max(now, s.startedAt);

export interface RegistroDeFoco {
  session: FocusSession;
  /** Ainda não gravada: só ela precisa ter começado há pouco. */
  nova: boolean;
  /** As outras sessões da pessoa que podem cruzar com esta. */
  outras: readonly FocusSession[];
  now: number;
}

/**
 * Confere uma sessão antes de gravar: começo recente, concluída só com o tempo planejado focado (com
 * `toleranciaSegundos` de folga) e sem cruzar com outra.
 */
export function validarRegistroDeFoco({ session, nova, outras, now }: RegistroDeFoco): Result<FocusSession, RegistroDeFocoErrorCode> {
  if (nova && session.startedAt < now - FOCUS.inicioMaxDiasAtras * DAY_MS) {
    return fail('foco_antigo_demais', `Só dá para registrar focos dos últimos ${FOCUS.inicioMaxDiasAtras} dias.`);
  }
  if (session.state === 'concluida' && effectiveMs(session) < plannedMs(session) - TOLERANCIA_MS) {
    return fail('foco_incompleto', 'O tempo planejado ainda não foi focado.');
  }
  const cruza = outras.some(
    (outra) =>
      outra.id !== session.id &&
      Math.min(fim(session, now), fim(outra, now)) - Math.max(session.startedAt, outra.startedAt) > TOLERANCIA_MS,
  );
  if (cruza) return fail('foco_sobreposto', 'Já existe um foco registrado nesse horário.');
  return ok(session);
}
