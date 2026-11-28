import { Link } from '@tanstack/react-router';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { CARTAO, TITULO } from './estilos';
import { horaCheia, posicaoDoAgora, type BlocoNaLinha, type EstadoDoBloco, type ItemDaLinha, type MarcoDaLinha } from './logic';
import { Vazio } from './Vazio';

/** Medidas do cartão: no celular as colunas encolhem; a partir de md valem as do rascunho. */
const MEDIDAS = '[--dl-pad:14px] [--dl-hora:44px] [--dl-vao:10px] md:[--dl-pad:24px] md:[--dl-hora:52px] md:[--dl-vao:18px]';
const GRADE = 'relative grid grid-cols-[var(--dl-hora)_44px_minmax(0,1fr)_auto] items-center gap-x-[var(--dl-vao)]';
/** A linha passa pelo centro dos círculos (22 px de raio, 4 px de largura). */
const TRILHO = 'absolute left-[calc(var(--dl-pad)+var(--dl-hora)+var(--dl-vao)+20px)] z-1 w-1 rounded-sm';
/** A hora some quando o ponto de agora passa em cima dela. */
const PERTO_DO_PONTO = 16;

const CIRCULO: Record<EstadoDoBloco, string> = {
  feito: 'border-sapo bg-[color-mix(in_srgb,var(--pulo-sapo)_22%,var(--pulo-surface))]',
  agora:
    'border-foco bg-[color-mix(in_srgb,var(--pulo-foco)_22%,var(--pulo-surface))] shadow-[0_0_0_5px_color-mix(in_srgb,var(--pulo-foco)_18%,transparent)]',
  pendente: 'border-line bg-surface',
};

type BlocoProps = { bloco: BlocoNaLinha; semHora: boolean; registrar: (circulo: HTMLElement | null) => void };

function Bloco({ bloco, semHora, registrar }: BlocoProps) {
  const feito = bloco.estado === 'feito';
  return (
    <li data-estado={bloco.estado} className={`${GRADE} min-h-[68px]`}>
      <span aria-hidden="true" className={`text-[13px] font-extrabold text-muted ${semHora ? 'invisible' : ''}`}>
        {horaCheia(bloco.inicio)}
      </span>
      <span ref={registrar} aria-hidden="true" className={`relative z-2 grid size-11 place-items-center rounded-full border-[2.5px] text-xl ${CIRCULO[bloco.estado]}`}>
        {bloco.icone}
      </span>
      <div className={`flex min-w-0 flex-col gap-0.5 ${bloco.focar ? 'max-sm:col-span-2' : ''}`}>
        <span className="text-[13px] text-muted">{bloco.faixa}</span>
        <b className={`min-w-0 text-base break-words ${feito ? 'text-muted line-through' : ''}`}>{bloco.titulo}</b>
      </div>
      {bloco.focar ? (
        <Link
          to="/casa"
          search={bloco.focar}
          aria-label={`Focar em ${bloco.titulo}`}
          className="flex min-h-11 items-center rounded-full max-sm:col-start-3 max-sm:row-start-2 max-sm:mb-2 max-sm:justify-self-start bg-foco px-4 py-2 font-black text-ink-sobre-acao shadow-[inset_0_-3px_0_var(--pulo-foco-borda)] md:min-h-0"
        >
          ▶ Focar
        </Link>
      ) : (
        <span
          role="img"
          aria-label={feito ? 'Feito' : 'Por fazer'}
          className={`grid size-7 place-items-center rounded-full border-[2.5px] text-sm font-black ${feito ? 'border-sapo-borda bg-sapo text-ink-sobre-acao' : 'border-line'}`}
        >
          {feito ? '✓' : null}
        </span>
      )}
    </li>
  );
}

interface Medidas {
  /** Centro de cada círculo, na ordem dos blocos. */
  centros: number[];
}

type LinhaDoDiaProps = { itens: ItemDaLinha[]; minutos: number };

/** Sem bloco hoje: o mesmo vazio das outras listas, com a ação que fizer sentido. */
export function LinhaDoDiaVazia({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section aria-label="Linha do dia" className="flex flex-col gap-3">
      <h2 className={TITULO}>Linha do dia</h2>
      <div className={`${CARTAO} px-5`}>
        <Vazio icone="🗓️" titulo={titulo} texto={texto}>
          {children}
        </Vazio>
      </div>
    </section>
  );
}

/** Os blocos de hoje ligados por uma linha: verde até agora, cinza depois, com o ponto laranja da hora. */
export function LinhaDoDia({ itens, minutos }: LinhaDoDiaProps) {
  const cartao = useRef<HTMLDivElement>(null);
  const circulos = useRef(new Map<string, HTMLElement>());
  const [{ centros }, setMedidas] = useState<Medidas>({ centros: [] });
  const blocos = itens.filter((item) => item.tipo === 'bloco');

  useLayoutEffect(() => {
    const elemento = cartao.current;
    if (!elemento) return;
    const medir = () => {
      const topo = elemento.getBoundingClientRect().top + elemento.clientTop;
      const novos = itens.flatMap((item) => {
        const circulo = circulos.current.get(item.id);
        if (!circulo) return [];
        const caixa = circulo.getBoundingClientRect();
        return [caixa.top + caixa.height / 2 - topo];
      });
      setMedidas({ centros: novos });
    };
    medir();
    // O texto pode quebrar em outra largura: mede de novo quando o cartão muda de tamanho.
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [itens]);

  const marcos: MarcoDaLinha[] = blocos.flatMap((b, i) => {
    const centro = centros[i];
    return centro === undefined ? [] : [{ inicio: b.inicio, fim: b.fim, centro }];
  });
  const inicio = marcos[0]?.centro ?? 0;
  const fim = marcos.at(-1)?.centro ?? 0;
  const agora = posicaoDoAgora(marcos, minutos);

  return (
    <section aria-label="Linha do dia" className="flex flex-col gap-3">
      <h2 className={TITULO}>Linha do dia</h2>
      <div ref={cartao} className={`${CARTAO} ${MEDIDAS} relative px-[var(--dl-pad)] py-3.5`}>
        {agora === null ? null : (
          <>
            <span aria-hidden="true" className={`${TRILHO} bg-line`} style={{ top: inicio, height: fim - inicio }} />
            <span aria-hidden="true" className={`${TRILHO} bg-sapo`} style={{ top: inicio, height: Math.max(0, agora - inicio) }} />
            <span
              data-testid="ponto-de-agora"
              className="absolute left-[calc(var(--dl-pad)+var(--dl-hora)+var(--dl-vao)+15px)] z-3 size-3.5 rounded-full border-[3px] border-surface bg-foco"
              style={{ top: agora - 7 }}
            >
              <b className="absolute top-1/2 right-[calc(100%+var(--dl-vao)+12px)] -translate-y-1/2 rounded-[6px] bg-foco px-1.5 py-px text-[11px] font-black whitespace-nowrap text-ink-sobre-acao">
                {horaCheia(minutos)}
              </b>
            </span>
          </>
        )}
        <ol className="flex flex-col">
          {itens.map((item) =>
            item.tipo === 'livre' ? (
              <li key={item.id} className={`${GRADE} min-h-10`}>
                <em className="col-start-3 text-[13px] text-muted not-italic">{item.texto}</em>
              </li>
            ) : (
              <Bloco
                key={item.id}
                bloco={item}
                semHora={item.estado === 'agora' || (agora !== null && Math.abs((centros[blocos.indexOf(item)] ?? Infinity) - agora) < PERTO_DO_PONTO)}
                registrar={(circulo) => {
                  if (circulo) circulos.current.set(item.id, circulo);
                  else circulos.current.delete(item.id);
                }}
              />
            ),
          )}
        </ol>
      </div>
    </section>
  );
}
