import { CARTAO, LEGENDA, TITULO } from './estilos';
import type { HabitoDeHoje } from './logic';

type HabitosDeHojeProps = { habitos: HabitoDeHoje[]; onAlternar: (habito: HabitoDeHoje) => void };

/** Os hábitos do dia: um toque marca e risca. */
export function HabitosDeHoje({ habitos, onAlternar }: HabitosDeHojeProps) {
  return (
    <section aria-label="Hábitos de hoje" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={TITULO}>Hábitos de hoje</h2>
        {habitos.length > 0 ? (
          <span className={`${LEGENDA} tabular-nums`}>
            {habitos.filter((h) => h.feito).length} de {habitos.length}
          </span>
        ) : null}
      </div>
      {habitos.length === 0 ? (
        <p className={`${CARTAO} p-5 text-muted`}>Nenhum hábito para hoje.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {habitos.map((h) => (
            <button
              key={h.id}
              type="button"
              role="checkbox"
              aria-checked={h.feito}
              aria-label={h.titulo}
              onClick={() => onAlternar(h)}
              className={`${CARTAO} flex cursor-pointer items-center gap-3 px-4 py-3.5 text-left`}
            >
              <span
                aria-hidden="true"
                className={`grid size-[26px] shrink-0 place-items-center rounded-full border-[2.5px] ${h.feito ? 'border-sapo-borda bg-sapo text-ink-sobre-acao' : 'border-muted'}`}
              >
                {h.feito ? '✓' : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <b className={h.feito ? 'text-muted line-through' : undefined}>{h.titulo}</b>
                <span className={LEGENDA}>{h.quando}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
