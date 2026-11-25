export type PlacaProps = {
  titulo: string;
  onPress?: () => void;
  /** `escura`: foco rodando. `clara`: decorando. */
  tom?: 'madeira' | 'escura' | 'clara';
  rotulo?: string;
};

const TOM = { madeira: 'bg-creme text-contorno', escura: 'bg-contorno text-creme', clara: 'bg-lima-clara text-contorno' } as const;

/** Botão de placa de madeira do Focar (`.placa`). */
export function Placa({ titulo, onPress, tom = 'madeira', rotulo }: PlacaProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={rotulo ?? titulo}
      className={`min-w-[190px] cursor-pointer rounded-2xl border-4 border-contorno px-[30px] py-2.5 text-2xl font-black tracking-wider uppercase shadow-[0_0_0_6px_var(--pulo-madeira),0_0_0_10px_var(--pulo-contorno),0_8px_0_10px_rgba(59,42,47,0.35)] active:translate-y-[3px] ${TOM[tom]}`}
    >
      {titulo}
    </button>
  );
}
