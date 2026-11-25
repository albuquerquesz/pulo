import { DEFAULT_TIMEZONE, JOIAS, TASKS } from '@pulo/core/config/decisions';
import { MINUTE_MS } from '@pulo/core/domain/clock';
import { addDays, dateKeyOf, weekEndOf } from '@pulo/core/domain/day';
import type { DemoClock } from '@pulo/core/demo';
import type { AccentColor, FocusSession, Goal, GoalMilestone, Habit, Period, Repository, RoutineBlock, Task, TaskStatus } from '@pulo/core/domain/types';

/** O instante do rascunho: sábado, 21/11/2026, 14h38, dentro das quatro semanas de exemplo. */
export const DIA_DO_DEMO = '2026-11-21';
export const MINUTOS_DO_DEMO = 14 * 60 + 38;

const TODOS_OS_DIAS: Habit['weekdays'] = [0, 1, 2, 3, 4, 5, 6];

function habito(
  id: string,
  title: string,
  weekdays: Habit['weekdays'],
  icon: string,
  color: AccentColor,
  period: Period,
  reminderMinutes?: number,
): Habit {
  const lembrete = reminderMinutes === undefined ? {} : { reminderMinutes, reminderOn: true };
  return { id, title, weekdays, state: 'ativo', icon, color, period, ...lembrete };
}
const SABADO: RoutineBlock['weekday'] = 5;
const DIA_MS = 24 * 60 * MINUTE_MS;

/** Ícone, cor, período e lembrete da página de Hábitos do rascunho. A meta é atrelada depois que as metas existem. */
const HABITOS: Habit[] = [
  habito('demo-habito-agua', 'Beber água', TODOS_OS_DIAS, '💧', 'agua', 'manha', 7 * 60 + 30),
  habito('demo-habito-alongar', 'Alongar', TODOS_OS_DIAS, '🧘', 'sapo', 'manha', 7 * 60 + 45),
  habito('demo-habito-ler', 'Ler 10 páginas', TODOS_OS_DIAS, '📖', 'descanso', 'noite', 21 * 60),
  habito('demo-habito-caminhar', 'Caminhar', [0, 2, 4, 5], '🚶', 'foco', 'manha'),
  // Não cai no sábado: no Hoje aparece só como o hábito atrelado ao próximo foco.
  habito('demo-habito-ingles', 'Estudar inglês', [0, 1, 2, 3, 4], '🎓', 'agua', 'tarde', 14 * 60 + 30),
];
const META_DO_HABITO: Record<string, string> = {
  'demo-habito-caminhar': 'demo-meta-corrida',
  'demo-habito-ingles': 'demo-meta-ingles',
  'demo-habito-ler': 'demo-meta-livros',
};
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

interface TarefaDoDemo {
  titulo: string;
  coluna: TaskStatus;
  prazo?: 'hoje' | 'semana';
  descricao?: string;
  alta?: boolean;
  etiquetas: string[];
  /** Pomodoros feitos e estimados. */
  pomodoros?: [number, number];
  /** Título e se está feita. */
  subtarefas?: [string, boolean][];
}

/** As tarefas do rascunho. */
const TAREFAS: TarefaDoDemo[] = [
  {
    titulo: 'Resumo do capítulo 3 de Bioquímica',
    coluna: 'fazendo',
    prazo: 'hoje',
    descricao: 'Focar em metabolismo de carboidratos. Usar o PDF da aula de terça e os slides do professor.',
    alta: true,
    etiquetas: ['Faculdade'],
    pomodoros: [1, 3],
    subtarefas: [
      ['Ler seção 3.1', true],
      ['Ler seção 3.2', true],
      ['Mapa mental', false],
      ['Fichamento', false],
      ['Revisar com flashcards', false],
    ],
  },
  {
    titulo: 'Exercícios da unidade 4',
    coluna: 'afazer',
    prazo: 'hoje',
    etiquetas: ['🎓 Estudar inglês'],
    pomodoros: [0, 2],
    subtarefas: [
      ['Listening', false],
      ['Grammar', false],
    ],
  },
  { titulo: 'Responder e-mail do orientador', coluna: 'afazer', prazo: 'hoje', alta: true, etiquetas: ['Faculdade'], pomodoros: [0, 1] },
  { titulo: 'Marcar dentista', coluna: 'afazer', prazo: 'semana', etiquetas: ['Pessoal'] },
  {
    titulo: 'Escolher próximo livro',
    coluna: 'ideias',
    etiquetas: ['📚 Ler 4 livros'],
    subtarefas: [
      ['Pedir indicações', false],
      ['Ver lista da biblioteca', false],
    ],
  },
  { titulo: 'Montar plano de corrida de 10 km', coluna: 'ideias', etiquetas: ['Saúde'], pomodoros: [0, 1] },
  { titulo: 'Revisar tarefas da semana', coluna: 'feito', prazo: 'hoje', etiquetas: ['Rotina'], pomodoros: [1, 1] },
  {
    titulo: 'Entregar relatório de estágio',
    coluna: 'feito',
    prazo: 'semana',
    etiquetas: ['Faculdade'],
    pomodoros: [3, 3],
    subtarefas: [
      ['Introdução', true],
      ['Atividades', true],
      ['Conclusão', true],
    ],
  },
];

/** Os pomodoros de exemplo são curtos: contam na tarefa sem mexer no saldo de joias do rascunho. */
const MINUTOS_DO_POMODORO_DE_EXEMPLO = 1;

/** Grava as tarefas como criadas há três dias e movidas ontem, para a atividade ter história. */
async function criarTarefas(repo: Repository, clock: DemoClock): Promise<void> {
  const hoje = dateKeyOf(clock.now(), DEFAULT_TIMEZONE);
  for (const [i, t] of TAREFAS.entries()) {
    const id = `demo-tarefa-${i + 1}`;
    const base: Task = {
      id,
      title: t.titulo,
      status: 'ideias',
      position: (i + 1) * TASKS.positionStep,
      priority: t.alta ? 'alta' : 'normal',
      tags: t.etiquetas,
      pomodorosEstimated: t.pomodoros?.[1] ?? 0,
      createdAt: clock.now() - 3 * DIA_MS,
      ...(t.descricao ? { description: t.descricao } : {}),
      ...(t.prazo ? { dueDate: t.prazo === 'hoje' ? hoje : weekEndOf(hoje) } : {}),
    };
    clock.advanceDays(-3);
    await repo.saveTask(base);
    clock.advanceDays(2);
    if (t.coluna !== 'ideias') {
      await repo.saveTask({ ...base, status: t.coluna, ...(t.coluna === 'feito' ? { completedAt: clock.now() } : {}) });
    }
    clock.advanceDays(1);

    for (const [j, [titulo, feita]] of (t.subtarefas ?? []).entries()) {
      await repo.saveSubtask({ id: `${id}-sub-${j + 1}`, taskId: id, title: titulo, done: feita, position: (j + 1) * TASKS.positionStep });
    }
    for (let j = 0; j < (t.pomodoros?.[0] ?? 0); j += 1) {
      const startedAt = clock.now() - 2 * DIA_MS - (j + 1) * 60 * MINUTE_MS;
      await repo.saveSession({
        id: `${id}-pomodoro-${j + 1}`,
        taskId: id,
        startedAt,
        endedAt: startedAt + MINUTOS_DO_POMODORO_DE_EXEMPLO * MINUTE_MS,
        plannedMinutes: MINUTOS_DO_POMODORO_DE_EXEMPLO,
        state: 'concluida',
        pausedMs: 0,
      });
    }
  }
}

/** Os marcos feitos ficam espaçados de dez em dez dias, o último em `ultimo`. */
function marcos(meta: string, titulos: string[], feitos: number, ultimo: number): GoalMilestone[] {
  return titulos.map((title, i) => ({
    id: `${meta}-${i + 1}`,
    title,
    ...(i < feitos ? { doneAt: ultimo - (feitos - 1 - i) * 10 * DIA_MS } : {}),
  }));
}

function sessaoConcluida(id: string, blockId: string, startedAt: number): FocusSession {
  return { id, blockId, startedAt, endedAt: startedAt + 25 * MINUTE_MS, plannedMinutes: 25, state: 'concluida', pausedMs: 0 };
}

/** O que o rascunho mostra além das quatro semanas de exemplo: um dia em andamento, tarefas e três metas. Tudo inventado. */
export async function completarDemo(repo: Repository, clock: DemoClock): Promise<void> {
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

  await criarTarefas(repo, clock);

  const feitoEm = agora - 3 * DIA_MS;
  // A idade e o prazo de cada meta dão o ritmo do rascunho: uma em dia e uma um pouco atrás.
  const metas: Goal[] = [
    {
      id: 'demo-meta-ingles',
      title: 'Terminar o curso de inglês',
      why: 'Quero viajar pro Canadá sem travar na conversa.',
      icon: '🎓',
      color: 'agua',
      state: 'ativa',
      createdAt: agora - 43 * DIA_MS,
      targetDate: addDays(hoje, 40),
      milestones: marcos('demo-meta-ingles', ['Unidade 1', 'Unidade 2', 'Unidade 3', 'Unidade 4', 'Prova final'], 3, feitoEm),
    },
    {
      id: 'demo-meta-livros',
      title: 'Ler 4 livros no semestre',
      why: 'Voltar a ler por prazer, não só pra faculdade.',
      icon: '📚',
      color: 'descanso',
      state: 'ativa',
      createdAt: agora - 90 * DIA_MS,
      targetDate: addDays(hoje, 90),
      milestones: marcos('demo-meta-livros', ['O Pequeno Príncipe', 'Dom Casmurro', 'Livro 3', 'Livro 4'], 1, feitoEm),
    },
    {
      id: 'demo-meta-corrida',
      title: 'Correr 5 km sem parar',
      why: 'Ter fôlego pra brincar com meu sobrinho.',
      icon: '🏃',
      color: 'foco',
      state: 'concluida',
      createdAt: agora - 90 * DIA_MS,
      completedAt: feitoEm,
      milestones: marcos('demo-meta-corrida', ['1 km', '2 km', '3 km', '4 km', '5 km'], 5, feitoEm),
    },
  ];
  for (const meta of metas) await repo.saveGoal(meta);
  for (const h of HABITOS) {
    const goalId = META_DO_HABITO[h.id];
    if (goalId) await repo.saveHabit({ ...h, goalId });
  }
  await repo.saveGoalChest({ goalId: 'demo-meta-corrida', abertoEm: feitoEm, joias: JOIAS.por.goalCompleted });
}
