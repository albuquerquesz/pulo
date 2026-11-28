import { useRef, useState, type CSSProperties } from 'react';

import { FOCUS } from '@pulo/core/config/decisions';
import { BotaoFechar, Placa, useDialogo } from '@/ui';

import { ajustarMinutos, PASSO_DOS_MINUTOS, preenchimento, type OpcaoDeVinculo } from './logic';

const MOSTRADOR =
  'grid size-[104px] place-items-center rounded-full border-[5px] border-contorno bg-creme text-5xl font-black text-contorno tabular-nums shadow-[0_0_0_6px_var(--pulo-timer-ouro),0_0_0_10px_var(--pulo-contorno)] md:size-[132px] md:text-[62px]';
const BOTAO_REDONDO =
  'grid size-[46px] shrink-0 cursor-pointer place-items-center rounded-full border-4 border-contorno bg-lima-clara pb-[3px] text-[28px] leading-none font-black text-contorno shadow-[inset_0_-4px_0_var(--pulo-lima)]';

/** O quanto do controle fica preenchido vai numa variável CSS. */
type EstiloDoControle = CSSProperties & Record<'--p', string>;

function SapoDoTimer() {
  return (
    <svg viewBox="-70 -110 140 80" aria-hidden="true" className="relative -mb-[30px] h-[110px] w-[190px]">
      <g stroke="var(--pulo-contorno)" strokeWidth="5" fill="#8FDC5E">
        <path d="M-48-30C-50-70-26-92 0-92S50-70 48-30Z" />
        <circle cx="-21" cy="-86" r="17" />
        <circle cx="21" cy="-86" r="17" />
      </g>
      <circle cx="-20" cy="-86" r="7" fill="var(--pulo-contorno)" />
      <circle cx="22" cy="-86" r="7" fill="var(--pulo-contorno)" />
      <circle cx="-18" cy="-88" r="2.4" fill="#fff" />
      <circle cx="24" cy="-88" r="2.4" fill="#fff" />
      <ellipse cx="-30" cy="-58" rx="8" ry="4.5" fill="#FF9DB4" />
      <ellipse cx="30" cy="-58" rx="8" ry="4.5" fill="#FF9DB4" />
      <g fill="none" stroke="var(--pulo-contorno)" strokeLinecap="round">
        <path d="M-10-58q10 9 20 0" strokeWidth="4.5" />
        <path d="M-60-34q-4-14 10-12M60-34q4-14-10-12" strokeWidth="5" />
      </g>
    </svg>
  );
}

export type TimerModalProps = {
  minutosIniciais: number;
  /** A primeira vem marcada. */
  opcoes: readonly OpcaoDeVinculo[];
  onVoltar: () => void;
  onComecar: (minutos: number, opcao: OpcaoDeVinculo) => void;
};

/** A caixa verde do timer, sobre o quarto: minutos, para que é o foco, o X e Começar. */
export function TimerModal({ minutosIniciais, opcoes, onVoltar, onComecar }: TimerModalProps) {
  const [minutos, setMinutos] = useState(() => ajustarMinutos(minutosIniciais));
  const [chave, setChave] = useState(opcoes[0]?.chave);
  const caixa = useRef<HTMLDivElement>(null);
  useDialogo({ aberto: true, onFechar: onVoltar, caixa });
  const escolhida = opcoes.find((o) => o.chave === chave) ?? opcoes[0];
  const mudar = (valor: number) => setMinutos(ajustarMinutos(valor));
  const estilo: EstiloDoControle = { '--p': `${preenchimento(minutos)}%` };

  return (
    <div
      ref={caixa}
      role="dialog"
      aria-modal="true"
      aria-label="Timer de foco"
      tabIndex={-1}
      className="absolute inset-0 z-20 flex flex-col items-center overflow-y-auto bg-[rgba(59,42,47,0.55)] p-4 backdrop-blur-[3px]"
    >
      <div className="my-auto flex w-full flex-col items-center gap-[26px]">
        <div className="relative flex flex-col items-center">
          <SapoDoTimer />
          <BotaoFechar onFechar={onVoltar} className="top-0 -right-3 z-3" />
          <div className="relative z-1 flex flex-col items-center gap-3.5 rounded-[30px] border-[5px] border-contorno bg-timer-verde px-[18px] pt-7 pb-6 shadow-[inset_0_-10px_0_var(--pulo-timer-verde-borda)] md:px-[30px]">
            <div className="flex items-center gap-4" aria-live="polite" aria-label={`${minutos} minutos`}>
              <span data-testid="minutos" className={MOSTRADOR}>
                {String(minutos).padStart(2, '0')}
              </span>
              <span aria-hidden="true" className="flex flex-col gap-[22px]">
                <i className="size-4 rotate-45 rounded border-[3px] border-contorno bg-timer-ouro" />
                <i className="size-4 rotate-45 rounded border-[3px] border-contorno bg-timer-ouro" />
              </span>
              <span aria-hidden="true" className={MOSTRADOR}>
                00
              </span>
            </div>
            <span className="mt-2 rounded-xl border-4 border-contorno bg-creme px-[22px] py-1 text-[15px] font-black tracking-wider text-contorno uppercase">
              minutos
            </span>
            <div className="flex items-center gap-3.5">
              <button type="button" className={BOTAO_REDONDO} aria-label={`Menos ${PASSO_DOS_MINUTOS} minutos`} onClick={() => mudar(minutos - PASSO_DOS_MINUTOS)}>
                −
              </button>
              <input
                type="range"
                min={FOCUS.minMinutes}
                max={FOCUS.maxMinutes}
                step={PASSO_DOS_MINUTOS}
                value={minutos}
                aria-label="Minutos de foco"
                onChange={(e) => mudar(Number(e.target.value))}
                className="controle-do-timer w-[min(260px,45vw)]"
                style={estilo}
              />
              <button type="button" className={BOTAO_REDONDO} aria-label={`Mais ${PASSO_DOS_MINUTOS} minutos`} onClick={() => mudar(minutos + PASSO_DOS_MINUTOS)}>
                +
              </button>
            </div>
          </div>
          <div aria-hidden="true" className="-mt-1 flex w-[70%] justify-between">
            <i className="h-[22px] w-11 rounded-b-xl border-4 border-t-0 border-contorno bg-madeira-escura" />
            <i className="h-[22px] w-11 rounded-b-xl border-4 border-t-0 border-contorno bg-madeira-escura" />
          </div>
        </div>
        <div role="group" aria-label="Para" className="flex flex-wrap items-center justify-center gap-2.5 text-sm font-black tracking-wider text-white uppercase">
          <span>Para:</span>
          {opcoes.map((o) => (
            <button
              key={o.chave}
              type="button"
              aria-pressed={o.chave === escolhida?.chave}
              onClick={() => setChave(o.chave)}
              className="max-w-full cursor-pointer truncate rounded-full border-4 border-contorno bg-creme px-4 py-[7px] text-sm font-black text-contorno opacity-75 aria-pressed:bg-lima-clara aria-pressed:opacity-100 aria-pressed:shadow-[inset_0_-4px_0_var(--pulo-lima)]"
            >
              {o.icone ? <span aria-hidden="true">{o.icone} </span> : null}
              {o.titulo}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-[22px] pb-3">
          <Placa titulo="Começar" onPress={() => escolhida && onComecar(minutos, escolhida)} />
        </div>
      </div>
    </div>
  );
}
