import type { Colocado } from './decoracao';
import { LUGARES, type Lugar } from './lugares';

/** A inclinação que deita o item na parede. */
const INCLINACAO = { esquerda: -26.57, direita: 26.57 } as const;

type ItemNoQuartoProps = Colocado & { previa: boolean };

function ItemNoQuarto({ lugar, escolha, previa }: ItemNoQuartoProps) {
  const opacidade = previa ? 0.75 : undefined;
  const { x, y, tipo, lado } = lugar;
  const nome = `${escolha.item.nome}, ${escolha.cor.nome}`;
  if (tipo === 'tapete') {
    return (
      <g className="deco-item" opacity={opacidade} data-testid={`item-${lugar.id}`} aria-label={nome}>
        <ellipse cx={x} cy={y} rx="62" ry="30" fill={escolha.cor.tapete} stroke="var(--pulo-contorno)" strokeWidth="3" />
        <ellipse cx={x} cy={y} rx="44" ry="20" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="7 6" opacity=".8" />
      </g>
    );
  }
  const noChao = tipo === 'chao';
  return (
    <g
      className="deco-item"
      opacity={opacidade}
      data-testid={`item-${lugar.id}`}
      aria-label={nome}
      transform={lado ? `translate(${x} ${y}) skewY(${INCLINACAO[lado]}) translate(${-x} ${-y})` : undefined}
    >
      {noChao ? <ellipse cx={x} cy={y + 2} rx="20" ry="7" fill="rgba(59,42,47,.18)" /> : null}
      <text x={x} y={y + (noChao ? 0 : 14)} textAnchor="middle" fontSize={noChao ? 48 : 40} style={{ filter: escolha.cor.filtro }}>
        {escolha.item.emoji}
      </text>
    </g>
  );
}

/** Os itens no quarto, de trás para a frente. */
export function ItensDoQuarto({ colocados, previa }: { colocados: readonly Colocado[]; previa: Colocado | null }) {
  const todos = [...colocados.filter((c) => c.lugar.id !== previa?.lugar.id), ...(previa ? [previa] : [])];
  return (
    <>
      {todos
        .sort((a, b) => a.lugar.y - b.lugar.y)
        .map((c) => (
          <ItemNoQuarto key={`${c.lugar.id}-${c.escolha.item.id}-${c.escolha.cor.id}`} {...c} previa={c === previa} />
        ))}
    </>
  );
}

/** Os + do modo decorar. */
export function LugaresDoQuarto({ colocados, onAbrir }: { colocados: readonly Colocado[]; onAbrir: (lugar: Lugar) => void }) {
  const ocupados = new Set(colocados.map((c) => c.lugar.id));
  return (
    <>
      {LUGARES.map((lugar) => (
        <g
          key={lugar.id}
          className={`lugar${ocupados.has(lugar.id) ? ' tem' : ''}`}
          transform={`translate(${lugar.x} ${lugar.y - (lugar.tipo === 'chao' ? 36 : 0)})`}
          role="button"
          tabIndex={0}
          aria-label={`Decorar: ${lugar.nome}`}
          onClick={() => onAbrir(lugar)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            onAbrir(lugar);
          }}
        >
          <g className="pulso">
            <circle r="15" />
            <path d="M-7 0h14M0-7v14" />
          </g>
        </g>
      ))}
    </>
  );
}
