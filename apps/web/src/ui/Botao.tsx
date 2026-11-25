import type { ReactNode } from 'react';

import { Texto } from './Texto';

export type VarianteDeBotao = 'primario' | 'foco' | 'fantasma';

export type BotaoProps = {
  titulo: string;
  onPress?: () => void;
  variante?: VarianteDeBotao;
  desativado?: boolean;
  carregando?: boolean;
  /** Rótulo de acessibilidade; padrão: o título. */
  rotulo?: string;
  largura?: 'cheia' | 'auto';
  className?: string;
  testID?: string;
  tipo?: 'button' | 'submit';
  /** Mostra só o ícone (botão quadrado); o título continua como rótulo de acessibilidade. */
  icone?: ReactNode;
};

const VARIANTE: Record<VarianteDeBotao, string> = {
  primario: 'bg-sapo shadow-[inset_0_-4px_0_var(--pulo-sapo-borda)] text-ink-sobre-acao',
  foco: 'bg-foco shadow-[inset_0_-4px_0_var(--pulo-foco-borda)] text-ink-sobre-acao',
  fantasma: 'bg-transparent border-[1.5px] border-line shadow-[inset_0_-3px_0_var(--pulo-line)] text-ink',
};

/** Botão do rascunho (`.btn`): sombra interna de 4 px; pressionado, afunda 3 px. Texto sempre `ink` sobre as cores de ação. */
export function Botao({ titulo, onPress, variante = 'primario', desativado, carregando, rotulo, largura = 'cheia', className = '', testID, tipo = 'button', icone }: BotaoProps) {
  const bloqueado = !!desativado || !!carregando;
  return (
    <button
      type={tipo}
      onClick={bloqueado ? undefined : onPress}
      disabled={bloqueado}
      aria-label={rotulo ?? titulo}
      aria-busy={!!carregando}
      data-testid={testID}
      className={[
        'flex min-h-12 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md py-3',
        icone ? 'size-12 px-0' : 'px-[22px]',
        'transition-transform duration-75 enabled:active:translate-y-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-45',
        largura === 'cheia' ? 'w-full' : 'self-start',
        VARIANTE[variante],
        className,
      ].join(' ')}
    >
      {carregando ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {icone ?? (
        <Texto como="span" cor={variante === 'fantasma' ? 'ink' : 'inkSobreAcao'} linhas={1} className="font-extrabold">
          {titulo}
        </Texto>
      )}
    </button>
  );
}
