import { CARTAO, ROTULO_DO_NUMERO, TITULO } from './estilos';
import type { GraficoDaSemana, TipoDaBarra } from './logic';

const COR_DA_BARRA: Record<TipoDaBarra, string> = { foco: 'bg-sapo', descanso: 'bg-descanso', gelo: 'bg-agua', vazia: 'bg-line' };
const PREFIXO_DA_BARRA: Record<TipoDaBarra, string> = { foco: '', descanso: 'descanso, ', gelo: 'protegido por gelo, ', vazia: '' };

/** O gráfico da semana, com o foco e as joias somados. */
export function EstaSemana({ grafico }: { grafico: GraficoDaSemana }) {
  return (
    <section aria-label="Esta semana" className={`${CARTAO} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <h2 className={TITULO}>Esta semana</h2>
        <dl className="flex gap-6">
          <div>
            <dt className={ROTULO_DO_NUMERO}>Foco</dt>
            <dd className="text-xl font-extrabold">{grafico.minutos} min</dd>
          </div>
          <div>
            <dt className={ROTULO_DO_NUMERO}>Joias</dt>
            <dd className="text-xl font-extrabold">+{grafico.joias}</dd>
          </div>
        </dl>
      </div>
      <ol aria-label="Foco por dia" className="mt-3.5 grid h-[110px] grid-cols-7 items-end gap-2">
        {grafico.barras.map((barra) => (
          <li key={barra.date} data-tipo={barra.tipo} className="flex h-full flex-col items-center justify-end gap-1.5">
            <i aria-hidden="true" className={`w-full rounded-[8px] ${COR_DA_BARRA[barra.tipo]}`} style={{ height: `${barra.altura}%` }} />
            <span aria-hidden="true" className="text-[11px] text-muted">
              {barra.letra}
            </span>
            <span className="sr-only">{`${barra.letra}: ${PREFIXO_DA_BARRA[barra.tipo]}${barra.minutos} min de foco`}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
