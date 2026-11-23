import { createMemoryRepository } from '@/data';
import { MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import { fixedClock } from '@pulo/core/domain/clock';
import { sp } from '@pulo/core/domain/test-utils';
import type { Weekday } from '@pulo/core/domain/types';

import {
  blocosPorDia,
  carregarRotina,
  descricaoDoBloco,
  desfazerEdicaoDeBloco,
  diasDoHabito,
  entradaDoBloco,
  entradaVaziaDeBloco,
  entradaVaziaDeHabito,
  habitosAtivosPorDia,
  horarioParaCampo,
  lerEntradaDeBloco,
  lerHorario,
  LIMITE_DE_TITULO,
  removerDoBloco,
  removerDoHabito,
  salvarBloco,
  salvarHabito,
} from './logic';

const clock = fixedClock(sp(2026, 11, 23, 10, 0));
const bloco = { weekday: 1 as Weekday, inicio: '09:00', duracao: '25', kind: 'foco' as const, titulo: '' };

describe('horário digitado', () => {
  test.each([
    ['9', 540],
    ['09:30', 570],
    ['9h30', 570],
    ['9h', 540],
    [' 23:59 ', 1439],
    ['0:00', 0],
  ])('"%s" vira %i minutos', (texto, minutos) => {
    expect(lerHorario(texto)).toBe(minutos);
  });

  test.each(['', 'abc', '24:00', '9:60', '9:5:1', '-1', '9,5'])('"%s" é recusado', (texto) => {
    expect(lerHorario(texto)).toBeNull();
  });

  test('ida e volta para o campo', () => {
    expect(horarioParaCampo(570)).toBe('09:30');
    expect(lerHorario(horarioParaCampo(1439))).toBe(1439);
  });
});

describe('formulário de bloco', () => {
  test('mensagens em português para formato, duração e título', () => {
    expect(lerEntradaDeBloco({ ...bloco, inicio: 'cedo' })).toEqual({ ok: false, erro: { campo: 'inicio', mensagem: 'Use o horário no formato 09:30.' } });
    expect(lerEntradaDeBloco({ ...bloco, duracao: '' })).toMatchObject({ ok: false, erro: { campo: 'duracao', mensagem: 'Informe a duração em minutos, de 5 a 120.' } });
    expect(lerEntradaDeBloco({ ...bloco, duracao: '2,5' })).toMatchObject({ ok: false, erro: { campo: 'duracao' } });
    expect(lerEntradaDeBloco({ ...bloco, titulo: 'x'.repeat(LIMITE_DE_TITULO + 1) })).toMatchObject({ ok: false, erro: { campo: 'titulo' } });
  });

  test('título vazio some; espaços são aparados', () => {
    expect(lerEntradaDeBloco({ ...bloco, titulo: '   ' })).toEqual({ ok: true, value: { weekday: 1, startMinutes: 540, durationMinutes: 25, kind: 'foco' } });
    expect(lerEntradaDeBloco({ ...bloco, titulo: ' Estudar ' })).toMatchObject({ ok: true, value: { title: 'Estudar' } });
  });

  test('entrada vazia usa o início do dia; entrada do bloco devolve os mesmos campos', () => {
    expect(entradaVaziaDeBloco(420)).toMatchObject({ inicio: '07:00', duracao: '25', kind: 'foco' });
    expect(entradaDoBloco({ id: 'b', weekday: 2, startMinutes: 600, durationMinutes: 45, kind: 'descanso', title: 'Café' })).toEqual({
      weekday: 2, inicio: '10:00', duracao: '45', kind: 'descanso', titulo: 'Café',
    });
  });
});

describe('criar, editar e remover blocos', () => {
  test('cria e lista por dia da semana, com os sete dias sempre presentes', async () => {
    const repo = createMemoryRepository();
    const r = await salvarBloco(repo, clock, { ...bloco, titulo: 'Estudar' }, null);
    expect(r).toMatchObject({ ok: true, bloco: { title: 'Estudar', weekday: 1, startMinutes: 540 } });
    await salvarBloco(repo, clock, { ...bloco, inicio: '08:00' }, null);
    const dias = blocosPorDia((await carregarRotina(repo)).blocos);
    expect(dias).toHaveLength(7);
    expect(dias[1].nome).toBe('Terça-feira');
    expect(dias[1].blocos.map((b) => b.startMinutes)).toEqual([480, 540]);
    expect(dias[0].blocos).toEqual([]);
  });

  test('duração fora de 5 a 120 volta com a mensagem do core, no campo da duração', async () => {
    const repo = createMemoryRepository();
    for (const duracao of ['4', '121']) {
      expect(await salvarBloco(repo, clock, { ...bloco, duracao }, null)).toMatchObject({
        ok: false,
        erro: { campo: 'duracao', mensagem: 'A duração vai de 5 a 120 minutos.' },
      });
    }
    expect(await repo.listBlocks()).toEqual([]);
  });

  test('bloco que passa da meia-noite é recusado', async () => {
    const repo = createMemoryRepository();
    expect(await salvarBloco(repo, clock, { ...bloco, inicio: '23:50', duracao: '25' }, null)).toMatchObject({
      ok: false,
      erro: { campo: 'inicio', mensagem: 'O bloco precisa caber dentro do dia.' },
    });
  });

  test('sobreposição sugere o próximo horário livre', async () => {
    const repo = createMemoryRepository();
    await salvarBloco(repo, clock, bloco, null);
    const r = await salvarBloco(repo, clock, { ...bloco, inicio: '09:10' }, null);
    expect(r).toMatchObject({ ok: false, erro: { campo: 'inicio' }, sugestaoDeInicio: '09:25' });
  });

  test('mudar só o dia ou o horário usa "mover" e dá para desfazer', async () => {
    const repo = createMemoryRepository();
    const criado = await salvarBloco(repo, clock, bloco, null);
    if (!criado.ok) throw new Error('esperava ok');
    const r = await salvarBloco(repo, clock, { ...entradaDoBloco(criado.bloco), weekday: 3, inicio: '10:30' }, criado.bloco.id);
    expect(r).toMatchObject({ ok: true, bloco: { weekday: 3, startMinutes: 630 } });
    if (!r.ok || !r.desfazer) throw new Error('esperava token de desfazer');
    expect(await desfazerEdicaoDeBloco(repo, clock, r.desfazer)).toMatchObject({ ok: true });
    expect(await repo.listBlocks()).toEqual([criado.bloco]);
  });

  test('encurtar dá desfazer; esticar, trocar o tipo ou o título é edição comum, sem desfazer', async () => {
    const repo = createMemoryRepository();
    const criado = await salvarBloco(repo, clock, { ...bloco, titulo: 'Ler' }, null);
    if (!criado.ok) throw new Error('esperava ok');
    const base = entradaDoBloco(criado.bloco);
    const curto = await salvarBloco(repo, clock, { ...base, duracao: '15' }, criado.bloco.id);
    expect(curto).toMatchObject({ ok: true, bloco: { durationMinutes: 15 } });
    expect(curto.ok && curto.desfazer).not.toBeNull();
    const longo = await salvarBloco(repo, clock, { ...base, duracao: '50' }, criado.bloco.id);
    expect(longo).toMatchObject({ ok: true, desfazer: null, bloco: { durationMinutes: 50 } });
    const descanso = await salvarBloco(repo, clock, { ...base, duracao: '50', kind: 'descanso' }, criado.bloco.id);
    expect(descanso).toMatchObject({ ok: true, desfazer: null, bloco: { kind: 'descanso' } });
  });

  test('apagar o título de um bloco funciona', async () => {
    const repo = createMemoryRepository();
    const criado = await salvarBloco(repo, clock, { ...bloco, titulo: 'Ler' }, null);
    if (!criado.ok) throw new Error('esperava ok');
    await salvarBloco(repo, clock, { ...entradaDoBloco(criado.bloco), titulo: '' }, criado.bloco.id);
    expect((await repo.listBlocks())[0].title).toBeUndefined();
  });

  test('o desfazer vence depois da janela', async () => {
    const repo = createMemoryRepository();
    const criado = await salvarBloco(repo, clock, bloco, null);
    if (!criado.ok) throw new Error('esperava ok');
    const r = await salvarBloco(repo, clock, { ...entradaDoBloco(criado.bloco), inicio: '11:00' }, criado.bloco.id);
    if (!r.ok || !r.desfazer) throw new Error('esperava token');
    expect(await desfazerEdicaoDeBloco(repo, fixedClock(clock.now() + 60_000), r.desfazer)).toMatchObject({ ok: false, error: { code: 'desfazer_expirado' } });
  });

  test('editar um bloco que sumiu avisa em português; remover é idempotente', async () => {
    const repo = createMemoryRepository();
    expect(await salvarBloco(repo, clock, bloco, 'nao-existe')).toMatchObject({ ok: false, erro: { mensagem: 'Esse bloco não existe mais.' } });
    const criado = await salvarBloco(repo, clock, bloco, null);
    if (!criado.ok) throw new Error('esperava ok');
    await removerDoBloco(repo, criado.bloco.id);
    await removerDoBloco(repo, criado.bloco.id);
    expect(await repo.listBlocks()).toEqual([]);
  });

  test('descreve o bloco para leitor de tela', () => {
    expect(descricaoDoBloco({ id: 'b', weekday: 0, startMinutes: 540, durationMinutes: 25, kind: 'foco', title: 'Estudar' })).toBe('Segunda-feira, 9h a 9h25, foco, Estudar');
    expect(descricaoDoBloco({ id: 'b', weekday: 6, startMinutes: 600, durationMinutes: 30, kind: 'descanso' })).toBe('Domingo, 10h a 10h30, descanso');
  });
});

describe('hábitos', () => {
  test('cria, edita, pausa e remove', async () => {
    const repo = createMemoryRepository();
    const criado = await salvarHabito(repo, clock, { ...entradaVaziaDeHabito, titulo: '  Ler  ', dias: [2, 0] }, null);
    expect(criado).toMatchObject({ ok: true, habito: { title: 'Ler', weekdays: [0, 2], active: true } });
    if (!criado.ok) return;
    const pausado = await salvarHabito(repo, clock, { titulo: 'Ler', dias: [0, 2], ativo: false }, criado.habito.id);
    expect(pausado).toMatchObject({ ok: true, habito: { active: false } });
    await removerDoHabito(repo, criado.habito.id);
    expect(await repo.listHabits()).toEqual([]);
  });

  test('nome vazio e nenhum dia têm mensagem no campo certo', async () => {
    const repo = createMemoryRepository();
    expect(await salvarHabito(repo, clock, { ...entradaVaziaDeHabito, titulo: '  ' }, null)).toEqual({
      ok: false, erro: { campo: 'titulo', mensagem: 'Dê um nome ao hábito.' },
    });
    expect(await salvarHabito(repo, clock, { ...entradaVaziaDeHabito, titulo: 'x', dias: [] }, null)).toEqual({
      ok: false, erro: { campo: 'dias', mensagem: 'Escolha pelo menos um dia da semana.' },
    });
    expect(await salvarHabito(repo, clock, { ...entradaVaziaDeHabito, titulo: 'x'.repeat(LIMITE_DE_TITULO + 1) }, null)).toMatchObject({ ok: false, erro: { campo: 'titulo' } });
  });

  test(`o limite de ${MAX_HABITS_PER_DAY} hábitos por dia vem do decisions e a mensagem fala dele`, async () => {
    const repo = createMemoryRepository();
    for (let i = 0; i < MAX_HABITS_PER_DAY; i += 1) {
      expect((await salvarHabito(repo, clock, { ...entradaVaziaDeHabito, titulo: `H${i}`, dias: [3] }, null)).ok).toBe(true);
    }
    const r = await salvarHabito(repo, clock, { ...entradaVaziaDeHabito, titulo: 'sobra', dias: [3, 4] }, null);
    expect(r).toMatchObject({ ok: false, erro: { campo: 'dias' } });
    expect(!r.ok && r.erro.mensagem).toContain(`até ${MAX_HABITS_PER_DAY} hábitos`);
    expect(habitosAtivosPorDia(await repo.listHabits())).toEqual([0, 0, 0, MAX_HABITS_PER_DAY, 0, 0, 0]);
  });

  test('resumo dos dias', () => {
    expect(diasDoHabito([0, 1, 2, 3, 4, 5, 6])).toBe('Todos os dias');
    expect(diasDoHabito([4, 0, 1, 2, 3])).toBe('Seg a Sex');
    expect(diasDoHabito([0, 2, 4])).toBe('Seg, Qua e Sex');
    expect(diasDoHabito([5, 6])).toBe('Sáb e Dom');
    expect(diasDoHabito([3])).toBe('Qui');
  });
});
