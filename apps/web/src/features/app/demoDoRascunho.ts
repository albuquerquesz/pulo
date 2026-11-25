import { DEFAULT_TIMEZONE, JOIAS, TASKS } from '@pulo/core/config/decisions';
import { MINUTE_MS } from '@pulo/core/domain/clock';
import { addDays, dateKeyOf } from '@pulo/core/domain/day';
import type { Clock, FocusSession, Goal, GoalMilestone, Habit, Repository, RoutineBlock, TaskStatus } from '@pulo/core/domain/types';

/** O instante do rascunho: sábado, 21/11/2026, 14h38, dentro das quatro semanas de exemplo. */
export const DIA_DO_DEMO = '2026-11-21';
export const MINUTOS_DO_DEMO = 14 * 60 + 38;

const TODOS_OS_DIAS: Habit['weekdays'] = [0, 1, 2, 3, 4, 5, 6];
const SABADO: RoutineBlock['weekday'] = 5;
const DIA_MS = 24 * 60 * MINUTE_MS;

const HABITOS: Habit[] = [
  { id: 'demo-habito-alongar', title: 'Alongar', weekdays: TODOS_OS_DIAS, state: 'ativo', period: 'manha' },
  { id: 'demo-habito-ler', title: 'Ler 10 páginas', weekdays: TODOS_OS_DIAS, state: 'ativo', period: 'noite' },
  { id: 'demo-habito-caminhar', title: 'Caminhar', weekdays: [0, 2, 4, 5], state: 'ativo' },
  // Não cai no sábado: aparece só como o hábito atrelado ao próximo foco.
  { id: 'demo-habito-ingles', title: 'Estudar inglês', icon: '🎓', weekdays: [0, 2], state: 'ativo' },
];
const FEITOS_HOJE = ['demo-habito-agua', 'demo-habito-alongar'];

function bloco(id: string, hora: number, minuto: number, durationMinutes: number, title: string, icon: string): RoutineBlock {
  const kind = id === 'demo-bloco-descanso' ? 'descanso' : 'foco';
  return { id, weekday: SABADO, startMinutes: hora * 60 + minuto, durationMinutes, kind, title, icon };
}

/** A Linha do dia do rascunho. */
const BLOCOS: RoutineBlock[] = [
  bloco('demo-bloco-revisar', 8, 0, 15, 'Revisar tarefas', '📝'),
  bloco('demo-bloco-projeto', 10, 0, 25, 'Projeto da faculdade', '💻'),
  bloco('demo-bloco-ingles', 14, 30, 25, 'Estudar inglês', '🎓'),
  bloco('demo-bloco-artigo', 17, 0, 25, 'Ler artigo', '📖'),
  bloco('demo-bloco-descanso', 20, 0, 60, 'Descanso', '🛋️'),
];

/** As tarefas do rascunho: título, coluna e se o prazo é hoje. */
const TAREFAS: [string, TaskStatus, boolean][] = [
  ['Resumo do capítulo 3 de Bioquímica', 'fazendo', true],
  ['Exercícios da unidade 4', 'afazer', true],
  ['Responder e-mail do orientador', 'afazer', true],
  ['Marcar dentista', 'afazer', false],
  ['Escolher próximo livro', 'ideias', false],
  ['Montar plano de corrida de 10 km', 'ideias', false],
  ['Revisar tarefas da semana', 'feito', true],
  ['Entregar relatório de estágio', 'feito', false],
];

function marcos(meta: string, total: number, feitos: number, quando: number): GoalMilestone[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `${meta}-${i + 1}`,
    title: `Passo ${i + 1}`,
    ...(i < feitos ? { doneAt: quando } : {}),
  }));
}

function sessaoConcluida(id: string, blockId: string, startedAt: number): FocusSession {
  return { id, blockId, startedAt, endedAt: startedAt + 25 * MINUTE_MS, plannedMinutes: 25, state: 'concluida', pausedMs: 0 };
}

/** O que o rascunho mostra além das quatro semanas de exemplo: um dia em andamento, tarefas e três metas. Tudo inventado. */
export async function completarDemo(repo: Repository, clock: Clock): Promise<void> {
  const agora = clock.now();
  const hoje = dateKeyOf(agora, DEFAULT_TIMEZONE);
  for (const h of HABITOS) await repo.saveHabit(h);
  for (const habitId of FEITOS_HOJE) await repo.saveHabitLog({ habitId, date: hoje, doneAt: agora - 360 * MINUTE_MS });
  // Fecha o domingo que faltava: a sequência fica em 12 dias, como no rascunho.
  const domingo = addDays(hoje, -6);
  await repo.saveHabitLog({ habitId: 'demo-habito-agua', date: domingo, doneAt: agora - 6 * DIA_MS });

  // O sábado dos dados de exemplo é de descanso; aqui ele vira o dia em andamento do rascunho.
  await repo.deleteRestDay(hoje);
  await repo.deleteBlock('demo-bloco-descanso-5');
  for (const b of BLOCOS) await repo.saveBlock(b);
  for (const [blockId, inicio] of [
    ['demo-bloco-revisar', 8 * 60],
    ['demo-bloco-projeto', 10 * 60],
  ] as const) {
    await repo.saveSession(sessaoConcluida(`demo-sessao-hoje-${blockId}`, blockId, agora - (MINUTOS_DO_DEMO - inicio) * MINUTE_MS));
  }
  // O foco de ontem neste bloco dá o hábito atrelado ao próximo foco.
  await repo.saveSession({
    ...sessaoConcluida('demo-sessao-ingles', 'demo-bloco-ingles', agora - DIA_MS - 60 * MINUTE_MS),
    habitId: 'demo-habito-ingles',
  });

  for (const [i, [title, status, deHoje]] of TAREFAS.entries()) {
    await repo.saveTask({
      id: `demo-tarefa-${i + 1}`,
      title,
      status,
      position: (i + 1) * TASKS.positionStep,
      priority: 'normal',
      tags: [],
      pomodorosEstimated: 0,
      createdAt: agora - 3 * DIA_MS,
      ...(deHoje ? { dueDate: hoje } : {}),
      ...(status === 'feito' ? { completedAt: agora - 60 * MINUTE_MS } : {}),
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
