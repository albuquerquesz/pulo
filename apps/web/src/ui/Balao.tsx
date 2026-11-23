import { Texto } from './Texto';

export type BalaoProps = {
  texto: string;
  /** 1 ou 2 linhas (o resto vira reticências). Padrão 2. */
  linhas?: 1 | 2;
  /** Posição do rabinho. Padrão: embaixo à esquerda (aponta para o sapo). */
  rabo?: 'baixo' | 'cima' | 'nenhum';
  className?: string;
  testID?: string;
};

/** Balão de fala do sapo. */
export function Balao({ texto, linhas = 2, rabo = 'baixo', className = '', testID }: BalaoProps) {
  return (
    <div className={`flex max-w-80 flex-col self-start ${className}`} data-testid={testID} role="note" aria-label={`Sapo diz: ${texto}`}>
      {rabo === 'cima' ? <Rabo cima /> : null}
      <div className="flex min-h-11 items-center rounded-md border-[1.5px] border-line bg-surface px-3.5 py-2.5">
        <Texto linhas={linhas}>{texto}</Texto>
      </div>
      {rabo === 'baixo' ? <Rabo /> : null}
    </div>
  );
}

function Rabo({ cima }: { cima?: boolean }) {
  return (
    <svg width={22} height={12} viewBox="0 0 22 12" aria-hidden className={`ml-[22px] ${cima ? '-mb-0.5 -scale-y-100' : '-mt-0.5'}`}>
      <path d="M0 0 L11 12 L22 0 Z" className="fill-surface" />
      <path d="M0 0 L11 12 L22 0" className="stroke-line" strokeWidth={1.5} fill="none" />
    </svg>
  );
}
