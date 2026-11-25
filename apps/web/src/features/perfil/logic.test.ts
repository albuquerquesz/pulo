import type { Achievement } from '@pulo/core/domain/types';
import { localToMs } from '@pulo/core/demo';

import { criarSessaoDemo } from '../app/demo';
import {
  carregarPerfil,
  desdeQuando,
  erroDaConta,
  horario,
  lembreteEscolhido,
  medalha,
  numero,
  opcoesDeFoco,
  opcoesDeLembrete,
  podeExcluir,
} from './logic';

const FUSO = 'America/Sao_Paulo';
const base = { nome: 'Mês de fogo', emoji: '🏆', conquistada: false } as const satisfies Partial<Achievement>;

describe('textos do Perfil', () => {
  test('horário, data de entrada e milhar', () => {
    expect(horario(6 * 60)).toBe('06h00');
    expect(horario(20 * 60 + 30)).toBe('20h30');
    expect(desdeQuando(localToMs('2026-09-14', 12 * 60), FUSO)).toBe('Desde setembro de 2026');
    expect(numero(1240)).toBe('1.240');
  });

  test('as opções mantêm um valor fora do passo e o lembrete pode ser desligado', () => {
    expect(opcoesDeFoco(27).map((o) => o.valor)).toContain('27');
    const lembrete = { ligado: false, minutos: 21 * 60 };
    expect(opcoesDeLembrete(lembrete)[0]?.rotulo).toBe('Desligado');
    expect(lembreteEscolhido('1200', lembrete)).toEqual({ ligado: true, minutos: 1200 });
    expect(lembreteEscolhido('desligado', { ligado: true, minutos: 1200 })).toEqual({ ligado: false, minutos: 1200 });
  });

  test('conquista em andamento diz quanto falta; conquistada diz a data', () => {
    const andando = medalha({ ...base, id: 'mes-de-fogo', progresso: 21, meta: 30 }, FUSO);
    expect(andando).toMatchObject({ estado: 'andando', detalhe: '21 de 30 dias seguidos' });
    const feita = medalha(
      { ...base, id: 'primeira-semana', nome: 'Primeira semana', conquistada: true, conquistadaEm: localToMs('2026-10-02', 12 * 60), progresso: 7, meta: 7 },
      FUSO,
    );
    expect(feita).toMatchObject({ estado: 'conquistada', detalhe: '7 dias seguidos · conquistada em 02/10' });
  });

  test('a secreta fica sem nome até ser conquistada', () => {
    expect(medalha({ id: 'segredo', conquistada: false, progresso: 0, meta: 1 }, FUSO)).toMatchObject({
      estado: 'secreta',
      nome: 'Segredo',
      detalhe: 'Continue cuidando do sapo',
    });
    expect(medalha({ id: 'segredo', nome: 'Segredo', conquistada: true, progresso: 1, meta: 1 }, FUSO).estado).toBe('conquistada');
  });

  test('conta: nome obrigatório e foto só https', () => {
    expect(erroDaConta('Ana', '')).toBeNull();
    expect(erroDaConta('Ana', 'https://exemplo.com/a.png')).toBeNull();
    expect(erroDaConta('  ', '')).toBeTruthy();
    expect(erroDaConta('Ana', 'http://exemplo.com/a.png')).toBeTruthy();
    expect(erroDaConta('Ana', 'foto')).toBeTruthy();
  });

  test('excluir pede a palavra exata', () => {
    expect(podeExcluir('excluir')).toBe(false);
    expect(podeExcluir('EXCLUIR')).toBe(true);
  });

  test('o demo tem os números do rascunho', async () => {
    const { repo, clock } = await criarSessaoDemo();
    const dados = await carregarPerfil(repo, clock);
    expect(dados.sequencia).toMatchObject({ atual: 12, recorde: 21 });
    expect(dados.estatisticas).toMatchObject({ habitosFeitos: 186, minutosDeFoco: 1240 });
    expect(dados.preferencias).toMatchObject({ focusMinutes: 25, eveningReminder: { ligado: true, minutos: 1200 } });
    expect(dados.conquistas.map((c) => c.id)).toHaveLength(6);
  });
});
