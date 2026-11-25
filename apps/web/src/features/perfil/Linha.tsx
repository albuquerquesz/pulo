import type { ReactNode } from 'react';

import { CARTAO, VALOR } from './estilos';
import type { Opcao } from './logic';

/** O cartão com as linhas de uma seção. Estica para as colunas terem a mesma altura. */
export function Linhas({ children }: { children: ReactNode }) {
  return <div className={`${CARTAO} flex-1 px-5 pt-2 pb-5`}>{children}</div>;
}

type LinhaProps = { titulo: string; detalhe?: string; perigo?: boolean; children: ReactNode };

/** Uma linha do cartão (`.linha`): o nome à esquerda e o controle à direita. */
export function Linha({ titulo, detalhe, perigo = false, children }: LinhaProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-line py-3 last:border-b-0 last:pb-0">
      <span className={`min-w-0 flex-1 ${perigo ? 'text-foco-borda' : ''}`}>
        {titulo}
        {detalhe ? <small className="block text-xs font-semibold text-muted">{detalhe}</small> : null}
      </span>
      {children}
    </div>
  );
}

type EscolhaProps = { rotulo: string; valor: string; opcoes: readonly Opcao[]; onEscolher: (valor: string) => void };

/** A pílula do valor, que abre as opções do navegador. */
export function Escolha({ rotulo, valor, opcoes, onEscolher }: EscolhaProps) {
  return (
    <select aria-label={rotulo} value={valor} onChange={(e) => onEscolher(e.target.value)} className={`${VALOR} appearance-none text-center`}>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor} className="bg-surface text-ink">
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}
