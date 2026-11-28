import { alternar, dadosParaConcluir, MAXIMO_DE_HABITOS, respostasIniciais } from './logic';
import { PASSOS } from './passos';

describe('respostas do onboarding', () => {
  test('separa o nome da conta em nome e sobrenome', () => {
    expect(respostasIniciais('  Ana  Maria Souza ')).toMatchObject({ nome: 'Ana', sobrenome: 'Maria Souza' });
    expect(respostasIniciais()).toMatchObject({ nome: '', sobrenome: '' });
  });

  test('alternar marca, desmarca e respeita o máximo', () => {
    expect(alternar(['a'], 'b')).toEqual(['a', 'b']);
    expect(alternar(['a', 'b'], 'a')).toEqual(['b']);
    expect(alternar(['a', 'b', 'c'], 'd', MAXIMO_DE_HABITOS)).toEqual(['a', 'b', 'c']);
  });

  test('envia o sapo Pulo e os horários padrão', () => {
    expect(dadosParaConcluir()).toEqual({ frogName: 'Pulo', startHour: 7, endHour: 22 });
  });
});

describe('validação de cada passo', () => {
  const vazias = respostasIniciais();
  const casos = [
    { id: 'nome', livre: false, resposta: { nome: 'Ana', sobrenome: 'Souza' } },
    { id: 'travas', livre: false, resposta: { travas: ['comecar'] } },
    { id: 'habitos', livre: false, resposta: { habitos: ['Alongar'] } },
    { id: 'momento', livre: false, resposta: { momento: 'estudando' } },
    { id: 'idade', livre: false, resposta: { idade: 30 } },
  ] as const;

  test.each(casos)('$id', ({ id, livre, resposta }) => {
    const passo = PASSOS.find((p) => p.id === id);
    expect(passo?.pronto(vazias)).toBe(livre);
    expect(passo?.pronto({ ...vazias, ...resposta })).toBe(true);
  });

  test('só dá para pular o que atrapalha e os hábitos', () => {
    expect(PASSOS.filter((p) => p.podePular).map((p) => p.id)).toEqual(['travas', 'habitos']);
  });
});
