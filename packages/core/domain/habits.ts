import { DEFAULT_TIMEZONE, HABITS, MAX_HABITS_PER_DAY } from '../config/decisions';
import { newId } from './ids';
import { fail, ok, type Result } from './result';
import { addDays, dateKeyOf, weekdayOf } from './day';
import type { DateKey, EntityId, Habit, HabitLog, HabitState, Repository, Weekday } from './types';

export type HabitDayErrorCode = 'data_no_futuro' | 'data_antiga' | 'data_antes_do_habito' | 'habito_arquivado' | 'dia_fora_do_habito';
export type HabitErrorCode =
  | 'titulo_vazio'
  | 'dias_invalidos'
  | 'limite_por_dia'
  | 'habito_inexistente'
  | 'data_invalida'
  | 'meta_inexistente'
  | HabitDayErrorCode;

/** Campos de apresentação (spec 17). Na edição, `undefined` mantém e `null` tira. */
export interface HabitLook {
  icon?: Habit['icon'] | null;
  color?: Habit['color'] | null;
  period?: Habit['period'] | null;
  reminderMinutes?: number | null;
  reminderOn?: boolean;
}

export interface HabitInput extends HabitLook {
  title: string;
  weekdays: Weekday[];
}

/**
 * O estado que vale numa escrita. `state` vence. Sem ele vale o `active` do contrato antigo: `true` ativa e `false`
 * mantém um hábito que já estava fora (pausado ou arquivado) e arquiva um ativo, como na migração. Sem nenhum, fica o gravado.
 */
export function resolveHabitState(sent: { state?: HabitState; active?: boolean }, stored?: HabitState): HabitState {
  if (sent.state !== undefined) return sent.state;
  if (sent.active === undefined) return stored ?? 'ativo';
  if (sent.active) return 'ativo';
  return stored === undefined || stored === 'ativo' ? 'arquivado' : stored;
}

/** Junta a escrita ao hábito: tira os campos nulos e desliga o lembrete sem horário. */
function applyLook(habit: Habit, look: HabitLook): Habit {
  const next: Habit = { ...habit };
  if (look.icon !== undefined) next.icon = look.icon ?? undefined;
  if (look.color !== undefined) next.color = look.color ?? undefined;
  if (look.period !== undefined) next.period = look.period ?? undefined;
  if (look.reminderMinutes !== undefined) next.reminderMinutes = look.reminderMinutes ?? undefined;
  if (look.reminderOn !== undefined) next.reminderOn = look.reminderOn;
  if (!next.icon) delete next.icon;
  if (next.color === undefined) delete next.color;
  if (next.period === undefined) delete next.period;
  if (next.reminderMinutes === undefined) delete next.reminderMinutes;
  if (!next.reminderOn || next.reminderMinutes === undefined) delete next.reminderOn;
  return next;
}

function validWeekday(d: number): d is Weekday {
  return Number.isInteger(d) && d >= 0 && d <= 6;
}

function normalizeWeekdays(days: Weekday[]): Weekday[] {
  return [...new Set(days)].sort((a, b) => a - b) as Weekday[];
}

/** Hábitos ativos que valem para uma data (pelo dia da semana). */
export function habitsForDate(habits: readonly Habit[], date: DateKey): Habit[] {
  const wd = weekdayOf(date);
  return habits.filter((h) => h.state === 'ativo' && h.weekdays.includes(wd));
}

function checkRules(
  input: HabitInput,
  others: readonly Habit[],
): Result<{ title: string; weekdays: Weekday[] }, HabitErrorCode> {
  const title = input.title.trim();
  if (!title) return fail('titulo_vazio', 'Dê um nome ao hábito.');
  const weekdays = normalizeWeekdays(input.weekdays);
  if (weekdays.length === 0 || !weekdays.every(validWeekday)) {
    return fail('dias_invalidos', 'Escolha pelo menos um dia da semana.');
  }
  for (const wd of weekdays) {
    const count = others.filter((h) => h.state === 'ativo' && h.weekdays.includes(wd)).length;
    if (count >= MAX_HABITS_PER_DAY) {
      return fail('limite_por_dia', `Um dia comporta até ${MAX_HABITS_PER_DAY} hábitos. Que tal deixar um para outro dia?`);
    }
  }
  return ok({ title, weekdays });
}

export async function criarHabito(repo: Repository, input: HabitInput, now: number): Promise<Result<Habit, HabitErrorCode>> {
  const habits = await repo.listHabits();
  const checked = checkRules(input, habits);
  if (!checked.ok) return checked;
  const habit = applyLook({ id: newId(now, 'habito'), ...checked.value, state: 'ativo' }, input);
  await repo.saveHabit(habit);
  return ok(habit);
}

export async function editarHabito(
  repo: Repository,
  id: EntityId,
  patch: Partial<HabitInput & { state: HabitState }>,
): Promise<Result<Habit, HabitErrorCode>> {
  const habits = await repo.listHabits();
  const current = habits.find((h) => h.id === id);
  if (!current) return fail('habito_inexistente', 'Hábito não encontrado.');
  const state = patch.state ?? current.state;
  const input = { title: patch.title ?? current.title, weekdays: patch.weekdays ?? current.weekdays };
  const others = state === 'ativo' ? habits.filter((h) => h.id !== id) : [];
  const checked = checkRules(input, others);
  if (!checked.ok) return checked;
  // A meta atrelada fica: quem muda o vínculo é `atrelarHabito`.
  const habit = applyLook({ ...current, ...checked.value, state }, patch);
  await repo.saveHabit(habit);
  return ok(habit);
}

/** Atrela o hábito a uma meta (troca a anterior) ou solta, com `goalId` nulo. */
export async function atrelarHabito(repo: Repository, id: EntityId, goalId: EntityId | null): Promise<Result<Habit, HabitErrorCode>> {
  const [habits, goals] = await Promise.all([repo.listHabits(), repo.listGoals()]);
  const current = habits.find((h) => h.id === id);
  if (!current) return fail('habito_inexistente', 'Hábito não encontrado.');
  if (goalId !== null && !goals.some((g) => g.id === goalId)) return fail('meta_inexistente', 'Essa meta não existe mais.');
  const { goalId: _anterior, ...rest } = current;
  const habit: Habit = goalId === null ? rest : { ...rest, goalId };
  await repo.saveHabit(habit);
  return ok(habit);
}

export async function removerHabito(repo: Repository, id: EntityId): Promise<void> {
  await repo.deleteHabit(id);
}

export interface RegistroDeHabito {
  habit: Pick<Habit, 'weekdays' | 'state'>;
  date: DateKey;
  now: number;
  timeZone: string;
  /** Começo do dia da pessoa, em minutos desde 00:00. Ausente: a virada do app. */
  dayStartMinutes?: number;
  /** Quando o hábito foi criado (só o servidor sabe). */
  createdAt?: number;
}

/**
 * Se o hábito pode ser marcado nesse dia: ativo ou pausado, num dia da frequência, não no futuro, não antes de existir
 * e dentro de `HABITS.registroMaxDiasAtras`. Entre a virada do app e o começo do dia da pessoa valem os dois dias.
 */
export function validarDiaDoRegistro(registro: RegistroDeHabito): Result<DateKey, HabitDayErrorCode> {
  const { habit, date, now, timeZone, dayStartMinutes, createdAt } = registro;
  const dias = (instante: number) =>
    [dateKeyOf(instante, timeZone), dateKeyOf(instante, timeZone, dayStartMinutes)].sort();
  const [maisCedo, maisTarde] = dias(now);
  if (date > maisTarde) return fail('data_no_futuro', 'Esse dia ainda não chegou.');
  if (date < addDays(maisCedo, -HABITS.registroMaxDiasAtras)) {
    return fail('data_antiga', `Dá para marcar até ${HABITS.registroMaxDiasAtras} dias atrás.`);
  }
  if (createdAt !== undefined && date < dias(createdAt)[0]) return fail('data_antes_do_habito', 'O hábito ainda não existia nesse dia.');
  if (habit.state === 'arquivado') return fail('habito_arquivado', 'Esse hábito está arquivado.');
  if (!habit.weekdays.includes(weekdayOf(date))) return fail('dia_fora_do_habito', 'Esse hábito não vale nesse dia da semana.');
  return ok(date);
}

/** Marca como feito. Uma única marca por hábito e dia: repetir mantém a primeira. */
export async function marcarHabito(
  repo: Repository,
  habitId: EntityId,
  date: DateKey,
  now: number,
): Promise<Result<HabitLog, HabitErrorCode>> {
  const habit = (await repo.listHabits()).find((h) => h.id === habitId);
  if (!habit) return fail('habito_inexistente', 'Hábito não encontrado.');
  const existing = (await repo.listHabitLogs({ from: date, to: date })).find((l) => l.habitId === habitId);
  if (existing) return ok(existing);
  const user = await repo.getUser();
  const dia = validarDiaDoRegistro({
    habit,
    date,
    now,
    timeZone: user?.timezone ?? DEFAULT_TIMEZONE,
    dayStartMinutes: user?.dayStartMinutes,
  });
  if (!dia.ok) return dia;
  const log: HabitLog = { habitId, date, doneAt: now };
  await repo.saveHabitLog(log);
  return ok(log);
}

export async function desmarcarHabito(repo: Repository, habitId: EntityId, date: DateKey): Promise<void> {
  await repo.deleteHabitLog(habitId, date);
}
