import { alternar, dadosParaConcluir, MAXIMO_DE_HABITOS, respostasIniciais } from './logic';
import { PASSOS } from './passos';

describe('respostas do onboarding', () => {
  test('separa o nome da conta em nome e sobrenome', () => {
    expect(respostasIniciais('  Ana  Maria Souza ')).toMatchObject({ nome: 'Ana', sobrenome: 'Maria Souza' });
    expect(respostasIniciais()).toMatchObject({ nome: '', sobrenome: '', aprender: false });
  });

  test('alternar marca, desmarca e respeita o máximo', () => {
    expect(alternar(['a'], 'b')).toEqual(['a', 'b']);
    expect(alternar(['a', 'b'], 'a')).toEqual(['b']);
    expect(alternar(['a', 'b', 'c'], 'd', MAXIMO_DE_HABITOS)).toEqual(['a', 'b', 'c']);
  });

  test('envia nome do sapo e horários; sem nome vai Pulo', () => {
    expect(dadosParaConcluir(respostasIniciais())).toEqual({ frogName: 'Pulo', startHour: 7, endHour: 22 });
    expect(dadosParaConcluir({ ...respostasIniciais(), nomeDoSapo: ' Bolota ', startHour: 8, endHour: 20 })).toEqual({ frogName: 'Bolota', startHour: 8, endHour: 20 });
  });
});

describe('validação de cada passo', () => {
  const vazias = respostasIniciais();
  const casos = [
    { id: 'nome', livre: true, resposta: {} },
    { id: 'dia', livre: false, resposta: { periodo: 'manha' } },
    { id: 'travas', livre: false, resposta: { travas: ['comecar'] } },
    { id: 'lembrete', livre: false, resposta: { tom: 'leve', focoMinutos: 25 } },
    { id: 'habitos', livre: false, resposta: { habitos: ['Alongar'] } },
    { id: 'sapo', livre: true, resposta: {} },
    { id: 'aprender', livre: true, resposta: {} },
  ] as const;

  test.each(casos)('$id', ({ id, livre, resposta }) => {
    const passo = PASSOS.find((p) => p.id === id);
    expect(passo?.pronto(vazias)).toBe(livre);
    expect(passo?.pronto({ ...vazias, ...resposta })).toBe(true);
  });

  test('o lembrete pede o tom e a duração', () => {
    const passo = PASSOS.find((p) => p.id === 'lembrete');
    expect(passo?.pronto({ ...vazias, tom: 'leve' })).toBe(false);
    expect(passo?.pronto({ ...vazias, focoMinutos: 15 })).toBe(false);
  });

  test('só dá para pular do que atrapalha até o nome do sapo', () => {
    expect(PASSOS.filter((p) => p.podePular).map((p) => p.id)).toEqual(['travas', 'lembrete', 'habitos', 'sapo']);
  });
});
