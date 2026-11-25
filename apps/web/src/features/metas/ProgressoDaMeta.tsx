import { Barra, Bau } from '@/ui';

import type { MetaDoTrilho } from '../casca/logic';

type ProgressoDaMetaProps = {
  meta: MetaDoTrilho;
  /** Tamanho e margens do baú, que mudam em cada lugar do rascunho. */
  bau: string;
  grande?: boolean;
  /** Linha de ritmo, em porcentagem da barra. */
  marca?: number;
  /** Com ele, o baú que espera para ser aberto vira botão. */
  onAbrirBau?: () => void;
};

/** A barra de marcos com o baú do lado (`.linha-b`): lista, detalhe, trilho e página do hábito. */
export function ProgressoDaMeta({ meta, bau, grande = false, marca, onAbrirBau }: ProgressoDaMetaProps) {
  const pronto = meta.concluida && !meta.bauAberto;
  const desenho = <Bau aberto={meta.bauAberto} className={bau} />;
  return (
    <div className={`flex items-center ${grande ? 'gap-3' : 'gap-2'}`}>
      <Barra
        rotulo={meta.titulo}
        feito={meta.feito}
        total={meta.total}
        texto={`${meta.feito} / ${meta.total}`}
        grande={grande}
        marca={marca}
        cor={meta.concluida ? 'sol' : 'sapo'}
        className="flex-1"
      />
      {pronto && onAbrirBau ? (
        <button type="button" data-bau-esperando aria-label="Abrir o baú" onClick={onAbrirBau} className="flex cursor-pointer motion-safe:animate-tremula">
          {desenho}
        </button>
      ) : (
        desenho
      )}
    </div>
  );
}
