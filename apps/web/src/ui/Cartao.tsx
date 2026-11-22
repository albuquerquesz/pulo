import type { ReactNode } from 'react';

export type CartaoProps = {
  children: ReactNode;
  selecionado?: boolean;
  /** Com onPress o cartão vira botão e afunda ao toque. */
  onPress?: () => void;
  rotulo?: string;
  className?: string;
  testID?: string;
};

const BASE = 'flex flex-col gap-2 rounded-md border-b-4 bg-surface p-4 text-left';

export function Cartao({ children, selecionado, onPress, rotulo, className = '', testID }: CartaoProps) {
  const borda = selecionado ? 'border-2 border-sapo-borda' : 'border border-line';
  if (!onPress) {
    return (
      <div data-testid={testID} aria-label={rotulo} className={`${BASE} ${borda} ${className}`}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      aria-label={rotulo}
      aria-pressed={!!selecionado}
      className={`${BASE} ${borda} min-h-11 w-full cursor-pointer transition-transform duration-75 active:translate-y-[3px] active:border-b ${className}`}
    >
      {children}
    </button>
  );
}
