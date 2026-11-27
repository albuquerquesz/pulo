import type { KeyboardEvent, Ref } from 'react';

import { idDaCompra, tintaDe, type Escolha } from './catalogo';
import type { Colocados } from './decoracao';
import { MOVEIS_NA_ORDEM_DE_DESENHO, type LugarId, type Movel } from './mobilia';
import { SapoDaCasa } from './SapoDaCasa';

/** O sapo é desenhado logo depois deste lugar. */
const ANTES_DO_SAPO: LugarId = 'bau';

type MovelNoLugarProps = {
  lugar: Movel;
  /** O que o lugar mostra; sem nada, o contorno tracejado (só ao decorar). */
  visto: Escolha | undefined;
  previa: boolean;
  escolhido: boolean;
  /** Com ele, o lugar é um botão. */
  onAbrir?: (lugar: Movel) => void;
};

function MovelNoLugar({ lugar, visto, previa, escolhido, onAbrir }: MovelNoLugarProps) {
  if (!visto && !onAbrir) return null;
  const abrir = onAbrir
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': `Decorar: ${lugar.nome}`,
        'aria-pressed': escolhido,
        onClick: () => onAbrir(lugar),
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          onAbrir(lugar);
        },
      }
    : { 'aria-hidden': !visto };
  return (
    <g data-lugar={lugar.id} className={`lugar-do-quarto${escolhido ? ' escolhido' : ''}`} {...abrir}>
      {visto ? (
        <g data-testid={`item-${lugar.id}`} aria-label={`${visto.modelo.nome}, ${visto.cor.nome}`} className={previa ? 'previa' : undefined}>
          {/* A chave troca o elemento junto com o móvel: a animação do antigo não passa para o novo. */}
          <g key={idDaCompra(visto)} className="movel">
            <visto.modelo.Desenho cor={tintaDe(visto)} />
          </g>
        </g>
      ) : (
        <g className="fantasma">
          <lugar.Fantasma />
        </g>
      )}
    </g>
  );
}

type MobiliaProps = {
  colocados: Colocados;
  /** O que a pessoa está olhando antes de comprar. */
  previa: Escolha | null;
  escolhido: LugarId | null;
  onAbrir?: (lugar: Movel) => void;
  sapo?: Ref<SVGGElement>;
};

/** Os móveis e o sapo, de trás para a frente. */
export function Mobilia({ colocados, previa, escolhido, onAbrir, sapo }: MobiliaProps) {
  return (
    <>
      {MOVEIS_NA_ORDEM_DE_DESENHO.map((lugar) => {
        const atual = colocados.get(lugar.id);
        const daPrevia = previa?.lugar.id === lugar.id ? previa : undefined;
        const ehPrevia = daPrevia !== undefined && (!atual || idDaCompra(atual) !== idDaCompra(daPrevia));
        return (
          <g key={lugar.id}>
            <MovelNoLugar lugar={lugar} visto={daPrevia ?? atual} previa={ehPrevia} escolhido={lugar.id === escolhido} onAbrir={onAbrir} />
            {lugar.id === ANTES_DO_SAPO ? <SapoDaCasa ref={sapo} /> : null}
          </g>
        );
      })}
    </>
  );
}
