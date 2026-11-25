import type { Ponto } from '@/ui';

export interface Voo {
  joias: number;
  de: Ponto;
  para: Ponto;
}

const centro = (elemento: Element): Ponto => {
  const r = elemento.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Do baú até o saldo de joias do trilho. Sem trilho (celular), as joias sobem até o topo da tela. */
export function planejarVoo(): Pick<Voo, 'de' | 'para'> {
  const bau = document.querySelector('[data-bau-esperando]');
  const de = bau ? centro(bau) : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const saldo = document.querySelector('[data-destino-das-joias]');
  return { de, para: saldo ? centro(saldo) : { x: de.x, y: 0 } };
}
