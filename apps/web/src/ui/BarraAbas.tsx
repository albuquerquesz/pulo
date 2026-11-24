import type { ReactNode } from 'react';

import { Texto } from './Texto';

type IconeProps = { classe: string; tamanho: number };

export type AbaDaBarra = {
  chave: string;
  rotulo: string;
  /** Ícone próprio. Sem ele, usa o ícone padrão da chave (hoje, ilha, rotina, foco, metas, progresso, perfil). */
  icone?: (p: IconeProps) => ReactNode;
};

export type BarraAbasProps = {
  abas: AbaDaBarra[];
  ativa: string;
  onSelecionar: (chave: string) => void;
  className?: string;
  testID?: string;
};

const TRACO = { strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

const ICONES: Record<string, ReactNode> = {
  hoje: (
    <>
      <path d="M3 11 L12 4 L21 11" {...TRACO} />
      <path d="M6 10 L6 20 L18 20 L18 10" {...TRACO} />
    </>
  ),
  rotina: (
    <>
      <rect x={4} y={5} width={16} height={15} rx={3} {...TRACO} />
      <path d="M4 10 L20 10 M9 3 L9 7 M15 3 L15 7" {...TRACO} />
    </>
  ),
  foco: (
    <>
      <circle cx={12} cy={12} r={8} {...TRACO} />
      <path d="M12 7 L12 12 L15 14" {...TRACO} />
    </>
  ),
  metas: (
    <>
      <path d="M6 21 L6 4" {...TRACO} />
      <path d="M6 4.5 L18 4.5 L15 9 L18 13.5 L6 13.5" {...TRACO} />
    </>
  ),
  ilha: (
    <>
      <path d="M3 18 C 7 15.5 17 15.5 21 18" {...TRACO} />
      <path d="M12 16 C 12 12 11 9 9 6.5" {...TRACO} />
      <path d="M9 6.5 C 7 5 4.5 5.5 3.5 7.5 M9 6.5 C 11 4.5 14 5 15 7 M9 6.5 C 9 4.5 10.5 3 12.5 3" {...TRACO} />
    </>
  ),
  progresso: <path d="M4 19 L4 14 M10 19 L10 9 M16 19 L16 12 M21 19 L21 5" {...TRACO} />,
  perfil: (
    <>
      <circle cx={12} cy={8.5} r={3.8} {...TRACO} />
      <path d="M4.5 20 C5.5 15.5 18.5 15.5 19.5 20" {...TRACO} />
    </>
  ),
};

function IconePadrao({ chave, classe, tamanho }: IconeProps & { chave: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden className={classe}>
      {ICONES[chave] ?? <circle cx={12} cy={12} r={6} {...TRACO} />}
    </svg>
  );
}

/**
 * Barra de abas. A ativa tem pílula de sapo e texto `ink`; a inativa usa `muted`.
 * Mobile first: embaixo no celular, vira coluna lateral a partir de md.
 */
export function BarraAbas({ abas, ativa, onSelecionar, className = '', testID }: BarraAbasProps) {
  return (
    <nav role="tablist" data-testid={testID} className={`flex border-t-2 border-line bg-surface px-1 pt-1.5 pb-2 md:flex-col md:gap-2 md:border-t-0 md:border-r-2 md:px-2 md:pt-6 ${className}`}>
      {abas.map((a) => {
        const sel = a.chave === ativa;
        // ink de ação sobre a pílula sapo (sempre escuro); muted nas inativas
        const classe = sel ? 'stroke-ink-sobre-acao' : 'stroke-muted';
        return (
          <button
            key={a.chave}
            type="button"
            role="tab"
            onClick={() => onSelecionar(a.chave)}
            aria-label={a.rotulo}
            aria-selected={sel}
            className="flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 md:flex-none md:py-2"
          >
            <span className={`flex h-8 w-14 items-center justify-center rounded-full ${sel ? 'bg-sapo' : ''}`}>
              {a.icone ? a.icone({ classe, tamanho: 24 }) : <IconePadrao chave={a.chave} classe={classe} tamanho={24} />}
            </span>
            <Texto como="span" variante="legenda" cor={sel ? 'ink' : 'muted'} className={sel ? 'font-extrabold' : ''}>
              {a.rotulo}
            </Texto>
          </button>
        );
      })}
    </nav>
  );
}
