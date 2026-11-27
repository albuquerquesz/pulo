import { useCallback, useId, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { artigoDaParte, COMODOS } from '@pulo/core/domain/casa';

import { BarraValor, BotaoCanto, Foguinho, Joia, Nuvens, Placa, pontoNaCena, useCamera, type LimitesDaCamera, type Ponto } from '@/ui';

import { useApp, useCarregar } from '../app';
import type { VinculoDaCasa } from '../foco/vinculo';
import { escolhaInicial, type Escolha } from './catalogo';
import { guardarComodo, useComodoAtual } from './comodoAtual';
import { Comodo } from './Comodo';
import { colocadosNoQuarto, type Colocados } from './decoracao';
import { Mobilia } from './Decoracao';
import { carregarCasa, type OpcaoDeVinculo } from './logic';
import type { Movel } from './mobilia';
import { CAMA } from './mobilia/cama';
import { BOTAO_NEUTRO, PainelDaLoja } from './PainelDaLoja';
import { SeletorDeComodo } from './SeletorDeComodo';
import { TimerModal } from './TimerModal';
import { useCompraNoQuarto } from './useCompraNoQuarto';
import { useFoco } from './useFoco';
import { useTelaCheia } from './useTelaCheia';

/** A câmera do quarto, com os números do rascunho. */
const CAMERA: LimitesDaCamera = { cx: 400, cy: 400, w: 1400, wEstreito: 760, min: 450, max: 2400, x0: -300, x1: 1100, y0: -200, y1: 900 };
/** De onde sai o +1 enquanto a cena ainda não foi medida. */
const SOBRE_O_SAPO: Ponto = { x: 400, y: 520 };
/** Com a loja aberta, o cômodo inteiro fica à vista. */
const QUARTO_INTEIRO = '-220 -340 1240 1200';
const DURACAO_DO_POP_MS = 1700;
const SEM_MOVEIS: Colocados = new Map();
export const DICA_DURANTE_O_FOCO = 'Disponível quando o foco acabar';

interface Pop extends Ponto {
  id: number;
  texto: string;
}

export type CasaScreenProps = {
  /** O bloco e o alvo que vieram pela URL. */
  vinculo?: VinculoDaCasa;
  /** O foco começou com o vínculo: a URL pode ser limpa. */
  onComecou?: () => void;
};

/** A Casa: os cômodos do sapo, o foco e a decoração com loja. */
export function CasaScreen({ vinculo = {}, onComecou }: CasaScreenProps) {
  const { repo, clock, user } = useApp();
  const navegar = useNavigate();
  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    return carregarCasa(repo, clock, user, vinculo);
  });
  const dados = estado.tipo === 'ok' ? estado.dados : null;
  const comodoId = useComodoAtual(dados?.comodos ?? []);
  const comodo = COMODOS.find((c) => c.id === comodoId);
  const doPulo = comodo ? `${artigoDaParte(comodo.id)} ${comodo.nome.toLowerCase()} do Pulo` : 'a casa do Pulo';

  const cena = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const sapo = useRef<SVGGElement>(null);
  const telaCheia = useTelaCheia(cena);
  const { camera, viewBox, arrastando, props: gestos } = useCamera(CAMERA);
  const { ref: ligarCamera, ...eventos } = gestos;
  const ligarCena = useCallback(
    (el: SVGSVGElement | null) => {
      svg.current = el;
      const soltar = ligarCamera(el);
      return () => {
        svg.current = null;
        soltar?.();
      };
    },
    [ligarCamera],
  );

  const [pops, setPops] = useState<Pop[]>([]);
  const proximoPop = useRef(0);
  const soltarJoia = (joias: number) => {
    const caixa = svg.current?.getBoundingClientRect();
    const corpo = sapo.current?.getBoundingClientRect();
    const ponto =
      camera && caixa?.width && corpo
        ? pontoNaCena(camera, caixa, { x: corpo.left + corpo.width / 2, y: corpo.top + corpo.height / 2 })
        : SOBRE_O_SAPO;
    proximoPop.current += 1;
    const id = proximoPop.current;
    setPops((todos) => [...todos, { id, x: ponto.x, y: ponto.y - 10, texto: `+${joias}` }]);
    setTimeout(() => setPops((todos) => todos.filter((p) => p.id !== id)), DURACAO_DO_POP_MS);
  };
  const foco = useFoco(soltarJoia);
  const idDaDica = useId();
  const bloqueio = { desativado: foco.focando, dica: DICA_DURANTE_O_FOCO, descritoPor: foco.focando ? idDaDica : undefined };

  const [timer, setTimer] = useState(false);
  const [decorando, setDecorando] = useState(false);
  /** O que o painel da loja está mostrando; `null` com a loja fechada. */
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  /** A pessoa tocou num modelo ou numa cor: o quarto mostra a prévia. */
  const [vendo, setVendo] = useState(false);
  const efeitos = useRef<SVGGElement>(null);
  const barraDeJoias = useRef<HTMLDivElement>(null);
  const compra = useCompraNoQuarto({ cena, efeitos, sapo, saldo: barraDeJoias, comodo: comodoId, recarregar });
  const colocados = dados ? colocadosNoQuarto(dados.quarto, comodoId) : SEM_MOVEIS;

  const fecharLoja = () => {
    setEscolha(null);
    setVendo(false);
  };
  const abrirLugar = (lugar: Movel) => {
    if (!dados || compra.ocupado) return;
    setDecorando(true);
    setEscolha(colocados.get(lugar.id) ?? escolhaInicial(lugar));
    setVendo(false);
  };
  const escolher = (nova: Escolha) => {
    setEscolha(nova);
    setVendo(true);
  };

  const apertarPlaca = () => {
    if (decorando) {
      setDecorando(false);
      fecharLoja();
    } else if (foco.focando) void foco.parar();
    else if (dados) setTimer(true);
  };
  const comecar = async (minutos: number, opcao: OpcaoDeVinculo) => {
    setTimer(false);
    const blockId = dados?.bloco?.id;
    await foco.comecar(minutos, { ...opcao.extras, ...(blockId ? { blockId } : {}) });
    onComecou?.();
  };

  if (!user) return null;

  const lojaAberta = escolha !== null && dados !== null && comodo !== undefined;
  const previa = vendo && !compra.encenando ? escolha : null;
  const saldoNaBarra = dados ? (compra.saldoNaTela ?? dados.saldo) + foco.estimativa : '…';

  return (
    <main className="md:px-10 md:pt-8 md:pb-12">
      <h1 className="sr-only">Casa</h1>
      <div
        ref={cena}
        data-testid="cena-da-casa"
        className={`cena-casa relative flex h-[calc(100dvh-5rem)] min-h-[520px] flex-col overflow-hidden bg-ceu md:min-h-[620px] md:flex-row md:rounded-lg ${foco.focando ? 'focando' : ''}`}
      >
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <Nuvens />
        <svg
          {...eventos}
          ref={ligarCena}
          viewBox={lojaAberta ? QUARTO_INTEIRO : (viewBox ?? '-20 90 840 620')}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label={`${comodo?.nome ?? 'Cômodo'} do Pulo`}
          className={`relative z-1 block size-full touch-none select-none ${arrastando ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <g transform="translate(400,490) scale(2) translate(-400,-490)">
            <Comodo comodo={comodoId} />
            <Mobilia
              colocados={compra.naCena(colocados)}
              previa={previa}
              escolhido={escolha?.lugar.id ?? null}
              onAbrir={decorando ? abrirLugar : undefined}
              sapo={sapo}
            />
            <g ref={efeitos} pointerEvents="none" aria-hidden="true" />
          </g>
          <linearGradient id="g-joia-da-casa" x1="0" y1="0" x2="1" y2="1">
            <stop offset=".22" stopColor="var(--pulo-joia-clara)" />
            <stop offset=".23" stopColor="var(--pulo-joia)" />
            <stop offset=".55" stopColor="var(--pulo-joia)" />
            <stop offset=".56" stopColor="var(--pulo-joia-escura)" />
          </linearGradient>
          {pops.map((p) => (
            <g key={p.id} data-testid="ganho" transform={`translate(${p.x},${p.y})`} aria-hidden="true">
              <g className="ganho-pop">
                <polygon
                  points="-30,-22 -18,-29 -6,-22 -6,-8 -18,-1 -30,-8"
                  fill="url(#g-joia-da-casa)"
                  stroke="var(--pulo-contorno)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <text x="0" y="-6" fontSize="26" fontWeight="900" fill="#fff" stroke="var(--pulo-contorno)" strokeWidth="6" paintOrder="stroke">
                  {p.texto}
                </text>
              </g>
            </g>
          ))}
        </svg>

        <div className="absolute top-7 left-0 z-3 flex gap-[34px] pl-8 md:right-0 md:justify-center md:gap-9 md:pl-0">
          <div ref={barraDeJoias}>
            <BarraValor
              icone={<Joia largura={46} altura={54} />}
              valor={saldoNaBarra}
              rotulo="joias"
              onMais={() => !foco.focando && !decorando && dados && setTimer(true)}
            />
          </div>
          <BarraValor
            icone={<Foguinho className="size-[58px]" />}
            valor={dados?.diasSeguidos ?? '…'}
            rotulo="dias seguidos"
            rotuloMais="Ver sequência"
            onMais={() => void navegar({ to: '/' })}
          />
        </div>
        <div className={`absolute top-[84px] right-3 z-3 md:top-6 md:right-6 ${lojaAberta ? 'hidden' : ''}`}>
          <BotaoCanto
            pequeno
            rotulo={telaCheia.cheia ? 'Sair da tela cheia' : 'Tela cheia'}
            onPress={telaCheia.alternar}
            icone={
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--pulo-contorno)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="size-[26px]">
                <path d={telaCheia.cheia ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
              </svg>
            }
          />
        </div>
        {dados && !lojaAberta ? (
          <div className="pointer-events-none absolute inset-x-0 top-[146px] z-3 flex justify-center md:top-[92px] md:px-24">
            <SeletorDeComodo
              meus={dados.comodos}
              atual={comodoId}
              onEscolher={(escolhido) => {
                fecharLoja();
                guardarComodo(escolhido);
              }}
            />
          </div>
        ) : null}
        {decorando && !lojaAberta ? (
          <p className="absolute top-[214px] left-1/2 z-3 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-3xl bg-white/80 px-7 py-3 text-center text-sm font-black tracking-wider text-contorno uppercase md:top-[164px] md:text-base md:whitespace-nowrap">
            Toque num <b>móvel</b> para decorar {doPulo}
          </p>
        ) : null}
        {estado.tipo === 'erro' ? (
          <div role="alert" className="absolute top-[214px] left-1/2 z-3 flex -translate-x-1/2 flex-col items-center gap-2 rounded-3xl bg-white/90 px-7 py-3 text-center font-black text-contorno md:top-[164px]">
            Não consegui abrir o quarto.
            <button type="button" onClick={() => void recarregar()} className={BOTAO_NEUTRO}>
              Tentar de novo
            </button>
          </div>
        ) : null}

        <div className={`absolute right-3 bottom-4 left-3 z-3 items-end justify-between gap-4 md:right-7 md:bottom-[26px] md:left-7 ${lojaAberta ? 'hidden' : 'flex'}`}>
          <div className="hidden w-16 md:block" />
          <div className="flex flex-1 justify-center pb-2 md:flex-none">
            <Placa titulo={decorando ? 'Pronto' : foco.focando ? 'Parar' : 'Focar!'} tom={decorando ? 'clara' : foco.focando ? 'escura' : 'madeira'} onPress={apertarPlaca} />
          </div>
          <div className="flex flex-col items-center gap-3.5">
            {foco.focando ? (
              <p id={idDaDica} className="w-24 rounded-2xl bg-white/90 px-2 py-1.5 text-center text-xs font-black text-contorno">
                {DICA_DURANTE_O_FOCO}
              </p>
            ) : null}
            <BotaoCanto icone="🛍️" rotulo="Loja" {...bloqueio} onPress={() => abrirLugar(CAMA)} />
            <BotaoCanto icone="🚪" rotulo="Sair de casa" onPress={() => void navegar({ to: '/ilha' })} />
            <BotaoCanto icone="🖌️" rotulo="Decorar" {...bloqueio} onPress={() => (decorando ? apertarPlaca() : setDecorando(true))} />
          </div>
        </div>

        {timer && dados ? (
          <TimerModal
            minutosIniciais={dados.bloco?.durationMinutes ?? dados.minutosPreferidos}
            opcoes={dados.opcoes}
            onVoltar={() => setTimer(false)}
            onComecar={(minutos, opcao) => void comecar(minutos, opcao)}
          />
        ) : null}
        </div>
        {escolha && dados && comodo ? (
          <PainelDaLoja
            escolha={escolha}
            quarto={dados.quarto}
            saldo={dados.saldo}
            comodo={comodo}
            ocupado={compra.ocupado}
            onLugar={abrirLugar}
            onEscolher={escolher}
            onComprar={(botao) => void compra.comprar({ escolha, botao, quarto: dados.quarto, saldo: dados.saldo })}
            onTirar={() => {
              setVendo(false);
              void compra.tirar(escolha.lugar, dados.quarto);
            }}
            onFechar={fecharLoja}
          />
        ) : null}
      </div>
    </main>
  );
}
