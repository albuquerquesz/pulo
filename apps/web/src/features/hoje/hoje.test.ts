import { createMemoryRepository } from '@/data';
import { fixedClock } from '@pulo/core/domain/clock';
import { endedSession, sp } from '@pulo/core/domain/test-utils';
import type { RoutineBlock, StreakDay, StreakDayState, Task } from '@pulo/core/domain/types';

import { concluirOnboarding } from '../app/core';
import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';
import {
  alternarHabito,
  alternarTarefa,
  barraDaSemana,
  carregarHoje,
  duracaoTexto,
  graficoDaSemana,
  horaCheia,
  linhaDoDia,
  posicaoDoAgora,
  quandoDoHabito,
  saudacao,
  tarefasDeHoje,
  textoDeFolga,
  vinculoDoBloco,
  momentoDaSequencia,
} from './logic';

const FUSO = 'America/Sao_Paulo';
// semana de domingo 15/11 a sábado 21/11/2026
const semana = (estados: StreakDayState[]): StreakDay[] => estados.map((estado, i) => ({ date: `2026-11-${15 + i}`, estado }));
const bloco = (id: string, hora: number, minutos = 25, kind: RoutineBlock['kind'] = 'foco'): RoutineBlock => ({
  id,
  weekday: 5,
  startMinutes: hora * 60,
  durationMinutes: minutos,
  kind,
});
const SEM_ALVOS = { habitos: [], metas: [], tarefas: [] };

describe('saudação', () => {
  test.each([
    [8, 'Bom dia, Ana'],
    [14, 'Boa tarde, Ana'],
    [20, 'Boa noite, Ana'],
    [2, 'Boa noite, Ana'],
  ])('às %i h', (hora, esperado) => {
    expect(saudacao(sp(2026, 11, 21, hora, 0), FUSO, 'Ana Souza')).toBe(esperado);
  });

  test('vale a hora do fuso da pessoa', () => {
    expect(saudacao(sp(2026, 11, 21, 10, 0), 'Asia/Tokyo', '')).toBe('Boa noite');
  });
});

describe('textos de horário', () => {
  test('hora, duração e tempo livre', () => {
    expect(horaCheia(8 * 60)).toBe('08h00');
    expect([15, 60, 90].map(duracaoTexto)).toEqual(['15 min', '1h', '1h30']);
    expect([245, 45].map(textoDeFolga)).toEqual(['livre · 4h', 'livre · 45 min']);
  });
});

describe('barra da semana', () => {
  test('letras, cor de cada dia e quanto enche até hoje', () => {
    const b = barraDaSemana(semana(['feito', 'vazio', 'descanso', 'feito', 'futuro', 'futuro', 'futuro']));
    expect(b.letras.map((d) => d.letra).join('')).toBe('DSTQQSS');
    expect(b.letras.map((d) => d.tom)).toEqual(['feito', 'apagado', 'descanso', 'hoje', 'apagado', 'apagado', 'apagado']);
    expect(b.cheio).toBeCloseTo(3.5 / 7);
    expect(b.completa).toBe(false);
  });

  test('o dia de gelo tem tom e descrição próprios', () => {
    const b = barraDaSemana(semana(['feito', 'gelo', 'descanso', 'hoje', 'futuro', 'futuro', 'futuro']));
    expect(b.letras.map((d) => d.tom).slice(0, 4)).toEqual(['feito', 'gelo', 'descanso', 'hoje']);
    expect(b.letras[1]?.descricao).toBe('segunda, protegido por gelo');
  });

  test('o foguinho acende com os 7 dias feitos ou de descanso', () => {
    expect(barraDaSemana(semana(['feito', 'feito', 'descanso', 'feito', 'feito', 'feito', 'feito'])).completa).toBe(true);
    expect(barraDaSemana(semana(['feito', 'feito', 'descanso', 'feito', 'feito', 'feito', 'hoje'])).completa).toBe(false);
  });
});

describe('gráfico da semana', () => {
  test('altura por foco, descanso à parte e totais só da semana', () => {
    const g = graficoDaSemana({
      semana: semana(['feito', 'feito', 'descanso', 'vazio', 'hoje', 'futuro', 'futuro']),
      sessions: [
        endedSession(sp(2026, 11, 15, 9, 0), 50, 'concluida', 50),
        endedSession(sp(2026, 11, 16, 9, 0), 25, 'concluida', 25),
        endedSession(sp(2026, 11, 8, 9, 0), 25, 'concluida', 25),
      ],
      restDays: [{ date: '2026-11-17' }],
      habitLogs: [
        { habitId: 'h', date: '2026-11-15', doneAt: 0 },
        { habitId: 'h', date: '2026-11-08', doneAt: 0 },
      ],
      goals: [],
      baus: [],
      fuso: FUSO,
    });
    expect(g.barras.map((b) => b.tipo)).toEqual(['foco', 'foco', 'descanso', 'vazia', 'vazia', 'vazia', 'vazia']);
    expect(g.barras.map((b) => b.altura)).toEqual([90, 45, 40, 6, 6, 6, 6]);
    expect(g.minutos).toBe(75);
    expect(g.diasDeCuidado).toBe(3);
    // 1 hábito, 15 do foco e 2 do descanso
    expect(g.joias).toBe(18);
  });
});

describe('hábitos e tarefas', () => {
  test('legenda do hábito', () => {
    expect(quandoDoHabito({ weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe('todo dia');
    expect(quandoDoHabito({ weekdays: [0, 2, 4] })).toBe('seg, qua, sex');
    expect(quandoDoHabito({ weekdays: [0], period: 'manha' })).toBe('manhã');
  });

  test('só as tarefas com prazo hoje, feitas por último', () => {
    const tarefa = (id: string, position: number, status: Task['status'], dueDate?: string): Task => ({
      id,
      title: id,
      status,
      position,
      priority: 'normal',
      tags: [],
      pomodorosEstimated: 0,
      createdAt: 0,
      dueDate,
    });
    const lista = tarefasDeHoje(
      [tarefa('feita', 1, 'feito', '2026-11-21'), tarefa('b', 3, 'afazer', '2026-11-21'), tarefa('a', 2, 'fazendo', '2026-11-21'), tarefa('ontem', 0, 'afazer', '2026-11-20'), tarefa('sem', 0, 'afazer')],
      '2026-11-21',
    );
    expect(lista.map((t) => t.id)).toEqual(['a', 'b', 'feita']);
  });
});

describe('vínculo do bloco', () => {
  test('vale o alvo da sessão mais recente do bloco, e alvo apagado é ignorado', () => {
    const sessao = (inicio: number, habitId: string) => ({ ...endedSession(inicio, 25, 'concluida'), blockId: 'b', habitId });
    const alvos = { ...SEM_ALVOS, habitos: [{ id: 'h', title: 'Ler', weekdays: [], state: 'ativo' as const }] };
    expect(vinculoDoBloco('b', [sessao(1, 'h'), sessao(2, 'sumiu')], alvos)).toEqual({
      busca: { bloco: 'b', habito: 'h' },
      alvo: { icone: '🌱', titulo: 'Ler' },
    });
    expect(vinculoDoBloco('b', [], alvos)).toEqual({ busca: { bloco: 'b' }, alvo: null });
  });
});

describe('linha do dia', () => {
  const blocos = [bloco('a', 8, 15), bloco('b', 10), bloco('c', 14.5), bloco('e', 17), bloco('d', 20, 60, 'descanso')];
  const entrada = { blocos, sessions: [], alvos: SEM_ALVOS, descansoHoje: false, hoje: '2026-11-21', fuso: FUSO, agora: sp(2026, 11, 21, 14, 38) };

  test('estados, botão Focar no bloco atual e o maior tempo livre', () => {
    const sessions = [{ ...endedSession(sp(2026, 11, 21, 8, 0), 25, 'concluida'), blockId: 'a' }];
    const itens = linhaDoDia({ ...entrada, sessions, minutos: 14 * 60 + 38 });
    expect(itens.map((i) => (i.tipo === 'livre' ? i.texto : i.estado))).toEqual(['feito', 'pendente', 'livre · 4h', 'agora', 'pendente', 'pendente']);
    expect(itens.flatMap((i) => (i.tipo === 'bloco' && i.focar ? [i.id] : []))).toEqual(['c']);
  });

  test('descanso registrado marca o bloco de descanso', () => {
    const itens = linhaDoDia({ ...entrada, descansoHoje: true, minutos: 0 });
    expect(itens.at(-1)).toMatchObject({ estado: 'feito' });
  });

  const marcos = [
    { inicio: 480, fim: 495, centro: 50 },
    { inicio: 600, fim: 625, centro: 150 },
    { inicio: 870, fim: 895, centro: 300 },
  ];

  test.each([
    ['antes do primeiro', 400, 50],
    ['entre blocos, proporcional', 540, 100],
    ['no começo de um bloco, abaixo do círculo', 600, 182],
    ['depois do último', 1000, 300],
    ['dentro do último', 880, 332],
  ])('ponto da hora atual: %s', (_nome, minutos, esperado) => {
    expect(posicaoDoAgora(marcos, minutos)).toBe(esperado);
  });

  test('sem blocos não há ponto', () => {
    expect(posicaoDoAgora([], 600)).toBeNull();
  });
});

describe('Hoje com a conta de exemplo', () => {
  async function preparar() {
    const { repo, clock } = await criarContaDeExemplo();
    const user = await repo.getUser();
    if (!user) throw new Error('conta de exemplo sem usuário');
    const carregar = () => carregarHoje(repo, clock, user, 'Ana');
    return { repo, clock, user, carregar };
  }

  test('mostra o dia do rascunho', async () => {
    const d = await (await preparar()).carregar();
    expect(d.saudacao).toBe('Boa tarde, Ana');
    expect(d.foco).toMatchObject({ titulo: 'Estudar inglês', minutos: 25, alvo: { icone: '🎓', titulo: 'Estudar inglês' } });
    expect(d.diasSeguidos).toBe(12);
    expect(d.habitos.map((h) => h.feito)).toEqual([true, true, false, false]);
    expect(d.tarefas.map((t) => t.feita)).toEqual([false, false, false, true]);
    expect(d.linha.filter((i) => i.tipo === 'bloco')).toHaveLength(5);
  });

  test('marcar hábito e concluir tarefa gravam no repositório', async () => {
    const { repo, clock, user, carregar } = await preparar();
    await alternarHabito(repo, clock, user, 'ex-habito-ler', false);
    expect((await carregar()).habitos.filter((h) => h.feito)).toHaveLength(3);
    await alternarHabito(repo, clock, user, 'ex-habito-ler', true);
    expect((await carregar()).habitos.filter((h) => h.feito)).toHaveLength(2);

    const salva = async () => (await repo.listTasks()).find((t) => t.id === 'ex-tarefa-1');
    await alternarTarefa(repo, clock, 'ex-tarefa-1', false);
    expect(await salva()).toMatchObject({ status: 'feito', completedAt: clock.now() });
    await alternarTarefa(repo, clock, 'ex-tarefa-1', true);
    expect(await salva()).toMatchObject({ status: 'afazer' });
    expect((await salva())?.completedAt).toBeUndefined();
  });

  test('sem blocos na rotina avisa que está vazia', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(sp(2026, 11, 23, 10, 0));
    const user = await concluirOnboarding(repo, clock, { frogName: 'Juca', startHour: 7, endHour: 22 });
    for (const b of await repo.listBlocks()) await repo.deleteBlock(b.id);
    const d = await carregarHoje(repo, clock, user, 'Ana');
    expect(d.temRotina).toBe(false);
    expect(d.foco.titulo).toBeNull();
  });
});

describe('o sapo da sequência', () => {
  const semana = (estado: 'hoje' | 'feito') => [{ date: '2026-11-25', estado }];

  test.each([
    ['dia comum', 3, 10, 'hoje', 600, null],
    ['noite sem nada feito', 3, 10, 'hoje', 20 * 60, 'fim-do-dia-sem-nada'],
    ['noite com o dia feito', 3, 10, 'feito', 22 * 60, null],
    ['sequência perdida', 0, 10, 'hoje', 600, 'sequencia-perdida'],
    ['quem nunca começou', 0, 0, 'hoje', 600, null],
    ['recorde longo', 9, 9, 'feito', 600, 'recorde'],
    ['recorde ainda curto', 2, 2, 'feito', 600, null],
  ] as const)('%s', (_nome, dias, recorde, estado, minutos, esperado) => {
    expect(momentoDaSequencia({ dias, recorde, semana: semana(estado), minutos })).toBe(esperado);
  });
});
