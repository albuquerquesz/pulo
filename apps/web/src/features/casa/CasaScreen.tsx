import { useCallback, useId, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { artigoDaParte, COMODOS } from '@pulo/core/domain/casa';

import { BarraValor, BotaoCanto, Foguinho, Joia, Nuvens, Placa, pontoNaCena, useCamera, type LimitesDaCamera, type Ponto } from '@/ui';

import { useApp, useCarregar } from '../app';
import type { VinculoDaCasa } from '../foco/vinculo';
import { COR_NATURAL, ITENS, type Escolha } from './catalogo';
import { guardarComodo, useComodoAtual } from './comodoAtual';
import { Comodo } from './Comodo';
import { colocadosNoQuarto, comprarOuColocar, estadoDaCompra, tirarDoLugar } from './decoracao';
import { ItensDoQuarto, LugaresDoQuarto } from './Decoracao';
import { carregarCasa, type OpcaoDeVinculo } from './logic';
import { BOTAO_DE_COMPRA, BOTAO_NEUTRO, LojaModal, RotuloDaCompra } from './LojaModal';
import type { Lugar } from './lugares';
import { SapoDaCasa } from './SapoDaCasa';
import { SeletorDeComodo } from './SeletorDeComodo';
import { TimerModal } from './TimerModal';
import { useFoco } from './useFoco';
import { useTelaCheia } from './useTelaCheia';

/** A câmera do quarto, com os números do rascunho. */
const CAMERA: LimitesDaCamera = { cx: 400, cy: 400, w: 1400, wEstreito: 760, min: 450, max: 2400, x0: -300, x1: 1100, y0: -200, y1: 900 };
/** De onde sai o +1 enquanto a cena ainda não foi medida. */
const SOBRE_O_SAPO: Ponto = { x: 400, y: 470 };
const DURACAO_DO_POP_MS = 1700;
export const DICA_DURANTE_O_FOCO = 'Disponível quando o foco acabar';

interface Pop extends Ponto {
  id: number;
  texto: string;
}

interface LojaAberta {
  /** `null`: aberta pelo botão de canto. */
  lugar: Lugar | null;
  escolha: Escolha;
  /** "Ver no quarto": o item aparece no lugar antes da compra. */
  vendo: boolean;
}

export type CasaScreenProps = {
  /** O bloco e o alvo que vieram pela URL. */
  vinculo?: VinculoDaCasa;
  /** O foco começou com o vínculo: a URL pode ser limpa. */
  onComecou?: () => void;
};

const primeiraEscolha = (lugar: Lugar | null): Escolha | null => {
  const item = ITENS.find((i) => !lugar || i.tipo === lugar.tipo);
  return item ? { item, cor: COR_NATURAL } : null;
};

/** A Casa: os cômodos do sapo, o foco e a decoração com loja. */
export function CasaScreen({ vinculo = {}, onComecou }: CasaScreenProps) {
  const { repo, clock, user, refresh } = useApp();
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
  const [aberta, setAberta] = useState<LojaAberta | null>(null);
  const comprando = useRef(false);

  const abrirLoja = (lugar: Lugar | null) => {
    const atual = dados && lugar ? colocadosNoQuarto(dados.quarto, comodoId).find((c) => c.lugar.id === lugar.id) : undefined;
    const escolha = atual?.escolha ?? primeiraEscolha(lugar);
    if (escolha) setAberta({ lugar, escolha, vendo: false });
  };

  /** Uma escrita de cada vez; se o servidor recusar, o aviso já foi mostrado e a loja continua aberta. */
  const gravar = async (acao: () => Promise<boolean>) => {
    if (comprando.current) return;
    comprando.current = true;
    try {
      if (await acao()) setAberta(null);
    } catch {
      // Nada a fazer além do aviso do repositório.
    } finally {
      comprando.current = false;
      refresh();
    }
  };
  const comprar = () => aberta && void gravar(() => comprarOuColocar(repo, clock, { lugar: aberta.lugar, escolha: aberta.escolha, comodo: comodoId }));
  const tirar = () => {
    const lugar = aberta?.lugar;
    if (lugar) void gravar(() => tirarDoLugar(repo, lugar, comodoId).then(() => true));
  };

  const apertarPlaca = () => {
    if (decorando) {
      setDecorando(false);
      setAberta(null);
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

  const colocados = dados ? colocadosNoQuarto(dados.quarto, comodoId) : [];
  const previa = aberta?.vendo && aberta.lugar ? { lugar: aberta.lugar, escolha: aberta.escolha } : null;
  const compraDaPrevia = previa && dados ? estadoDaCompra({ quarto: dados.quarto, saldo: dados.saldo, comodo: comodoId, ...previa }) : null;

  return (
    <main className="md:px-10 md:pt-8 md:pb-12">
      <h1 className="sr-only">Casa</h1>
      <div
        ref={cena}
        data-testid="cena-da-casa"
        className={`cena-casa relative h-[calc(100dvh-5rem)] min-h-[520px] overflow-hidden bg-ceu md:min-h-[620px] md:rounded-lg ${foco.focando ? 'focando' : ''} ${decorando ? 'decorando' : ''}`}
      >
        <Nuvens />
        <svg
          {...eventos}
          ref={ligarCena}
          viewBox={viewBox ?? '-20 90 840 620'}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label={`${comodo?.nome ?? 'Cômodo'} do Pulo`}
          className={`relative z-1 block size-full touch-none select-none ${arrastando ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <g transform="translate(400,490) scale(2) translate(-400,-490)">
            <Comodo comodo={comodoId} />
            <ItensDoQuarto colocados={colocados} previa={previa} />
            {decorando ? <LugaresDoQuarto colocados={colocados} onAbrir={abrirLoja} /> : null}
          </g>
          <SapoDaCasa ref={sapo} />
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
          <BarraValor
            icone={<Joia largura={46} altura={54} />}
            valor={dados ? dados.saldo + foco.estimativa : '…'}
            rotulo="joias"
            onMais={() => !foco.focando && !decorando && dados && setTimer(true)}
          />
          <BarraValor
            icone={<Foguinho className="size-[58px]" />}
            valor={dados?.diasSeguidos ?? '…'}
            rotulo="dias seguidos"
            rotuloMais="Ver sequência"
            onMais={() => void navegar({ to: '/' })}
          />
        </div>
        <div className="absolute top-[84px] right-3 z-3 md:top-6 md:right-6">
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
        {dados ? (
          <div className="pointer-events-none absolute inset-x-0 top-[146px] z-3 flex justify-center md:top-[92px] md:px-24">
            <SeletorDeComodo
              meus={dados.comodos}
              atual={comodoId}
              onEscolher={(escolhido) => {
                setAberta(null);
                guardarComodo(escolhido);
              }}
            />
          </div>
        ) : null}
        {decorando ? (
          <p className="absolute top-[214px] left-1/2 z-3 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-3xl bg-white/80 px-7 py-3 text-center text-sm font-black tracking-wider text-contorno uppercase md:top-[164px] md:text-base md:whitespace-nowrap">
            Toque num <b>+</b> para decorar {doPulo}
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

        <div className="absolute right-3 bottom-4 left-3 z-3 flex items-end justify-between gap-4 md:right-7 md:bottom-[26px] md:left-7">
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
            <BotaoCanto icone="🛍️" rotulo="Loja" {...bloqueio} onPress={() => dados && abrirLoja(null)} />
            <BotaoCanto icone="🚪" rotulo="Sair de casa" onPress={() => void navegar({ to: '/ilha' })} />
            <BotaoCanto icone="🖌️" rotulo="Decorar" {...bloqueio} onPress={() => setDecorando((d) => !d)} />
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
        {aberta && dados && comodo && !aberta.vendo ? (
          <LojaModal
            lugar={aberta.lugar}
            escolha={aberta.escolha}
            quarto={dados.quarto}
            saldo={dados.saldo}
            comodo={comodo}
            onEscolher={(escolha) => setAberta({ ...aberta, escolha })}
            onVer={() => setAberta({ ...aberta, vendo: true })}
            onComprar={comprar}
            onTirar={tirar}
            onCancelar={() => setAberta(null)}
          />
        ) : null}
        {aberta && compraDaPrevia ? (
          <div
            role="group"
            aria-label="Prévia no quarto"
            className="absolute bottom-[240px] left-1/2 z-10 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-[20px] border-4 border-contorno bg-folha py-3 pr-3.5 pl-[22px] font-black text-contorno md:bottom-[120px]"
          >
            <span>Gostou?</span>
            <button type="button" disabled={compraDaPrevia.bloqueado} onClick={comprar} className={`${BOTAO_DE_COMPRA} !py-2 text-sm`}>
              <RotuloDaCompra compra={compraDaPrevia} />
            </button>
            <button type="button" onClick={() => setAberta({ ...aberta, vendo: false })} className={`${BOTAO_NEUTRO} !py-2 text-sm`}>
              Voltar
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
