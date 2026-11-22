import type { BlockSlot, Weekday } from '@/domain/types';

export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

export function horaTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function diaCurto(d: Weekday): string {
  return DIAS_CURTOS[d];
}

export function slotTexto(s: BlockSlot): string {
  return `${diaCurto(s.weekday)}, ${horaTexto(s.startMinutes)}, ${s.durationMinutes} min`;
}

export function blocoTexto(inicio: number, duracao: number): string {
  return `${horaTexto(inicio)} a ${horaTexto(inicio + duracao)}`;
}
