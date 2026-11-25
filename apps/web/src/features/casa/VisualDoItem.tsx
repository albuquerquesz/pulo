import type { Escolha } from './catalogo';

/** O desenho de um item na loja: o emoji com o filtro da cor, ou o tapete pintado. */
export function VisualDoItem({ item, cor, tamanho }: Escolha & { tamanho: number }) {
  if (item.tipo === 'tapete') {
    return (
      <svg aria-hidden="true" width={tamanho * 1.6} height={tamanho} viewBox="0 0 42 26" className="max-w-full">
        <ellipse cx="21" cy="13" rx="19" ry="10" fill={cor.tapete} stroke="var(--pulo-contorno)" strokeWidth="2.5" />
        <ellipse cx="21" cy="13" rx="13" ry="6" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="4 3" opacity=".8" />
      </svg>
    );
  }
  return (
    <span aria-hidden="true" className="inline-block leading-none" style={{ fontSize: tamanho, filter: cor.filtro }}>
      {item.emoji}
    </span>
  );
}
