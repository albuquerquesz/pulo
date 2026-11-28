type CampoProps = {
  rotulo: string;
  valor: string;
  onMudar: (valor: string) => void;
  maximo: number;
  autoComplete?: string;
  dica?: string;
};

/** Campo de texto com o rótulo em cima. */
export function Campo({ rotulo, valor, onMudar, maximo, autoComplete = 'off', dica }: CampoProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-black tracking-wider text-muted uppercase">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        maxLength={maximo}
        autoComplete={autoComplete}
        placeholder={dica}
        className="min-h-[54px] w-full rounded-[18px] border-[3px] border-contorno bg-surface px-4 text-lg font-extrabold text-ink placeholder:text-muted"
      />
    </label>
  );
}
