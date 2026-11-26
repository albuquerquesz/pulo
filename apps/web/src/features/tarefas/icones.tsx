import type { ReactNode } from 'react';

import type { TaskStatus } from '@pulo/core/domain/types';

const Icone = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
    {children}
  </svg>
);

export const ICONE_DO_STATUS: Record<TaskStatus, ReactNode> = {
  ideias: (
    <Icone>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 2" />
    </Icone>
  ),
  afazer: (
    <Icone>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Icone>
  ),
  fazendo: (
    <Icone>
      <circle cx="8" cy="8" r="6" fill="none" className="stroke-agua" strokeWidth="1.6" />
      <path d="M8 2a6 6 0 0 1 0 12z" className="fill-agua" />
    </Icone>
  ),
  feito: (
    <Icone>
      <circle cx="8" cy="8" r="7" className="fill-sapo" />
      <path d="m5 8.2 2 2 4-4.2" fill="none" className="stroke-ink-sobre-acao" strokeWidth="1.8" strokeLinecap="round" />
    </Icone>
  ),
};

export const IconeDaPrioridade = ({ alta }: { alta: boolean }) => (
  <Icone>
    {alta ? (
      <g className="fill-foco">
        <rect x="2" y="9" width="3" height="5" rx="1" />
        <rect x="6.5" y="5.5" width="3" height="8.5" rx="1" />
        <rect x="11" y="2" width="3" height="12" rx="1" />
      </g>
    ) : (
      <path d="M2 8h2M7 8h2M12 8h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    )}
  </Icone>
);

export const IconeDoPrazo = () => (
  <Icone>
    <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" />
  </Icone>
);

export const IconeDaEtiqueta = () => (
  <Icone>
    <path d="M2 3h7l5 5-5 5H2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </Icone>
);

export const IconeDaMeta = () => (
  <Icone>
    <path d="M3 15V2h8l-1.5 3L11 8H3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </Icone>
);
