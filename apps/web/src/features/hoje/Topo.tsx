import { Link } from '@tanstack/react-router';

import { CARTAO } from './estilos';
import type { FocoDoTopo } from './logic';

/** O cartão do topo: saudação, próximo foco com o anel e o botão Começar foco. */
export function Topo({ saudacao, foco }: { saudacao: string; foco: FocoDoTopo }) {
  return (
    <section
      aria-label="Próximo foco"
      className={`${CARTAO} grid items-center gap-6 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--pulo-sapo)_22%,var(--pulo-surface)),var(--pulo-surface)_60%)] p-5 md:min-h-[200px] md:px-9 md:py-8 lg:grid-cols-[minmax(0,1fr)_auto]`}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-[32px] leading-[1.1] font-extrabold">{saudacao}</h1>
        <div className="mt-[18px] flex items-center gap-[18px]">
          <div className="relative size-24 shrink-0">
            <svg viewBox="0 0 100 100" aria-hidden="true" className="size-full -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" strokeWidth="10" className="stroke-line/85" />
              <circle cx="50" cy="50" r="44" fill="none" strokeWidth="10" strokeLinecap="round" pathLength="100" strokeDasharray="100 100" className="stroke-foco" />
            </svg>
            <b className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold">
              {foco.minutos}
              <small className="text-xs text-muted">min</small>
            </b>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <b className="text-[22px] leading-tight font-extrabold">{foco.titulo ?? 'Sem foco marcado'}</b>
            {foco.alvo ? (
              <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-line px-[9px] py-px text-xs font-extrabold text-muted">
                <span aria-hidden="true">{foco.alvo.icone}</span>
                {foco.alvo.titulo}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <Link
        to="/casa"
        search={foco.busca}
        className="flex min-h-11 items-center justify-center rounded-md bg-foco px-[30px] py-4 text-[17px] font-extrabold text-ink-sobre-acao shadow-[inset_0_-4px_0_var(--pulo-foco-borda)] active:translate-y-[3px] lg:self-end"
      >
        ▶ Começar foco
      </Link>
    </section>
  );
}
