import { useEffect, useRef } from 'react';

import { SapoRosto } from '@/mascot';
import { Botao } from '@/ui';

import { comoChamar, contarFolhas, nomeDoSapoEscolhido, type RespostasDoOnboarding } from './logic';

type FinalProps = { respostas: RespostasDoOnboarding; salvando: boolean; onEntrar: () => void };

/** A despedida: o sapo atravessa a lagoa de folha em folha. */
export function Final({ respostas, salvando, onEntrar }: FinalProps) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []);
  const folhas = respostas.habitos.length;
  return (
    <section className="onboarding-final relative z-2 flex flex-1 flex-col items-center justify-center gap-3.5 p-8 text-center">
      <div aria-hidden="true" className="relative h-[150px] w-[260px]">
        <div className="absolute inset-x-0 bottom-0 h-[70px] rounded-[50%] border-[3px] border-contorno bg-agua" />
        <div className="absolute bottom-[30px] left-4 h-[26px] w-[58px] rounded-[50%] border-[3px] border-contorno bg-sapo" />
        <div className="absolute bottom-[30px] left-24 h-[26px] w-[58px] rounded-[50%] border-[3px] border-contorno bg-sapo" />
        <div className="absolute bottom-[30px] left-44 h-[26px] w-[58px] rounded-[50%] border-[3px] border-contorno bg-sapo" />
        <div className="onboarding-atravessa absolute bottom-10 left-2.5 w-[90px]">
          <SapoRosto className="block w-full" />
        </div>
      </div>
      <h1 ref={titulo} tabIndex={-1} className="m-0 text-3xl font-black">
        Bora, {comoChamar(respostas)}!
      </h1>
      <p className="m-0 font-bold text-muted">
        {nomeDoSapoEscolhido(respostas)} já está na lagoa{folhas > 0 ? `, com ${contarFolhas(folhas)} para pular` : ''}.
      </p>
      <Botao titulo="Entrar na lagoa" variante="foco" carregando={salvando} onPress={onEntrar} className="max-w-[260px]" />
    </section>
  );
}
