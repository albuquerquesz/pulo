import type { Habit } from '@pulo/core/domain/types';
import { habitMapper } from '@pulo/db';

/** O hábito como a API devolve: o do domínio mais `active`, o contrato antigo que o web publicado ainda lê. */
export function habitResponse(habit: Habit) {
  return { ...habit, active: habit.state === 'ativo' };
}

export function habitFromRow(row: Parameters<typeof habitMapper.toDomain>[0]) {
  return habitResponse(habitMapper.toDomain(row));
}
