import type { ReactNode } from 'react';

import { Campo } from './Campo';
import {
  alternar,
  IDADE_INICIAL,
  IDADE_MAXIMA,
  IDADE_MINIMA,
  MOMENTOS,
  HABITOS_SUGERIDOS,
  MAXIMO_DE_HABITOS,
  TRAVAS,
  type RespostasDoOnboarding,
} from './logic';
import { Opcao } from './Opcao';

export type CorpoProps = {
  respostas: RespostasDoOnboarding;
  /** Resposta de um clique: o sapo comenta e dá um pulinho. */
  responder: (mudanca: Partial<RespostasDoOnboarding>) => void;
  /** Texto digitado: guarda sem o sapo reagir a cada letra. */
  escrever: (mudanca: Partial<RespostasDoOnboarding>) => void;
};

type GrupoProps = { titulo: string; className: string; children: ReactNode };

const UMA_COLUNA = 'grid gap-2.5';

/** Um conjunto de opções com o nome da pergunta, para quem usa leitor de tela. */
function Grupo({ titulo, className, children }: GrupoProps) {
  return (
    <div role="group" aria-label={titulo} className={className}>
      {children}
    </div>
  );
}

type TextosDaOpcaoProps = { icone: string; titulo: string; detalhe: string };

function TextosDaOpcao({ icone, titulo, detalhe }: TextosDaOpcaoProps) {
  return (
    <>
      <span aria-hidden="true" className="w-8 shrink-0 text-center text-2xl">
        {icone}
      </span>
      <span className="min-w-0">
        {titulo}
        <small className="block text-[13px] font-semibold text-muted">{detalhe}</small>
      </span>
    </>
  );
}

export function CorpoDoNome({ respostas, escrever }: CorpoProps) {
  return (
    <div className="mt-4 grid gap-9">
      <Campo rotulo="Seu nome" valor={respostas.nome} maximo={30} autoComplete="given-name" onMudar={(nome) => escrever({ nome })} />
      <Campo rotulo="Sobrenome" valor={respostas.sobrenome} maximo={40} autoComplete="family-name" onMudar={(sobrenome) => escrever({ sobrenome })} />
    </div>
  );
}

export function CorpoDoMomento({ respostas, responder }: CorpoProps) {
  return (
    <>
      <Grupo titulo="Seu momento" className="grid gap-2.5">
        {MOMENTOS.map((m) => (
          <Opcao key={m.id} formato="linha" marcada={respostas.momento === m.id} onEscolher={() => responder({ momento: m.id })}>
            <span aria-hidden="true" className="w-8 shrink-0 text-center text-xl">
              {m.icone}
            </span>
            {m.titulo}
          </Opcao>
        ))}
      </Grupo>
    </>
  );
}

const BOTAO_DE_IDADE =
  'grid size-12 shrink-0 cursor-pointer place-items-center rounded-full border-[3px] border-contorno bg-surface text-2xl font-black shadow-[inset_0_-4px_0_var(--pulo-sombra-branca)] enabled:active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40';

const TECLAS_DA_FAIXA = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' '];

/** A idade numa vitória-régia: arrasta a folhinha ou ajusta de um em um. */
export function CorpoDaIdade({ respostas, escrever }: CorpoProps) {
  const idade = respostas.idade ?? IDADE_INICIAL;
  const mudar = (nova: number) => escrever({ idade: Math.min(IDADE_MAXIMA, Math.max(IDADE_MINIMA, nova)) });
  // Quem tem exatamente a idade em que a folhinha começa não precisa movê-la: tocar nela já responde.
  const confirmar = (faixa: HTMLInputElement) => mudar(Number(faixa.value));
  const preenchido = ((idade - IDADE_MINIMA) / (IDADE_MAXIMA - IDADE_MINIMA)) * 100;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 py-2">
      <div className="flex items-center gap-5">
        <button type="button" aria-label="Um ano a menos" disabled={idade <= IDADE_MINIMA} onClick={() => mudar(idade - 1)} className={BOTAO_DE_IDADE}>
          <span aria-hidden="true">−</span>
        </button>
        <div aria-hidden="true" className="relative grid h-32 w-44 place-items-center rounded-[50%] border-4 border-contorno bg-[#79c94a] shadow-[inset_0_-8px_0_#5fae36]">
          <span key={respostas.idade ?? 'vazia'} className="onboarding-idade text-center leading-none">
            <b className="block text-5xl font-black">{respostas.idade ?? '?'}</b>
            <small className="text-sm font-extrabold">anos</small>
          </span>
        </div>
        <button type="button" aria-label="Um ano a mais" disabled={idade >= IDADE_MAXIMA} onClick={() => mudar(idade + 1)} className={BOTAO_DE_IDADE}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <input
        type="range"
        aria-label="Sua idade"
        min={IDADE_MINIMA}
        max={IDADE_MAXIMA}
        value={idade}
        aria-valuetext={respostas.idade === null ? 'não escolhida' : `${respostas.idade} anos`}
        onChange={(e) => confirmar(e.currentTarget)}
        onPointerUp={(e) => confirmar(e.currentTarget)}
        onClick={(e) => confirmar(e.currentTarget)}
        onKeyUp={(e) => {
          // O Tab que só traz o foco para cá não é uma resposta.
          if (TECLAS_DA_FAIXA.includes(e.key)) confirmar(e.currentTarget);
        }}
        className="onboarding-faixa w-full max-w-[460px]"
        style={{ background: `linear-gradient(to right, #79c94a ${preenchido}%, var(--pulo-bege-borda) ${preenchido}%)` }}
      />
    </div>
  );
}

export function CorpoDasTravas({ respostas, responder }: CorpoProps) {
  return (
    <Grupo titulo="O que mais te atrapalha" className={UMA_COLUNA}>
      {TRAVAS.map((t) => {
        const marcada = respostas.travas.includes(t.id);
        return (
          <Opcao key={t.id} formato="linha" marcada={marcada} onEscolher={() => responder({ travas: alternar(respostas.travas, t.id) })}>
            <TextosDaOpcao icone={t.icone} titulo={t.titulo} detalhe={t.detalhe} />
            <span aria-hidden="true" className={`onboarding-marca ml-auto grid size-6 shrink-0 place-items-center rounded-lg border-[3px] border-contorno text-xs ${marcada ? 'bg-[#79c94a]' : 'bg-surface'}`}>
              {marcada ? '✓' : ''}
            </span>
          </Opcao>
        );
      })}
    </Grupo>
  );
}

export function CorpoDosHabitos({ respostas, responder }: CorpoProps) {
  const cheio = respostas.habitos.length >= MAXIMO_DE_HABITOS;
  return (
    // Só a lista rola: o sapo, a trilha e o Continuar ficam parados.
    <Grupo titulo="Hábitos para começar" className="onboarding-rolagem -mx-1.5 grid max-h-[44dvh] gap-2.5 overflow-y-auto py-1 pl-1.5 md:max-h-[320px]">
      {HABITOS_SUGERIDOS.map((h) => {
        const marcada = respostas.habitos.includes(h.titulo);
        return (
          <Opcao key={h.titulo} formato="linha" marcada={marcada} desativada={cheio && !marcada} onEscolher={() => responder({ habitos: alternar(respostas.habitos, h.titulo, MAXIMO_DE_HABITOS) })}>
            <span aria-hidden="true" className="w-8 shrink-0 text-center text-2xl">
              {h.icone}
            </span>
            {h.titulo}
            <span aria-hidden="true" className={`onboarding-marca ml-auto grid size-6 shrink-0 place-items-center rounded-lg border-[3px] border-contorno text-xs ${marcada ? 'bg-[#79c94a]' : 'bg-surface'}`}>
              {marcada ? '✓' : ''}
            </span>
          </Opcao>
        );
      })}
    </Grupo>
  );
}
