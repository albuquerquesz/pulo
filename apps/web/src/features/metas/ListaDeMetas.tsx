import type { EntityId, Goal, GoalChest } from '@pulo/core/domain/types';
import { FUNDO_DA_COR } from '@/ui';

import { metaNaTela } from '../casca/logic';
import { CARTAO } from '../hoje/estilos';
import { ICONE } from './estilos';
import type { DadosMetas } from './logic';
import { ProgressoDaMeta } from './ProgressoDaMeta';

type ItemProps = { meta: Goal; baus: readonly GoalChest[]; selecionada: boolean; onSelecionar: () => void };

function Item({ meta, baus, selecionada, onSelecionar }: ItemProps) {
  const naTela = metaNaTela(meta, baus);
  return (
    <button
      type="button"
      aria-pressed={selecionada}
      aria-label={`${naTela.titulo}, ${naTela.feito} de ${naTela.total} marcos`}
      onClick={onSelecionar}
      className={`${CARTAO} grid w-full cursor-pointer grid-cols-[48px_minmax(0,1fr)] items-center gap-3.5 px-[18px] py-4 text-left ${
        selecionada ? 'border-sapo shadow-[0_0_0_2px_color-mix(in_srgb,var(--pulo-sapo)_35%,transparent)]' : 'hover:border-sapo/50'
      }`}
    >
      <span aria-hidden="true" className={`${ICONE} size-12 rounded-[14px] text-2xl ${FUNDO_DA_COR[naTela.cor]}`}>
        {naTela.icone}
      </span>
      <span className="block min-w-0">
        <b className="mb-1.5 block">{naTela.titulo}</b>
        <ProgressoDaMeta meta={naTela} bau="-my-3 -mr-1 size-11" />
      </span>
    </button>
  );
}

type ListaDeMetasProps = {
  dados: DadosMetas;
  selecionada: EntityId;
  onSelecionar: (id: EntityId) => void;
};

/** A lista da esquerda: em andamento e concluídas. */
export function ListaDeMetas({ dados, selecionada, onSelecionar }: ListaDeMetasProps) {
  const grupos = [
    { titulo: 'Em andamento', metas: dados.ativas },
    { titulo: 'Concluídas', metas: dados.concluidas },
  ];
  return (
    <div className="flex flex-col gap-3">
      {grupos.map((g) => (
        <section key={g.titulo} aria-label={g.titulo} className="flex flex-col gap-3">
          <h3 className="mx-1 mt-2 text-[13px] font-extrabold tracking-[0.06em] text-muted uppercase">{g.titulo}</h3>
          {g.metas.map((meta) => (
            <Item key={meta.id} meta={meta} baus={dados.baus} selecionada={meta.id === selecionada} onSelecionar={() => onSelecionar(meta.id)} />
          ))}
        </section>
      ))}
    </div>
  );
}
