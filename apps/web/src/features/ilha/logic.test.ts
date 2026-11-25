import { estadoDaCasa } from '@pulo/core/domain/casa';
import type { Achievement, Purchase } from '@pulo/core/domain/types';

import { conquistasNovas, ilhaNaTela, textoDaConquista } from './logic';

const casa = (credito: number, compras: Purchase[] = []) =>
  estadoDaCasa({ habitLogs: [], sessions: [], restDays: [], goals: [], baus: [], credito }, compras, []);

const situacoes = (partes: ReturnType<typeof ilhaNaTela>['partes']) => Object.fromEntries(partes.map((p) => [p.id, p.situacao]));

describe('ilhaNaTela', () => {
  test('conta as partes e separa o que o saldo paga', () => {
    const ilha = ilhaNaTela(casa(80));
    expect(ilha.construidas).toEqual(['quarto']);
    expect(ilha.total).toBe(6);
    expect(situacoes(ilha.partes)).toEqual({ quarto: 'feita', cozinha: 'cara', varanda: 'disponivel', jardim: 'disponivel', arvore: 'cara', cerca: 'disponivel' });
  });

  test('a próxima parte é a mais barata que falta', () => {
    expect(casa(0).proxima?.id).toBe('cerca');
    expect(casa(40, [{ item: 'cerca', cost: 40, createdAt: 1 }]).proxima?.id).toBe('jardim');
  });

  test('a compra a caminho aparece pronta e paga uma vez só', () => {
    const antes = ilhaNaTela(casa(100), 'cerca');
    expect(antes.saldo).toBe(60);
    expect(antes.construidas).toContain('cerca');
    const depois = ilhaNaTela(casa(100, [{ item: 'cerca', cost: 40, createdAt: 1 }]), 'cerca');
    expect(depois.saldo).toBe(60);
  });
});

describe('conquistas', () => {
  const conquista = (conquistada: boolean): Achievement => ({ id: 'casa-inteira', nome: 'Casa inteira', emoji: '🏡', conquistada, progresso: 6, meta: 6 });

  test('só conta a que passou a valer', () => {
    expect(conquistasNovas([conquista(false)], [conquista(true)])).toHaveLength(1);
    expect(conquistasNovas([conquista(true)], [conquista(true)])).toEqual([]);
    expect(textoDaConquista(conquista(true))).toBe('Conquista nova: 🏡 Casa inteira');
  });
});
