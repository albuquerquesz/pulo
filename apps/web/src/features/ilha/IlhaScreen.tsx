import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';

import { isRemoteError, mensagemDeErro } from '@pulo/client';
import { verConquistas } from '@pulo/core/domain/achievements';
import { comprarParte, type ParteId } from '@pulo/core/domain/casa';
import { CasaDaIlha } from '@/mascot/ilha/CasaDaIlha';
import { BarraValor, BotaoCanto, Joia, Nuvens, useCamera, type LimitesDaCamera } from '@/ui';
import { centroNaTela, type PontoNaTela } from '@/ui/compra';

import { confirmar, useApp, useCarregar } from '../app';
import { carregarIlha, conquistasNovas, ilhaNaTela, textoDaConquista, textoDoPortal } from './logic';
import { Partes } from './Partes';
import { useChegadaDaParte } from './useChegadaDaParte';

/** A câmera da ilha: abre mostrando a mansão toda. */
const CAMERA: LimitesDaCamera = { cx: 500, cy: 470, w: 1450, wEstreito: 1050, hMinima: 1100, min: 350, max: 2400, x0: -150, x1: 1150, y0: 0, y1: 900 };

const AVISO = 'absolute top-[150px] left-1/2 z-3 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-3xl bg-white/90 px-7 py-3 text-center font-black text-contorno';

/** A Ilha: a casa do sapo por partes, compradas com joias. */
export function IlhaScreen() {
  const { repo, clock, user, refresh, emitirEvento, mostrarAviso } = useApp();
  const navegar = useNavigate();
  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    return carregarIlha(repo, clock);
  });
  const { viewBox, arrastando, props: gestos } = useCamera(CAMERA);
  const [comprando, setComprando] = useState<ParteId | null>(null);
  const [nova, setNova] = useState<ParteId | null>(null);
  const ocupado = useRef(false);
  const cena = useRef<HTMLDivElement>(null);
  const efeitos = useRef<SVGGElement>(null);
  const barraDeJoias = useRef<HTMLDivElement>(null);
  const chegada = useChegadaDaParte({ cena, efeitos, saldo: barraDeJoias });

  const dados = estado.tipo === 'ok' ? estado.dados : null;
  const ilha = dados ? ilhaNaTela(dados.casa, comprando) : null;
  const irParaCasa = () => void navegar({ to: '/casa' });

  /**
   * Uma compra de cada vez. As joias voam até a parte, ela cai e volta a ficar apagada se o servidor recusar.
   * Com menos movimento, a parte aparece na hora.
   */
  const comprar = async (parte: ParteId, origem: PontoNaTela) => {
    if (ocupado.current || !dados || !ilha) return;
    const preco = ilha.partes.find((p) => p.id === parte)?.custo ?? 0;
    ocupado.current = true;
    setNova(parte);
    let recusada = false;
    const animacao = chegada.animar({
      parte,
      origem,
      preco,
      saldo: ilha.saldo,
      // Síncrono: a animação precisa da parte já desenhada como pronta.
      mostrar: () => flushSync(() => setComprando(parte)),
      recusada: () => recusada,
    });
    const desfazer = () => {
      recusada = true;
      chegada.soltar();
      setComprando(null);
      setNova(null);
    };
    try {
      const compra = await comprarParte(repo, clock, parte);
      if (!compra.ok) {
        mostrarAviso({ mensagem: compra.error.message, variante: 'atencao' });
        desfazer();
        return;
      }
      emitirEvento('construindo');
      // A última parte fecha a casa: é festa, com ou sem conquista nova.
      if (dados.casa.construidas + 1 === dados.casa.total) emitirEvento('comemorando');
      const [conquista] = conquistasNovas(dados.conquistas, await verConquistas(repo, clock));
      if (conquista) {
        emitirEvento('comemorando');
        mostrarAviso({ mensagem: textoDaConquista(conquista), variante: 'sucesso' });
      }
    } catch (erro) {
      // Os outros erros o repositório já avisou (e a sessão vencida volta ao login).
      if (isRemoteError(erro) && erro.code === 'joias_insuficientes') mostrarAviso({ mensagem: mensagemDeErro(erro), variante: 'atencao' });
      desfazer();
    } finally {
      await animacao;
      chegada.soltar();
      ocupado.current = false;
      refresh();
    }
  };

  /** Gastar joias pede um sim antes. */
  const pedirCompra = (id: ParteId, botao: Element) => {
    const parte = ilha?.partes.find((p) => p.id === id);
    if (!parte) return;
    // Medido já: o cartão pode mudar de lugar enquanto a pergunta está aberta.
    const origem = centroNaTela(botao);
    void confirmar(`Construir ${parte.nome}?`, `Custa ${parte.custo} joias.`).then((ok) => {
      if (ok) void comprar(id, origem);
    });
  };

  if (!user) return null;

  return (
    <main className="md:px-10 md:pt-8 md:pb-12">
      <h1 className="sr-only">Ilha</h1>
      <div ref={cena} data-testid="cena-da-ilha" className="cena-ilha relative h-[calc(100dvh-5rem)] min-h-[520px] overflow-hidden bg-ceu md:flex md:min-h-[620px] md:flex-col md:rounded-lg">
        <Nuvens />
        <CasaDaIlha
          {...gestos}
          construidas={ilha?.construidas ?? []}
          nova={nova}
          efeitos={efeitos}
          onPortal={ilha ? () => mostrarAviso({ mensagem: textoDoPortal(ilha.construidas.length, ilha.total), variante: 'atencao' }) : undefined}
          viewBox={viewBox}
          className={`relative z-1 block size-full touch-none select-none md:min-h-0 md:flex-1 ${arrastando ? 'cursor-grabbing' : 'cursor-grab'}`}
        />

        <div className="absolute inset-x-0 top-7 z-3 flex justify-center pl-5">
          <div ref={barraDeJoias}>
            <BarraValor icone={<Joia largura={46} altura={54} />} valor={chegada.saldoNaTela ?? ilha?.saldo ?? '…'} rotulo="joias" onMais={irParaCasa} />
          </div>
        </div>
        {ilha ? (
          <p className="absolute top-24 left-1/2 z-3 -translate-x-1/2 rounded-3xl bg-white/75 px-[26px] py-2.5 text-base font-extrabold whitespace-nowrap text-contorno">
            <b>
              {ilha.construidas.length} de {ilha.total}
            </b>{' '}
            partes da casa
          </p>
        ) : null}
        {estado.tipo === 'erro' ? (
          <div role="alert" className={`${AVISO} flex flex-col items-center gap-2`}>
            Não consegui abrir a ilha.
            <button type="button" onClick={() => void recarregar()} className="cursor-pointer underline">
              Tentar de novo
            </button>
          </div>
        ) : null}

        <div className="absolute right-3 bottom-4 left-3 z-3 flex flex-col items-end gap-3 md:relative md:right-0 md:bottom-0 md:left-0 md:flex-row md:gap-4 md:px-6 md:pb-6">
          <div className="w-full min-w-0 md:w-auto md:flex-1">{ilha ? <Partes ilha={ilha} onComprar={pedirCompra} /> : null}</div>
          <BotaoCanto icone="🏠" rotulo="Entrar em casa" onPress={irParaCasa} />
        </div>
      </div>
    </main>
  );
}
