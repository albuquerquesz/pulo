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
  primario: 'bg-sapo border-sapo-borda text-ink-sobre-acao',
  foco: 'bg-foco border-foco-borda text-ink-sobre-acao',
  fantasma: 'bg-transparent border-line border-2 text-ink',
};

/** Botão com borda inferior de 4 px; pressionado, afunda 3 px. Texto sempre `ink` sobre as cores de ação. */
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
        'flex min-h-[52px] min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md border-b-4',
        icone ? 'size-[52px] px-0' : 'px-5',
        'transition-transform duration-75 enabled:active:translate-y-[3px] enabled:active:border-b',
        'disabled:cursor-not-allowed disabled:opacity-45',
        largura === 'cheia' ? 'w-full' : 'self-start',
        VARIANTE[variante],
        className,
      ].join(' ')}
    >
      {carregando ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {icone ?? (
        <Texto como="span" variante="subtitulo" cor={variante === 'fantasma' ? 'ink' : 'inkSobreAcao'} linhas={1}>
          {titulo}
        </Texto>
      )}
    </button>
  );
}
