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
      className="grid min-h-11 shrink-0 cursor-pointer place-items-center disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0"
    >
      <span className={`relative block h-[26px] w-[46px] rounded-full ${ligada ? 'bg-sapo' : 'bg-line'}`}>
        <i className={`absolute top-[3px] size-5 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.25)] ${ligada ? 'left-[23px]' : 'left-[3px]'}`} />
      </span>
    </button>
  );
}
