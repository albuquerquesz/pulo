export type AvatarProps = {
  nome: string;
  /** Endereço da foto; sem ela, a inicial do nome. */
  foto?: string | null | undefined;
  /** Tamanho e corpo da letra. */
  className?: string;
};

/** O círculo da pessoa (`.ava` e `.ava-g`). */
export function Avatar({ nome, foto, className = '' }: AvatarProps) {
  const base = `grid shrink-0 place-items-center overflow-hidden rounded-full bg-sapo font-extrabold text-ink-sobre-acao ${className}`;
  return (
    <span aria-hidden="true" className={base}>
      {foto ? <img src={foto} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : nome.trim().charAt(0).toUpperCase()}
    </span>
  );
}
