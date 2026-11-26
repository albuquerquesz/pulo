import type { FrogEvent } from '@pulo/core/domain/types';

import type { Momento } from '@/mascot/momentos';
import { SapoRosto } from '@/mascot/sapo/SapoRosto';
import { useTheme } from '@/theme';

import { useApp } from '../app';

/** Os eventos que fazem o sapo aparecer por cima da tela. Os outros ficam na lagoa. */
const MOMENTO_DA_REACAO: Partial<Record<FrogEvent, Momento>> = {
  comemorando: 'conquista',
  construindo: 'compra-na-ilha',
};

/** O sapo pula no canto da tela para comemorar uma conquista ou martelar uma parte nova. */
export function ReacaoDoSapo() {
  const { evento } = useApp();
  const { movimento } = useTheme();
  const momento = evento ? MOMENTO_DA_REACAO[evento] : undefined;
  if (!momento) return null;
  return (
    <div className="pointer-events-none fixed right-2 bottom-44 z-30 md:right-8 md:bottom-28">
      <div key={momento} className={movimento.saltos ? 'sapo-chegando' : undefined}>
        <SapoRosto momento={momento} className="w-[160px]" />
      </div>
    </div>
  );
}
