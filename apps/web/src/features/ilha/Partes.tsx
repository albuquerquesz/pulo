import { useState } from 'react';

import { CAMADAS_DA_CASA, type CamadaDaCasa, type ParteId } from '@pulo/core/domain/casa';
import { Joia } from '@/ui';

import type { IlhaNaTela, ParteAVenda, SituacaoDaParte } from './logic';

const NOME_DA_CAMADA: Record<CamadaDaCasa, string> = { comodo: 'Cômodos', estrutura: 'Estrutura', exterior: 'Exterior' };

const SOMBRA = 'shadow-[inset_0_-5px_0_var(--pulo-sombra-branca)]';
const APARENCIA: Record<SituacaoDaParte, string> = {
  disponivel: `cursor-pointer bg-folha hover:-translate-y-0.5 ${SOMBRA}`,
  cara: `bg-sombra-branca text-contorno/85 ${SOMBRA}`,
  trancada: `border-dashed bg-bege text-contorno/70 ${SOMBRA}`,
  feita: 'bg-pronta-fundo shadow-[inset_0_-5px_0_var(--pulo-pronta-borda)]',
};
const ALVO = 'cursor-pointer bg-lima-clara shadow-[inset_0_-5px_0_var(--pulo-lima)] hover:-translate-y-0.5';

function rotuloDa({ nome, custo, situacao, motivo, falta }: ParteAVenda, alvo: boolean): string {
  if (situacao === 'feita') return `${nome}, pronta`;
  if (motivo) return `${nome}, ${custo} joias, trancada: ${motivo}`;
  if (falta) return `${nome}, ${custo} joias. ${falta}`;
  return `${nome}, ${custo} joias${alvo ? ', próximo alvo' : ''}`;
}

/** `botao` é de onde as joias saem. */
type AoComprar = (id: ParteId, botao: Element) => void;

type CartaoProps = { parte: ParteAVenda; alvo: boolean; ocupado: boolean; onComprar: AoComprar };

/** A parte já construída vira um selo pequeno: emoji e visto. O nome fica no rótulo e na dica. */
function Selo({ parte }: Pick<CartaoProps, 'parte'>) {
  return (
    <span
      role="img"
      aria-label={rotuloDa(parte, false)}
      title={parte.nome}
      className="flex size-11 items-center justify-center rounded-full border-4 border-contorno bg-pronta-fundo text-xl shadow-[inset_0_-4px_0_var(--pulo-pronta-borda)]"
    >
      {parte.emoji}
    </span>
  );
}

function Cartao({ parte, alvo, ocupado, onComprar }: CartaoProps) {
  const { id, nome, emoji, custo, situacao, motivo, falta } = parte;
  return (
    <button
      type="button"
      disabled={ocupado || situacao !== 'disponivel'}
      onClick={(e) => onComprar(id, e.currentTarget)}
      aria-label={rotuloDa(parte, alvo)}
      className={`flex h-full min-h-[56px] disabled:cursor-default items-center gap-2.5 rounded-[18px] border-4 border-contorno py-1.5 pr-4 pl-3 text-left text-sm font-black whitespace-nowrap text-contorno ${alvo ? ALVO : APARENCIA[situacao]}`}
    >
      <span aria-hidden="true" className="text-2xl">
        {situacao === 'trancada' ? '🔒' : emoji}
      </span>
      <span className="flex flex-col">
        <span>{nome}</span>
        {motivo ? <span className="text-xs font-extrabold">{motivo}</span> : null}
        {falta ? <span className="text-xs font-extrabold">{falta}</span> : null}
        {alvo ? <span className="text-xs font-extrabold">Dá para construir!</span> : null}
      </span>
      <span className={`inline-flex items-center gap-1 ${situacao === 'cara' ? 'text-contorno' : 'text-joia-escura'}`}>
        <Joia largura={14} altura={16} />
        {custo}
      </span>
    </button>
  );
}

/** Ordem na grade: o próximo alvo, as que dá para comprar, as caras, as trancadas e, no fim, as prontas. */
const PESO: Record<SituacaoDaParte, number> = { disponivel: 0, cara: 1, trancada: 2, feita: 3 };

function emOrdem(partes: readonly ParteAVenda[], alvo: ParteId | null): ParteAVenda[] {
  return [...partes].sort((a, b) => Number(b.id === alvo) - Number(a.id === alvo) || PESO[a.situacao] - PESO[b.situacao] || a.custo - b.custo);
}

type PartesProps = { ilha: IlhaNaTela; /** Uma compra a caminho: nenhum cartão responde. */ ocupado: boolean; onComprar: AoComprar };

/** As partes à venda no pé da ilha, por camada: uma faixa no celular e uma grade com rolagem, abaixo do desenho, do md para cima. Só a que o saldo paga responde ao toque. */
export function Partes({ ilha, ocupado, onComprar }: PartesProps) {
  // Abre na camada do próximo alvo.
  const [escolhida, setEscolhida] = useState<CamadaDaCasa | null>(null);
  const doAlvo = ilha.partes.find((p) => p.id === ilha.alvo)?.camada;
  const camada = escolhida ?? doAlvo ?? 'comodo';
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div role="tablist" aria-label="Camadas da casa" className="flex flex-wrap gap-1.5">
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
      {/* No celular, uma linha só que rola de lado, para a ilha continuar à vista. A chave volta ao começo ao trocar de camada. */}
      <ul key={camada} aria-label="Partes da casa" className="flex items-center gap-2 py-1 max-md:-mx-3 max-md:faixa-lateral md:max-h-36 md:flex-wrap md:overflow-y-auto md:px-1">
        {emOrdem(
          ilha.partes.filter((p) => p.camada === camada),
          ilha.alvo,
        ).map((p) => (
          <li key={p.id} className="shrink-0">{p.situacao === 'feita' ? <Selo parte={p} /> : <Cartao parte={p} alvo={p.id === ilha.alvo} ocupado={ocupado} onComprar={onComprar} />}</li>
        ))}
      </ul>
    </div>
  );
}
