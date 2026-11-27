export type ChaveProps = {
  rotulo: string;
  ligada: boolean;
  onMudar: (ligada: boolean) => void;
  desativada?: boolean;
};

/** O interruptor do rascunho (`.chave`), com área de toque de 44 px. */
export function Chave({ rotulo, ligada, onMudar, desativada = false }: ChaveProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligada}
      aria-label={rotulo}
      disabled={desativada}
      onClick={() => onMudar(!ligada)}
      className="group grid min-h-11 shrink-0 cursor-pointer place-items-center disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0"
    >
      {/* A bolinha desliza com um leve quique e estica enquanto o dedo aperta; o fundo troca de cor junto. */}
      <span
        className={`relative block h-[26px] w-[46px] rounded-full transition-[background-color,box-shadow] duration-200 ${
          ligada ? 'bg-sapo shadow-[inset_0_-2px_0_var(--pulo-sapo-borda)]' : 'bg-line shadow-[inset_0_-2px_0_rgba(0,0,0,0.08)]'
        }`}
      >
        <i
          className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-surface shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-[translate,width] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-enabled:group-active:w-6 ${
            ligada ? 'translate-x-5 group-enabled:group-active:translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}
