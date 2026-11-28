import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { SapoRosto } from '@/mascot';
import { Botao } from '@/ui';

import { useApp } from '../app';
import { MENSAGEM_PERFIL } from '../sessao/auth';
import { dadosParaConcluir, nomeCompleto, respostasIniciais, type RespostasDoOnboarding } from './logic';
import { PASSOS } from './passos';
import { Trilha } from './Trilha';

const SETA =
  'grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-[3px] border-contorno bg-surface text-xl font-black disabled:invisible';

export function OnboardingScreen() {
  const { concluirOnboarding, editarConta, pessoa, sair } = useApp();
  const navigate = useNavigate();
  const [respostas, setRespostas] = useState(() => respostasIniciais(pessoa?.nome));
  const [indice, setIndice] = useState(0);
  const [direcao, setDirecao] = useState<'avanca' | 'volta'>('avanca');
  const [comentario, setComentario] = useState<string | null>(null);
  const [pulos, setPulos] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // A ref barra o segundo envio antes mesmo de a tela redesenhar.
  const emAndamento = useRef(false);
  const balao = useRef<HTMLDivElement>(null);
  const indiceAnterior = useRef(indice);

  // A cada passo novo o foco vai para o balão, para o leitor de tela ler a pergunta.
  useEffect(() => {
    if (indiceAnterior.current === indice) return;
    indiceAnterior.current = indice;
    balao.current?.focus();
  }, [indice]);

  const passo = PASSOS[indice];
  const { Corpo } = passo;
  const fala = passo.fala(respostas);
  const pronto = passo.pronto(respostas);
  const primeiro = indice === 0;
  const ultimo = indice === PASSOS.length - 1;

  const irPara = (novo: number) => {
    setDirecao(novo > indice ? 'avanca' : 'volta');
    setIndice(novo);
    setComentario(null);
    setPulos(0);
    setErro(null);
  };

  const escrever = (mudanca: Partial<RespostasDoOnboarding>) => {
    setRespostas((atual) => ({ ...atual, ...mudanca }));
    setComentario(null);
  };

  const responder = (mudanca: Partial<RespostasDoOnboarding>) => {
    const novas = { ...respostas, ...mudanca };
    setRespostas(novas);
    setComentario(passo.comentario?.(novas) ?? null);
    setPulos((n) => n + 1);
  };

  const seguir = (evento: FormEvent) => {
    evento.preventDefault();
    if (!pronto) return;
    if (ultimo) {
      void entrar();
      return;
    }
    irPara(indice + 1);
  };

  const entrar = async () => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setSalvando(true);
    setErro(null);
    try {
      // O nome escrito aqui vira o nome da conta: é ele que o Hoje usa para dar bom dia.
      const nome = nomeCompleto(respostas);
      if (pessoa && nome !== pessoa.nome) {
        try {
          await editarConta({ nome, foto: pessoa.foto ?? null });
        } catch (falha) {
          // Sessão vencida: o app já volta ao login e a tela sai junto.
          setErro(falha instanceof Error ? falha.message : MENSAGEM_PERFIL);
          return;
        }
      }
      await concluirOnboarding(dadosParaConcluir());
      await navigate({ to: '/', replace: true });
    } catch {
      // O aviso de erro já foi mostrado pelo repositório; a pessoa pode tentar de novo.
    } finally {
      emAndamento.current = false;
      setSalvando(false);
    }
  };

  return (
    // No celular a altura é a da tela: só o corpo do passo rola e o Continuar fica à vista.
    <div className="onboarding relative flex h-dvh flex-col overflow-hidden md:h-auto md:min-h-dvh">
      <div aria-hidden="true" className="onboarding-nuvem" />
      <div aria-hidden="true" className="onboarding-nuvem onboarding-nuvem-baixa" />
      <svg aria-hidden="true" className="lagoa-margem absolute inset-x-0 bottom-0 h-[150px] w-full" viewBox="0 0 1200 150" preserveAspectRatio="none">
        <path d="M0 70 Q200 20 420 55 T860 40 T1200 50 V150 H0Z" />
        <path d="M0 105 Q260 70 560 95 T1200 88 V150 H0Z" />
      </svg>

          <header className="relative z-2 flex shrink-0 items-center gap-2.5 px-4.5 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3.5 text-[17px] font-black md:px-7 md:pt-4.5 md:pb-4.5 md:text-xl">
            <span aria-hidden="true" className="w-[38px]">
              <SapoRosto className="block w-full" />
            </span>
            Pulo
            {/* Quem entrou com a conta errada volta ao login sem precisar terminar o onboarding. */}
            <button
              type="button"
              onClick={() => void sair()}
              disabled={salvando}
              className="ml-auto min-h-11 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 rounded-full border-[3px] border-contorno bg-surface px-4 text-sm font-extrabold transition-transform active:translate-y-0.5"
            >
              Voltar ao login
            </button>
          </header>

          <main className="relative z-2 flex min-h-0 w-full flex-1 flex-col md:mx-auto md:mt-1.5 md:mb-15 md:h-[660px] md:max-w-[760px] md:flex-none md:rounded-[32px] md:border-4 md:border-contorno md:bg-bg md:shadow-[0_6px_0_rgba(59,42,47,0.06)]">
            <div className="flex items-center gap-3 px-4.5 pt-4.5 pb-1.5 md:px-5.5">
              <button type="button" aria-label="Voltar" disabled={primeiro || salvando} onClick={() => irPara(indice - 1)} className={SETA}>
                <span aria-hidden="true">‹</span>
              </button>
              <Trilha ids={PASSOS.map((p) => p.id)} atual={indice} />
              <button type="button" aria-label="Pular este passo" disabled={!passo.podePular || salvando} onClick={() => (ultimo ? void entrar() : irPara(indice + 1))} className={SETA}>
                <span aria-hidden="true">›</span>
              </button>
            </div>

            <form onSubmit={seguir} className="flex min-h-0 flex-1 flex-col">
              <div key={passo.id} data-direcao={direcao} className="onboarding-tela onboarding-rolagem flex min-h-0 flex-1 flex-col overflow-y-auto gap-3.5 px-4.5 pt-1.5 pb-4 md:px-7 md:pt-2">
                <div className="flex min-h-[140px] shrink-0 items-end gap-3">
                  <div key={pulos} data-pulando={pulos > 0} className="onboarding-sapo w-[108px] shrink-0 md:w-[140px]">
                    <SapoRosto momento="boas-vindas" className="block w-full" />
                  </div>
                  <div ref={balao} tabIndex={-1} aria-live="polite" className="onboarding-balao relative mb-8 min-w-0 rounded-[20px] border-[3px] border-contorno bg-surface px-3.5 py-3 md:px-4">
                    <h1 className="m-0 text-[17px] leading-snug font-extrabold md:text-[19px]">{comentario ?? fala.titulo}</h1>
                    {!comentario && fala.detalhe ? <p className="m-0 mt-1 text-sm text-muted">{fala.detalhe}</p> : null}
                  </div>
                </div>
                <Corpo respostas={respostas} responder={responder} escrever={escrever} />
              </div>

              {erro ? (
                <p role="alert" className="m-0 px-4.5 text-center text-sm font-extrabold">
                  {erro}
                </p>
              ) : null}

              <div className="flex shrink-0 justify-center px-4.5 pt-1.5 pb-[max(1.375rem,env(safe-area-inset-bottom))] md:px-7 md:pb-6">
                <Botao titulo={passo.botao ?? 'Continuar'} tipo="submit" variante="foco" desativado={!pronto} carregando={salvando} className="min-h-14 rounded-[18px] [&_span]:text-lg [&_span]:font-black" />
              </div>
            </form>
          </main>
    </div>
  );
}
