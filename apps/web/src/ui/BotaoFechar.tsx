/** O X redondo de fechar, no canto dos modais. */
export function BotaoFechar({ onFechar, className = '' }: { onFechar: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onFechar}
      aria-label="Fechar"
      title="Fechar"
      className={`absolute z-2 grid size-11 cursor-pointer place-items-center rounded-full border-4 border-contorno bg-cancelar text-lg font-black text-contorno shadow-[inset_0_-3px_0_var(--pulo-cancelar-borda)] active:translate-y-[2px] ${className}`}
    >
      <span aria-hidden="true">✕</span>
    </button>
  );
}
