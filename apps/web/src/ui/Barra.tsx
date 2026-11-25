export type BarraProps = {
  /** O que a barra mede, para leitores de tela. */
  rotulo: string;
  feito: number;
  total: number;
  /** Texto escrito no meio da barra. Sem ele, a barra é fina (14 px). */
  texto?: string;
  /** `sol`: concluída. */
  cor?: 'sapo' | 'sol';
  className?: string;
};

const COR = { sapo: 'bg-sapo', sol: 'bg-sol' } as const;

/** Barra de progresso do rascunho (`.barra`), com o brilho na parte de cima. */
export function Barra({ rotulo, feito, total, texto, cor = 'sapo', className = '' }: BarraProps) {
  const largura = total > 0 ? Math.min(100, (feito / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={feito}
      className={`relative overflow-hidden rounded-full bg-line/80 ${texto ? 'h-5' : 'h-3.5'} ${className}`}
    >
      <i className={`absolute inset-y-0 left-0 rounded-full shadow-[inset_0_4px_0_rgba(255,255,255,0.35)] ${COR[cor]}`} style={{ width: `${largura}%` }} />
      {texto ? (
        <span className="relative block text-center text-xs leading-5 font-extrabold [text-shadow:0_1px_0_color-mix(in_srgb,var(--pulo-surface)_60%,transparent)]">
          {texto}
        </span>
      ) : null}
    </div>
  );
}
