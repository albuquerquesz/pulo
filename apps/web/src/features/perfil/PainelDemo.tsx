import type { DemoClock } from '@pulo/core/demo';

import { BOTAO_PEQUENO } from './estilos';
import { Linhas } from './Linha';
import { Secao } from './Secao';

type PainelDemoProps = { relogio: DemoClock; onAvancar: () => void; onReiniciar: () => void };

/** Só no demo: andar no tempo e voltar ao começo, para a apresentação. */
export function PainelDemo({ relogio, onAvancar, onReiniciar }: PainelDemoProps) {
  const avancar = (passo: () => void) => () => {
    passo();
    onAvancar();
  };
  return (
    <Secao titulo="Modo demo">
      <div data-testid="painel-demo">
        <Linhas>
          <p className="py-3 text-[13px] text-muted">Dados de exemplo. Hoje no demo: {relogio.today()}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={avancar(() => relogio.advanceDays(1))} className={BOTAO_PEQUENO}>
              Avançar 1 dia
            </button>
            <button type="button" onClick={avancar(() => relogio.advanceWeeks(1))} className={BOTAO_PEQUENO}>
              Avançar 1 semana
            </button>
            <button type="button" onClick={onReiniciar} className={BOTAO_PEQUENO}>
              Reiniciar o demo
            </button>
          </div>
        </Linhas>
      </div>
    </Secao>
  );
}
