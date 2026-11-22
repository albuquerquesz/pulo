import { Texto } from './Texto';

export type VarianteDeToast = 'sucesso' | 'aviso';

export type ToastProps = {
  mensagem: string;
  variante?: VarianteDeToast;
  /** Texto da ação (ex.: "Desfazer"). Sem ele, o toast não tem botão. */
  acao?: string;
  onAcao?: () => void;
  /** Controla a entrada e a saída. Padrão true. */
  visivel?: boolean;
  className?: string;
  testID?: string;
};

const VARIANTE: Record<VarianteDeToast, string> = {
  sucesso: 'bg-sapo border-sapo-borda',
  aviso: 'bg-atencao border-foco-borda',
};

/** Aviso curto. Entra deslizando (ou só com fade, se reduzir movimento). Texto sempre `ink`. */
export function Toast({ mensagem, variante = 'sucesso', acao, onAcao, visivel = true, className = '', testID }: ToastProps) {
  return (
    <div
      data-testid={testID}
      role="status"
      aria-live="polite"
      aria-label={acao ? `${mensagem}. ${acao} disponível` : mensagem}
      className={[
        'flex min-h-14 items-center gap-2.5 rounded-md border-b-4 py-2 pr-2 pl-3.5 transition-[opacity,translate] duration-200',
        visivel ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0',
        VARIANTE[variante],
        className,
      ].join(' ')}
    >
      <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <circle cx={12} cy={12} r={11} className="fill-ink-sobre-acao" fillOpacity={0.14} />
        {variante === 'sucesso' ? (
          <path d="M6.5 12.5 L10.5 16 L17.5 8" className="stroke-ink-sobre-acao" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : (
          <>
            <path d="M12 6.5 L12 13" className="stroke-ink-sobre-acao" strokeWidth={2.6} strokeLinecap="round" />
            <circle cx={12} cy={17} r={1.6} className="fill-ink-sobre-acao" />
          </>
        )}
      </svg>
      <Texto cor="inkSobreAcao" className="flex-1">
        {mensagem}
      </Texto>
      {acao ? (
        <button type="button" onClick={onAcao} aria-label={acao} className="min-h-11 min-w-11 cursor-pointer rounded-sm bg-ink-sobre-acao/12 px-3.5">
          <Texto como="span" variante="subtitulo" cor="inkSobreAcao">
            {acao}
          </Texto>
        </button>
      ) : null}
    </div>
  );
}
