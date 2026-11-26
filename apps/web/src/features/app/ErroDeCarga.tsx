import { TelaDeEstado } from '@/ui';

import type { Falha } from './falha';

const TITULO: Record<Falha['momento'], string> = { 'sem-sinal': 'Sem sinal por aqui', erro: 'Algo tropeçou por aqui' };

export function textoDaFalha({ momento }: Falha, guardado: string): string {
  return momento === 'sem-sinal'
    ? `A lagoa ficou sem sinal. ${guardado} Confira a internet e tente de novo.`
    : `Não consegui abrir esta tela. ${guardado} Tentar de novo costuma resolver.`;
}

type ErroDeCargaProps = {
  falha: Falha;
  /** O que continua a salvo, em uma frase ("Seus hábitos estão salvos."). */
  guardado: string;
  onTentar: () => void;
};

/** O erro de carregamento de uma aba. */
export function ErroDeCarga({ falha, guardado, onTentar }: ErroDeCargaProps) {
  return (
    <TelaDeEstado
      momento={falha.momento}
      titulo={TITULO[falha.momento]}
      texto={textoDaFalha(falha, guardado)}
      acao={{ titulo: 'Tentar de novo', onPress: onTentar }}
    />
  );
}
