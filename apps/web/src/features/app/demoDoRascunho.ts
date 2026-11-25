import { DEFAULT_TIMEZONE, JOIAS } from '@pulo/core/config/decisions';
import { MINUTE_MS } from '@pulo/core/domain/clock';
import { addDays, dateKeyOf } from '@pulo/core/domain/day';
import type { Clock, Goal, GoalMilestone, Habit, Repository } from '@pulo/core/domain/types';

const TODOS_OS_DIAS: Habit['weekdays'] = [0, 1, 2, 3, 4, 5, 6];
const DIA_MS = 24 * 60 * MINUTE_MS;

const HABITOS: Habit[] = [
  { id: 'demo-habito-alongar', title: 'Alongar', weekdays: TODOS_OS_DIAS, state: 'ativo' },
  { id: 'demo-habito-ler', title: 'Ler 10 páginas', weekdays: TODOS_OS_DIAS, state: 'ativo' },
  { id: 'demo-habito-caminhar', title: 'Caminhar', weekdays: TODOS_OS_DIAS, state: 'ativo' },
];
const FEITOS_HOJE = ['demo-habito-agua', 'demo-habito-alongar'];

function marcos(meta: string, total: number, feitos: number, quando: number): GoalMilestone[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `${meta}-${i + 1}`,
    title: `Passo ${i + 1}`,
    ...(i < feitos ? { doneAt: quando } : {}),
  }));
}

/** O que o rascunho mostra além das quatro semanas de exemplo: um dia em andamento e três metas. Tudo inventado. */
export async function completarDemo(repo: Repository, clock: Clock): Promise<void> {
  const agora = clock.now();
  const hoje = dateKeyOf(agora, DEFAULT_TIMEZONE);
  for (const h of HABITOS) await repo.saveHabit(h);
  for (const habitId of FEITOS_HOJE) await repo.saveHabitLog({ habitId, date: hoje, doneAt: agora - 600 * MINUTE_MS });
  for (const [i, antes] of [720, 360].entries()) {
    const startedAt = agora - antes * MINUTE_MS;
    await repo.saveSession({
      id: `demo-sessao-hoje-${i + 1}`,
      startedAt,
      endedAt: startedAt + 25 * MINUTE_MS,
      plannedMinutes: 25,
      state: 'concluida',
      pausedMs: 0,
    });
  }

  const createdAt = agora - 30 * DIA_MS;
  const feitoEm = agora - 3 * DIA_MS;
  const metas: Goal[] = [
    {
      id: 'demo-meta-ingles',
      title: 'Terminar o curso de inglês',
      icon: '🎓',
      color: 'agua',
      state: 'ativa',
      createdAt,
      targetDate: addDays(hoje, 40),
      milestones: marcos('demo-meta-ingles', 5, 3, feitoEm),
    },
    {
      id: 'demo-meta-livros',
      title: 'Ler 4 livros no semestre',
      icon: '📚',
      color: 'descanso',
      state: 'ativa',
      createdAt,
      targetDate: addDays(hoje, 90),
      milestones: marcos('demo-meta-livros', 4, 1, feitoEm),
    },
    {
      id: 'demo-meta-corrida',
      title: 'Correr 5 km sem parar',
      icon: '🏃',
      color: 'foco',
      state: 'concluida',
      createdAt,
      completedAt: feitoEm,
      milestones: marcos('demo-meta-corrida', 5, 5, feitoEm),
    },
  ];
  for (const meta of metas) await repo.saveGoal(meta);
  await repo.saveGoalChest({ goalId: 'demo-meta-corrida', abertoEm: feitoEm, joias: JOIAS.por.goalCompleted });
}
