import type { Momento } from '@/mascot/momentos';
import { SapoRosto } from '@/mascot/sapo/SapoRosto';

import { Botao } from './Botao';
import { Texto } from './Texto';

export type AcaoDeEstado = {
  titulo: string;
  onPress: () => void;
};

export type TelaDeEstadoProps = {
  momento: Momento;
  titulo: string;
  texto: string;
  /** A ação principal, em botão cheio. */
  acao?: AcaoDeEstado;
  /** Botões fantasma, embaixo da principal. */
  secundarias?: readonly AcaoDeEstado[];
  testID?: string;
};

/** Tela de página inteira (erro, sem sinal, não encontrado): coluna centralizada, sapo grande, texto e ações. */
export function TelaDeEstado({ momento, titulo, texto, acao, secundarias = [], testID }: TelaDeEstadoProps) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 pt-2 text-center md:pt-[8vh]" data-testid={testID}>
      <div className="flex justify-center">
        <SapoRosto momento={momento} className="w-[240px]" />
      </div>
      <Texto como="h1" variante="titulo">
        {titulo}
      </Texto>
      <Texto cor="muted">{texto}</Texto>
      {acao ? <Botao titulo={acao.titulo} onPress={acao.onPress} /> : null}
      {secundarias.length > 0 ? (
        <div className="flex flex-col gap-2">
          {secundarias.map((s) => (
            <Botao key={s.titulo} titulo={s.titulo} variante="fantasma" onPress={s.onPress} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
