import { useState } from 'react';

import { CAMADAS_DA_CASA, type CamadaDaCasa, type ParteId } from '@pulo/core/domain/casa';
import { Joia } from '@/ui';

import type { IlhaNaTela, ParteAVenda, SituacaoDaParte } from './logic';

const NOME_DA_CAMADA: Record<CamadaDaCasa, string> = { comodo: 'Cômodos', estrutura: 'Estrutura', exterior: 'Exterior' };

const SOMBRA = 'shadow-[inset_0_-5px_0_var(--pulo-sombra-branca)]';
const APARENCIA: Record<SituacaoDaParte, string> = {
  disponivel: `cursor-pointer bg-folha hover:-translate-y-0.5 ${SOMBRA}`,
  cara: `bg-sombra-branca text-contorno/60 ${SOMBRA}`,
  trancada: `border-dashed bg-bege text-contorno/70 ${SOMBRA}`,
  feita: 'bg-pronta-fundo shadow-[inset_0_-5px_0_var(--pulo-pronta-borda)]',
};
const ALVO = 'cursor-pointer bg-lima-clara shadow-[inset_0_-5px_0_var(--pulo-lima)] hover:-translate-y-0.5';

function rotuloDa({ nome, custo, situacao, motivo }: ParteAVenda, alvo: boolean): string {
  if (situacao === 'feita') return `${nome}, pronta`;
  if (motivo) return `${nome}, ${custo} joias, trancada: ${motivo}`;
  return `${nome}, ${custo} joias${alvo ? ', próximo alvo' : ''}`;
}

function Cartao({ parte, alvo, onComprar }: { parte: ParteAVenda; alvo: boolean; onComprar: (id: ParteId) => void }) {
  const { id, nome, emoji, custo, situacao, motivo } = parte;
  return (
    <button
      type="button"
      disabled={situacao !== 'disponivel'}
      onClick={() => onComprar(id)}
      aria-label={rotuloDa(parte, alvo)}
      className={`flex h-full min-h-[60px] items-center gap-2.5 rounded-[18px] border-4 border-contorno py-1.5 pr-4 pl-3 text-left text-sm font-black whitespace-nowrap text-contorno ${alvo ? ALVO : APARENCIA[situacao]}`}
    >
      <span aria-hidden="true" className="text-2xl">
        {situacao === 'trancada' ? '🔒' : emoji}
      </span>
      <span className="flex flex-col">
        <span>{nome}</span>
        {motivo ? <span className="text-xs font-extrabold">{motivo}</span> : null}
        {alvo ? <span className="text-xs font-extrabold text-pronta-texto">Dá para construir!</span> : null}
      </span>
      {situacao === 'feita' ? (
        <span className="text-pronta-texto">✓</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-joia-escura">
          <Joia largura={14} altura={16} />
          {custo}
        </span>
      )}
    </button>
  );
}

type PartesProps = { ilha: IlhaNaTela; onComprar: (id: ParteId) => void };

/** As partes à venda no pé da ilha, por camada, numa faixa que rola de lado. Só a que o saldo paga responde ao toque. */
export function Partes({ ilha, onComprar }: PartesProps) {
  // Abre na camada do próximo alvo.
  const [escolhida, setEscolhida] = useState<CamadaDaCasa | null>(null);
  const doAlvo = ilha.partes.find((p) => p.id === ilha.alvo)?.camada;
  const camada = escolhida ?? doAlvo ?? 'comodo';
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div role="tablist" aria-label="Camadas da casa" className="flex gap-1.5">
        {CAMADAS_DA_CASA.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === camada}
            onClick={() => setEscolhida(c)}
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-2xl border-4 border-contorno bg-bege px-2.5 text-xs font-black text-contorno shadow-[inset_0_-4px_0_var(--pulo-bege-borda)] aria-selected:bg-lima-forte aria-selected:shadow-[inset_0_-4px_0_var(--pulo-lima)] md:px-4 md:text-sm"
          >
            {NOME_DA_CAMADA[c]}
            <span className="rounded-full bg-folha px-1.5">
              {ilha.progresso[c].feitas}/{ilha.progresso[c].total}
            </span>
          </button>
        ))}
      </div>
      {/* A chave volta a rolagem ao começo quando a camada muda. */}
      <ul key={camada} aria-label="Partes da casa" className="flex gap-2 overflow-x-auto overscroll-x-contain p-1">
        {ilha.partes
          .filter((p) => p.camada === camada)
          .map((p) => (
            <li key={p.id} className="shrink-0">
              <Cartao parte={p} alvo={p.id === ilha.alvo} onComprar={onComprar} />
            </li>
          ))}
      </ul>
    </div>
  );
}
