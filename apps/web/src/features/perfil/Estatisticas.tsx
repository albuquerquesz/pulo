import type { ReactNode } from 'react';

import type { ProfileStats, Streak } from '@pulo/core/domain/types';

import { Foguinho } from '@/ui';

import { CARTAO } from './estilos';
import { numero } from './logic';
import { Secao } from './Secao';

type NumeroProps = { icone: ReactNode; fundo: string; valor: number; legenda: string };

function Numero({ icone, fundo, valor, legenda }: NumeroProps) {
  return (
    <li className={`${CARTAO} flex items-center gap-3 px-[18px] py-4`}>
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl text-xl ${fundo}`}>
        {icone}
      </span>
      <div className="min-w-0">
        <span className="block text-[13px] text-muted first-letter:uppercase">{legenda}</span>
        <b className="block text-2xl leading-[1.1] font-extrabold">{numero(valor)}</b>
      </div>
    </li>
  );
}

type EstatisticasProps = { sequencia: Pick<Streak, 'atual' | 'recorde'>; estatisticas: ProfileStats };

/** Os quatro números de todo o tempo (`.stats4`). */
export function Estatisticas({ sequencia, estatisticas }: EstatisticasProps) {
  return (
    <Secao titulo="Estatísticas">
      <ul className="grid gap-3 @md:grid-cols-2 @xl:grid-cols-4">
        <Numero icone={<Foguinho />} fundo="bg-foco/20" valor={sequencia.atual} legenda="dias seguidos" />
        <Numero icone="🏆" fundo="bg-sol/35" valor={sequencia.recorde} legenda="recorde de dias" />
        <Numero icone="✓" fundo="bg-sapo/22" valor={estatisticas.habitosFeitos} legenda="hábitos feitos" />
        <Numero icone="⏱️" fundo="bg-agua/25" valor={estatisticas.minutosDeFoco} legenda="minutos de foco" />
      </ul>
    </Secao>
  );
}
