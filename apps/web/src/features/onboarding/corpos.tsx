import type { ReactNode } from 'react';

import { Chave } from '@/ui';

import { EscolhaDeHora } from '../perfil/HorarioDoDia';
import { Campo } from './Campo';
import {
  alternar,
  DURACOES_DO_FOCO,
  HABITOS_SUGERIDOS,
  MAXIMO_DE_HABITOS,
  NOMES_DE_SAPO,
  PERIODOS,
  TONS,
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
const GRADE = 'grid grid-cols-2 gap-2.5 md:grid-cols-4';

/** Um conjunto de opções com o nome da pergunta, para quem usa leitor de tela. */
function Grupo({ titulo, className, children }: GrupoProps) {
  return (
    <div role="group" aria-label={titulo} className={className}>
      {children}
    </div>
  );
}

function Rotulo({ children }: { children: string }) {
  return (
    <p aria-hidden="true" className="m-0 mt-1 text-[13px] font-black tracking-wider text-muted uppercase">
      {children}
    </p>
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
    <div className="grid gap-2.5 md:grid-cols-2">
      <Campo rotulo="Seu nome" valor={respostas.nome} maximo={30} autoComplete="given-name" onMudar={(nome) => escrever({ nome })} />
      <Campo rotulo="Sobrenome" valor={respostas.sobrenome} maximo={40} autoComplete="family-name" onMudar={(sobrenome) => escrever({ sobrenome })} />
    </div>
  );
}

export function CorpoDoDia({ respostas, responder }: CorpoProps) {
  const { startHour, endHour, periodo } = respostas;
  return (
    <>
      <div className="grid gap-2.5">
        <div className="rounded-[18px] border-[3px] border-contorno bg-surface py-2 pr-2.5 pl-4">
          <EscolhaDeHora rotulo="Começa às" horas={startHour} min={0} max={Math.min(22, endHour - 1)} onChange={(h) => responder({ startHour: h })} />
        </div>
        <div className="rounded-[18px] border-[3px] border-contorno bg-surface py-2 pr-2.5 pl-4">
          <EscolhaDeHora rotulo="Termina às" horas={endHour} min={startHour + 1} max={24} onChange={(h) => responder({ endHour: h })} />
        </div>
      </div>
      <Rotulo>Quando você rende mais?</Rotulo>
      <Grupo titulo="Quando você rende mais?" className={GRADE}>
        {PERIODOS.map((p) => (
          <Opcao key={p.id} marcada={periodo === p.id} onEscolher={() => responder({ periodo: p.id })}>
            <span aria-hidden="true" className="text-2xl">
              {p.icone}
            </span>
            {p.titulo}
          </Opcao>
        ))}
      </Grupo>
    </>
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
            <span aria-hidden="true" className={`ml-auto grid size-6 shrink-0 place-items-center rounded-lg border-[3px] border-contorno text-xs ${marcada ? 'bg-sapo' : 'bg-surface'}`}>
              {marcada ? '✓' : ''}
            </span>
          </Opcao>
        );
      })}
    </Grupo>
  );
}

export function CorpoDoLembrete({ respostas, responder }: CorpoProps) {
  return (
    <>
      <Grupo titulo="Tom do lembrete" className={UMA_COLUNA}>
        {TONS.map((t) => (
          <Opcao key={t.id} formato="linha" marcada={respostas.tom === t.id} onEscolher={() => responder({ tom: t.id })}>
            <TextosDaOpcao icone={t.icone} titulo={t.titulo} detalhe={t.detalhe} />
          </Opcao>
        ))}
      </Grupo>
      <Rotulo>Um foco seu costuma durar</Rotulo>
      <Grupo titulo="Um foco seu costuma durar" className="grid grid-cols-3 gap-2.5">
        {DURACOES_DO_FOCO.map((d) => (
          <Opcao key={d.minutos} marcada={respostas.focoMinutos === d.minutos} onEscolher={() => responder({ focoMinutos: d.minutos })}>
            <b className="text-[22px] font-black">{d.minutos} min</b>
            <small className="text-[13px] font-semibold text-muted">{d.titulo}</small>
          </Opcao>
        ))}
      </Grupo>
    </>
  );
}

export function CorpoDosHabitos({ respostas, responder }: CorpoProps) {
  const cheio = respostas.habitos.length >= MAXIMO_DE_HABITOS;
  return (
    <Grupo titulo="Hábitos para começar" className={GRADE}>
      {HABITOS_SUGERIDOS.map((h) => {
        const marcada = respostas.habitos.includes(h.titulo);
        return (
          <Opcao key={h.titulo} marcada={marcada} desativada={cheio && !marcada} onEscolher={() => responder({ habitos: alternar(respostas.habitos, h.titulo, MAXIMO_DE_HABITOS) })}>
            <span aria-hidden="true" className="text-2xl">
              {h.icone}
            </span>
            <span className="text-sm">{h.titulo}</span>
          </Opcao>
        );
      })}
    </Grupo>
  );
}

export function CorpoDoNomeDoSapo({ respostas, responder, escrever }: CorpoProps) {
  return (
    <>
      <Campo rotulo="Nome do sapo" valor={respostas.nomeDoSapo} maximo={24} dica="Pulo" onMudar={(nomeDoSapo) => escrever({ nomeDoSapo })} />
      <Grupo titulo="Sugestões de nome" className={GRADE}>
        {NOMES_DE_SAPO.map((nome) => (
          <Opcao key={nome} marcada={respostas.nomeDoSapo === nome} onEscolher={() => responder({ nomeDoSapo: nome })}>
            <span className="text-[15px]">{nome}</span>
          </Opcao>
        ))}
      </Grupo>
    </>
  );
}

type FatoProps = { icone: string; texto: string; valor: string };

function Fato({ icone, texto, valor }: FatoProps) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true">{icone}</span>
      <span>
        {texto} <b className="font-black">{valor}</b>
      </span>
    </li>
  );
}

export function CorpoDoResumo({ respostas, responder }: CorpoProps) {
  const vazio = 'ainda não sei';
  const periodo = PERIODOS.find((p) => p.id === respostas.periodo)?.resumo ?? vazio;
  const travas = TRAVAS.filter((t) => respostas.travas.includes(t.id)).map((t) => t.titulo.toLowerCase());
  const tom = TONS.find((t) => t.id === respostas.tom)?.resumo ?? vazio;
  const foco = respostas.focoMinutos ? `${respostas.focoMinutos} min` : vazio;
  return (
    <>
      <ul aria-label="O que o Pulo aprendeu" className="m-0 grid list-none gap-1.5 rounded-[18px] border-[3px] border-dashed border-contorno bg-surface px-3.5 py-3 text-sm">
        <Fato icone="🕒" texto="Rende mais:" valor={periodo} />
        <Fato icone="🧱" texto="Trava em:" valor={travas.join(', ') || vazio} />
        <Fato icone="💬" texto="Lembrete:" valor={tom} />
        <Fato icone="⏱️" texto="Foco:" valor={foco} />
      </ul>
      <div className="flex items-center gap-3 rounded-[18px] border-[3px] border-contorno bg-surface p-3.5">
        <p className="m-0 flex-1 font-extrabold">
          Deixar o Pulo aprender comigo
          <small className="mt-0.5 block text-[13px] font-semibold text-muted">Dá para ver e apagar tudo no Perfil, em "O que o Pulo sabe de você".</small>
        </p>
        <Chave rotulo="Deixar o Pulo aprender comigo" ligada={respostas.aprender} onMudar={(aprender) => responder({ aprender })} />
      </div>
    </>
  );
}
