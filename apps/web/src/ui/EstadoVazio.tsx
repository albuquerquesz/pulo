import type { Momento } from '@/mascot/momentos';
import { SapoRosto } from '@/mascot/sapo/SapoRosto';

import { Botao } from './Botao';
import { Texto } from './Texto';

export type EstadoVazioProps = {
  titulo: string;
  texto?: string;
  /** Texto do botão; sem ele não há botão. */
  acao?: string;
  onAcao?: () => void;
  momento?: Momento;
  className?: string;
  testID?: string;
};

/** Vazio de dentro de uma tela, com o sapo, uma frase e um botão. */
export function EstadoVazio({ titulo, texto, acao, onAcao, momento = 'lista-vazia', className = '', testID }: EstadoVazioProps) {
  return (
    <div className={`flex flex-col items-center gap-3 p-6 text-center ${className}`} data-testid={testID}>
      <SapoRosto momento={momento} className="w-[160px]" />
      <Texto como="h2" variante="titulo">
        {titulo}
      </Texto>
      {texto ? <Texto cor="muted">{texto}</Texto> : null}
      {acao ? <Botao titulo={acao} onPress={onAcao} largura="auto" className="self-center" /> : null}
    </div>
  );
}
