import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { ABAS, type ChaveDaAba } from './logic';

const ICONES: Record<ChaveDaAba, ReactNode> = {
  hoje: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  ilha: <path d="M12 21V9M12 9C9 5 5 6 4 8M12 9c3-4 7-3 8-1M12 9c-2-3-1-6 1-6M3 21h18" />,
  tarefas: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="13" rx="1.5" />
    </>
  ),
  habitos: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  metas: <path d="M5 21V4h11l-2 4 2 4H5" />,
};

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0">
      {children}
    </svg>
  );
}

/**
 * O menu: embaixo no celular, em coluna na barra lateral a partir de md.
 */
export function Navegacao({ ativa }: { ativa: ChaveDaAba | null }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 flex gap-1 border-t border-line bg-[color-mix(in_srgb,var(--pulo-bg)_55%,var(--pulo-surface))] px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:static md:flex-col md:border-0 md:bg-transparent md:p-0"
    >
      {ABAS.map((aba) => {
        const sel = aba.chave === ativa;
        return (
          <Link
            key={aba.chave}
            to={aba.para}
            aria-current={sel ? 'page' : undefined}
            className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-sm text-xs font-bold md:min-h-0 md:flex-none md:flex-row md:justify-start md:gap-3 md:px-3 md:py-[11px] md:text-[15px] md:leading-[1.45] ${
              sel
                ? 'bg-sapo text-ink-sobre-acao shadow-[inset_0_-3px_0_var(--pulo-sapo-borda)]'
                : 'text-muted hover:bg-sapo/14 hover:text-ink'
            }`}
          >
            <Icone>{ICONES[aba.chave]}</Icone>
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
