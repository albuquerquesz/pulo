import { Avatar } from '@/ui';

import type { ContaNaTela } from '../casca/logic';
import { BOTAO_PEQUENO, CARTAO } from './estilos';

type CabecalhoProps = {
  conta: ContaNaTela;
  desde: string;
  onEditar: () => void;
};

/** O topo do Perfil (`.perfil-hero`): avatar e nome. */
export function Cabecalho({ conta, desde, onEditar }: CabecalhoProps) {
  return (
    <div className="@container">
      <div
        className={`${CARTAO} grid justify-items-start gap-4 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--pulo-sapo)_18%,var(--pulo-surface)),var(--pulo-surface)_65%)] p-5 @xl:grid-cols-[auto_minmax(0,1fr)_auto] @xl:items-center @xl:gap-6 @xl:p-7`}
      >
        <Avatar nome={conta.nome} foto={conta.foto} className="size-24 text-[40px] shadow-[inset_0_-6px_0_var(--pulo-sapo-borda)]" />
        <div className="max-w-full min-w-0">
          <h1 className="text-[30px] leading-[1.1] font-extrabold break-words">{conta.nome}</h1>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted">
            {conta.email ? <span className="break-all">{conta.email}</span> : null}
            <span>{desde}</span>
          </p>
        </div>
        <button type="button" onClick={onEditar} className={BOTAO_PEQUENO}>
          Editar perfil
        </button>
      </div>
    </div>
  );
}
