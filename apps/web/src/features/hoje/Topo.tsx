import { Link } from '@tanstack/react-router';

import { CARTAO } from './estilos';
import type { FocoDoTopo } from './logic';

/** O cartão do topo: saudação e o botão Começar foco, que abre a Casa já com o próximo foco. */
export function Topo({ saudacao, foco }: { saudacao: string; foco: FocoDoTopo }) {
  return (
    <section
      aria-label="Próximo foco"
      className={`${CARTAO} grid items-center gap-6 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--pulo-sapo)_22%,var(--pulo-surface)),var(--pulo-surface)_60%)] p-5 md:px-9 md:py-8 lg:grid-cols-[minmax(0,1fr)_auto]`}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-[32px] leading-[1.1] font-extrabold">{saudacao}</h1>
      </div>
      <Link
        to="/casa"
        search={foco.busca}
        className="flex min-h-11 items-center justify-center rounded-md bg-foco px-[30px] py-4 text-[17px] font-extrabold text-ink-sobre-acao shadow-[inset_0_-4px_0_var(--pulo-foco-borda)] active:translate-y-[3px]"
      >
        ▶ Começar foco
      </Link>
    </section>
  );
}
