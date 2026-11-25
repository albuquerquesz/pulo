import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { AccentColor } from '@pulo/core/domain/types';
import { CasaDaIlha } from '@/mascot/ilha/CasaDaIlha';
import { Barra, Bau, Foguinho, Joia } from '@/ui';

import { fraseDaProximaParte, type DadosDoTrilho, type MetaDoTrilho } from './logic';

const CARTAO = 'rounded-md border border-b-4 border-line bg-surface';
const ICONE = 'contorno-branco block size-[30px] shrink-0';

type NumeroProps = { titulo: string; valor: ReactNode; cor: string; icone: ReactNode };

function Numero({ titulo, valor, cor, icone }: NumeroProps) {
  return (
    <span
      role="group"
      title={titulo}
      aria-label={titulo}
      className={`inline-flex cursor-default items-center gap-2 rounded-sm px-2.5 py-1.5 text-[19px] leading-none font-extrabold tabular-nums hover:bg-line/50 ${cor}`}
    >
      {icone}
      {valor}
    </span>
  );
}

/** A linha de números do dia: sequência, hábitos, foco e joias. */
export function NumerosDoDia({ dados }: { dados: DadosDoTrilho }) {
  return (
    <div data-testid="numeros-do-dia" className="flex items-center justify-between px-1 pt-1 md:px-3">
      <Numero titulo="dias seguidos" valor={dados.sequencia} cor="text-foco" icone={<Foguinho className="contorno-branco -m-[3px] size-9" />} />
      <Numero
        titulo="hábitos feitos hoje"
        valor={`${dados.habitos.feitos}/${dados.habitos.total}`}
        cor="text-sapo"
        icone={
          <svg viewBox="0 0 24 24" aria-hidden="true" className={ICONE}>
            <rect x="2" y="2" width="20" height="20" rx="6" className="fill-sapo" />
            <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#1f2a24" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />
      <Numero
        titulo="minutos de foco hoje"
        valor={dados.minutosDeFoco}
        cor="text-numero-foco"
        icone={
          <svg viewBox="0 0 24 24" aria-hidden="true" className={ICONE}>
            <rect x="9" y="1" width="6" height="3" rx="1.5" className="fill-foco-borda" />
            <circle cx="12" cy="14" r="9" className="fill-foco" />
            <circle cx="12" cy="14" r="6.3" fill="#fff4ee" />
            <path d="M12 14V10" className="stroke-foco-borda" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        }
      />
      <Numero titulo="joias (saldo)" valor={dados.joias} cor="text-numero-joia" icone={<Joia largura={26} altura={30} contorno="branco" />} />
    </div>
  );
}

export function CartaoDaCasa({ dados }: { dados: DadosDoTrilho }) {
  const frase = fraseDaProximaParte(dados.proximaParte);
  const construidas = dados.partesConstruidas.length;
  return (
    <section aria-label="Sua casa" className={`${CARTAO} shrink-0 overflow-hidden`}>
      <CasaDaIlha construidas={dados.partesConstruidas} viewBox="110 110 780 700" rotulo="Sua casa" className="block h-[230px] w-full bg-ceu" />
      <div className="flex flex-col gap-3.5 px-5 pt-[22px] pb-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold">Sua casa</h2>
          <span className="text-[13px] text-muted">
            {construidas} de {dados.totalDePartes} partes
          </span>
        </div>
        <Barra rotulo="Partes da casa construídas" feito={construidas} total={dados.totalDePartes} />
        <p className="text-sm text-muted">
          {frase.antes}
          <b className="text-ink">{frase.destaque}</b>
          {frase.depois}
        </p>
        <Link
          to="/casa"
          className="mt-3.5 flex min-h-11 w-full items-center justify-center rounded-md bg-foco px-[22px] py-3 font-extrabold text-ink-sobre-acao shadow-[inset_0_-4px_0_var(--pulo-foco-borda)] active:translate-y-[3px]"
        >
          Focar
        </Link>
      </div>
    </section>
  );
}

const FUNDO_DA_META: Record<AccentColor, string> = {
  sapo: 'bg-sapo/25',
  agua: 'bg-agua/25',
  foco: 'bg-foco/22',
  descanso: 'bg-descanso/25',
  sol: 'bg-sol/25',
  atencao: 'bg-atencao/25',
};

function Meta({ meta }: { meta: MetaDoTrilho }) {
  return (
    <li className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3.5">
      <span aria-hidden="true" className={`grid size-12 place-items-center rounded-[14px] text-2xl shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)] ${FUNDO_DA_META[meta.cor]}`}>
        {meta.icone}
      </span>
      <div>
        <b className="mb-1.5 block">{meta.titulo}</b>
        <div className="flex items-center gap-2">
          <Barra
            rotulo={meta.titulo}
            feito={meta.feito}
            total={meta.total}
            texto={`${meta.feito} / ${meta.total}`}
            cor={meta.concluida ? 'sol' : 'sapo'}
            className="flex-1"
          />
          <Bau aberto={meta.bauAberto} className="-my-4 -mr-1 size-14" />
        </div>
      </div>
    </li>
  );
}

export function CartaoDasMetas({ metas }: { metas: MetaDoTrilho[] }) {
  return (
    <section aria-label="Metas" className={`${CARTAO} flex shrink-0 flex-col gap-10 p-6`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-extrabold">Metas</h2>
        <Link to="/metas" className="text-[13px] font-extrabold tracking-wide text-sapo-borda">
          Ver todas
        </Link>
      </div>
      {metas.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma meta por enquanto.</p>
      ) : (
        <ul className="flex flex-col gap-10">
          {metas.map((m) => (
            <Meta key={m.id} meta={m} />
          ))}
        </ul>
      )}
    </section>
  );
}
