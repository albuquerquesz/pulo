import { estadoDaCasa } from '@pulo/core/domain/casa';
import type { Achievement, Purchase } from '@pulo/core/domain/types';

import { conquistasNovas, ilhaNaTela, textoDaConquista, textoDoPortal } from './logic';

const casa = (credito: number, compras: Purchase[] = []) =>
  estadoDaCasa({ habitLogs: [], sessions: [], restDays: [], goals: [], baus: [], credito }, compras, []);

const situacoes = (ilha: ReturnType<typeof ilhaNaTela>) => Object.fromEntries(ilha.partes.map((p) => [p.id, p.situacao]));
const compra = (item: string, cost: number): Purchase => ({ item, cost, createdAt: 1 });

describe('ilhaNaTela', () => {
  test('conta as partes por camada e separa o que dá para comprar', () => {
    const ilha = ilhaNaTela(casa(120));
    expect(ilha.construidas).toEqual(['quarto']);
    expect(ilha.total).toBe(24);
    expect(ilha.progresso.comodo).toEqual({ feitas: 1, total: 8 });
    expect(situacoes(ilha)).toMatchObject({ quarto: 'feita', cozinha: 'cara', varanda: 'disponivel', cerca: 'disponivel', torre: 'trancada', ponte: 'trancada' });
    expect(ilha.partes.find((p) => p.id === 'torre')?.motivo).toBe('Precisa do Segundo andar');
  });

  test('o alvo é a parte mais barata que o saldo paga', () => {
    expect(ilhaNaTela(casa(0)).alvo).toBeNull();
    expect(ilhaNaTela(casa(80)).alvo).toBe('caixa-correio');
    expect(casa(30, [compra('caixa-correio', 30)]).proxima?.id).toBe('poste');
  });

  test('a compra a caminho aparece pronta, paga uma vez só, e já destranca a seguinte', () => {
    const antes = ilhaNaTela(casa(100), 'jardim');
    expect(antes.saldo).toBe(20);
    expect(antes.construidas).toContain('jardim');
    expect(situacoes(antes).horta).toBe('cara');
    const depois = ilhaNaTela(casa(100, [compra('jardim', 80)]), 'jardim');
    expect(depois.saldo).toBe(20);
  });
});

describe('conquistas', () => {
  const conquista = (conquistada: boolean): Achievement => ({ id: 'casa-inteira', nome: 'Casa inteira', emoji: '🏡', conquistada, progresso: 24, meta: 24 });

  test('só conta a que passou a valer', () => {
    expect(conquistasNovas([conquista(false)], [conquista(true)])).toHaveLength(1);
    expect(conquistasNovas([conquista(true)], [conquista(true)])).toEqual([]);
    expect(textoDaConquista(conquista(true))).toBe('Conquista nova: 🏡 Casa inteira');
  });
});

describe('cais da próxima ilha', () => {
  it('diz quantas partes faltam e abre com a casa inteira', () => {
    expect(textoDoPortal(12, 24)).toBe('A próxima ilha abre com a casa inteira. Faltam 12 partes.');
    expect(textoDoPortal(23, 24)).toBe('A próxima ilha abre com a casa inteira. Falta 1 parte.');
    expect(textoDoPortal(24, 24)).toBe('A próxima ilha chega em breve!');
  });
});
