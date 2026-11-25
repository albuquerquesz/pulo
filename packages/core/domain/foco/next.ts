import { DAY_ROLLOVER_HOUR } from '../../config/decisions';
import { MINUTE_MS } from '../clock';
import { dateKeyOf, localMinutesOf, weekdayOf } from '../day';
import { focusedMs } from '../joias';
import { blocksForWeekday } from '../routine';
import type { DateKey, FocusSession, RoutineBlock } from '../types';
import { elapsedFocusMs, hasTimeRunOut } from './timer';

export type NextFocusState = 'em_andamento' | 'agora' | 'depois';

export interface NextFocus {
  bloco: RoutineBlock;
  /** `em_andamento`: já há um foco aberto neste bloco; `agora`: está no horário dele; `depois`: ainda vai começar. */
  estado: NextFocusState;
  /** A intenção da sessão aberta ou, sem ela, o título do bloco. */
  intencao?: string;
  /** A sessão aberta, em `em_andamento`. */
  sessaoId?: string;
}

export interface NextFocusInput {
  blocks: readonly RoutineBlock[];
  sessions: readonly FocusSession[];
  now: number;
  timeZone: string;
}

const MINUTES_PER_DAY = 24 * 60;

/** Minutos desde 00:00 do dia lógico: a madrugada antes da virada continua o dia anterior. */
function logicalMinutes(now: number, timeZone: string): number {
  const minutes = localMinutesOf(now, timeZone);
  return minutes < DAY_ROLLOVER_HOUR * 60 ? minutes + MINUTES_PER_DAY : minutes;
}

/**
 * O próximo foco de hoje (cartão do Hoje e Linha do dia): o bloco de foco aberto agora ou, senão, o primeiro que ainda
 * não acabou e não foi concluído. Interrompido continua valendo enquanto o horário não passa. `null` quando não resta nenhum.
 */
export function proximoFoco({ blocks, sessions, now, timeZone }: NextFocusInput): NextFocus | null {
  const today = dateKeyOf(now, timeZone);
  const focus = blocksForWeekday(blocks, weekdayOf(today)).filter((block) => block.kind === 'foco');
  const open = sessions.find((s) => s.state === 'em_andamento' && !hasTimeRunOut(s, now));
  const running = focus.find((block) => block.id === open?.blockId);
  if (open && running) return card(running, 'em_andamento', open.intention, open.id);

  // Uma sessão cujo tempo acabou e ainda não foi fechada já vale como concluída.
  const done = new Set(
    sessions
      .filter((s) => (s.state === 'concluida' || hasTimeRunOut(s, now)) && dateKeyOf(s.startedAt, timeZone) === today)
      .map((s) => s.blockId),
  );
  const minutes = logicalMinutes(now, timeZone);
  const next = focus.find((block) => !done.has(block.id) && block.startMinutes + block.durationMinutes > minutes);
  return next ? card(next, next.startMinutes <= minutes ? 'agora' : 'depois') : null;
}

function card(bloco: RoutineBlock, estado: NextFocusState, intention?: string, sessaoId?: string): NextFocus {
  const intencao = intention ?? bloco.title;
  return { bloco, estado, ...(intencao ? { intencao } : {}), ...(sessaoId ? { sessaoId } : {}) };
}

export interface DailyFocus {
  /** Minutos inteiros focados no dia lógico, contando o foco aberto até agora. */
  minutos: number;
  /** `null` sem meta diária. */
  meta: number | null;
  /** De 0 a 1; `null` sem meta. */
  fracao: number | null;
}

/** A barra da meta diária de foco. Calculada, nunca gravada. */
export function focoDoDia(
  sessions: readonly FocusSession[],
  meta: number | null,
  day: DateKey,
  now: number,
  timeZone: string,
): DailyFocus {
  const ms = sessions.reduce((total, s) => {
    if (dateKeyOf(s.endedAt ?? now, timeZone) !== day) return total;
    return total + (s.state === 'em_andamento' ? elapsedFocusMs(s, now) : focusedMs(s));
  }, 0);
  const minutos = Math.floor(ms / MINUTE_MS);
  return { minutos, meta, fracao: meta === null ? null : Math.min(1, minutos / meta) };
}
