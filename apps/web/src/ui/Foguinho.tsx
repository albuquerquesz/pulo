import { useId } from 'react';

export type FoguinhoProps = { className?: string };

/** A chama da sequência. O tamanho vem da classe (padrão: 1em, junto do texto). */
export function Foguinho({ className = 'size-[1em]' }: FoguinhoProps) {
  const gradiente = useId();
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
      <linearGradient id={gradiente} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#ff5a3c" />
        <stop offset=".6" stopColor="#ff8a3d" />
        <stop offset="1" stopColor="#ffc94d" />
      </linearGradient>
      <path
        d="M12 2c1 3.2-.6 5-2.2 6.8C8.3 10.5 7 12 7 14.6A5 5 0 0 0 12 20a5 5 0 0 0 5-5.2c0-2.3-1-3.6-1.9-4.8-.3 1.3-1 2.2-2 2.6.4-3.8-.4-7.6-1.1-10.6z"
        fill={`url(#${gradiente})`}
      />
      <path d="M12 13c.4 1.4-.2 2.1-.8 2.8-.5.5-.9 1-.9 1.8A1.8 1.8 0 0 0 12 18.4a1.9 1.9 0 0 0 1.9-2c0-1.5-.8-2.4-1.9-3.4z" fill="#ffe9a8" />
    </svg>
  );
}
