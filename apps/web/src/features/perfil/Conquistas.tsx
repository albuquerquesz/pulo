import type { ReactNode } from 'react';

import type { AchievementId } from '@pulo/core/domain/types';

import { Barra, Foguinho } from '@/ui';

import { CARTAO } from './estilos';
import type { Medalha } from './logic';
import { Secao } from './Secao';

const FOGO = { icone: <Foguinho />, fundo: 'bg-foco/22' };

const VISUAL: Record<AchievementId, { icone: ReactNode; fundo: string }> = {
  'primeira-semana': FOGO,
  'foco-profundo': { icone: '⏱️', fundo: 'bg-agua/25' },
  'descanso-sabido': { icone: '☾', fundo: 'bg-descanso/28' },
  'mes-de-fogo': FOGO,
  'casa-inteira': { icone: '🏡', fundo: 'bg-sol/35' },
  segredo: { icone: '✨', fundo: 'bg-sol/35' },
};

/** As medalhas em grade (`.conq`): conquistadas, em andamento com a barra e a secreta como "?". */
export function Conquistas({ medalhas }: { medalhas: readonly Medalha[] }) {
  return (
    <Secao titulo="Conquistas">
      <ul className={`${CARTAO} grid gap-3 p-5 @lg:grid-cols-2 @xl:grid-cols-3`}>
        {medalhas.map((m) => {
          const secreta = m.estado === 'secreta';
          const visual = VISUAL[m.id];
          return (
            <li key={m.id} data-estado={m.estado} className={`flex items-center gap-3.5 rounded-md border border-line p-3.5 ${secreta ? 'opacity-55' : ''}`}>
              <span
                aria-hidden="true"
                className={`grid size-[52px] shrink-0 place-items-center rounded-2xl text-[26px] shadow-[inset_0_-4px_0_rgba(0,0,0,0.12)] ${secreta ? 'bg-line font-extrabold text-muted' : visual.fundo}`}
              >
                {secreta ? '?' : visual.icone}
              </span>
              <div className="min-w-0 flex-1">
                <b>{m.nome}</b>
                <small className="block text-xs text-muted">{m.detalhe}</small>
                {m.estado === 'andando' ? <Barra rotulo={m.nome} feito={m.progresso} total={m.meta} className="my-1 !h-2" /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}
