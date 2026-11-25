import type { MascotState } from '@pulo/core/domain/types';

import { Avatar, Joia } from '@/ui';

import type { ContaNaTela } from '../casca/logic';
import { BOTAO_PEQUENO, CARTAO } from './estilos';
import { diasDeCuidado } from './logic';

function SapoMini() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="size-[34px]">
      <ellipse cx="20" cy="26" rx="13" ry="10" fill="#8FE05A" />
      <circle cx="13" cy="14" r="6" fill="#8FE05A" />
      <circle cx="27" cy="14" r="6" fill="#8FE05A" />
      <circle cx="13" cy="14" r="3" fill="#fff" />
      <circle cx="27" cy="14" r="3" fill="#fff" />
      <circle cx="13.6" cy="14.4" r="1.5" fill="#1f2a24" />
      <circle cx="27.6" cy="14.4" r="1.5" fill="#1f2a24" />
      <path d="M15 25q5 4 10 0" stroke="#1f2a24" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

type CabecalhoProps = {
  conta: ContaNaTela;
  desde: string;
  nomeDoSapo: string;
  sapo: MascotState | null;
  saldo: number;
  onEditar: () => void;
};

/** O topo do Perfil (`.perfil-hero`): avatar, nome e o bloco do sapo. */
export function Cabecalho({ conta, desde, nomeDoSapo, sapo, saldo, onEditar }: CabecalhoProps) {
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
          <div role="group" aria-label="Seu sapo" className="mt-3.5 inline-flex max-w-full items-center gap-3 rounded-md border border-line bg-surface px-4 py-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sapo/22">
              <SapoMini />
            </span>
            <span className="min-w-0">
              <b>{nomeDoSapo}, o sapo</b>
              <span className="block text-[13px] text-muted">
                Fase {sapo?.phase ?? 1} · {diasDeCuidado(sapo?.careDays ?? 0)}
              </span>
            </span>
            <span role="group" aria-label="joias (saldo)" className="ml-3 inline-flex items-center gap-1 font-extrabold">
              <Joia />
              {saldo}
            </span>
          </div>
        </div>
        <button type="button" onClick={onEditar} className={BOTAO_PEQUENO}>
          Editar perfil
        </button>
      </div>
    </div>
  );
}
