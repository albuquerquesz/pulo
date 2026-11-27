import type { ComponentType } from 'react';

import {
  CorpoDasTravas,
  CorpoDoDia,
  CorpoDoLembrete,
  CorpoDoNome,
  CorpoDoNomeDoSapo,
  CorpoDoResumo,
  CorpoDosHabitos,
  type CorpoProps,
} from './corpos';
import { comoChamar, contarFolhas, PERIODOS, type RespostasDoOnboarding } from './logic';

export interface FalaDoSapo {
  titulo: string;
  detalhe?: string;
}

export interface Passo {
  id: string;
  /** O que o sapo diz ao chegar no passo. */
  fala: (respostas: RespostasDoOnboarding) => FalaDoSapo;
  Corpo: ComponentType<CorpoProps>;
  /** Libera o botão de seguir. */
  pronto: (respostas: RespostasDoOnboarding) => boolean;
  podePular: boolean;
  /** O que o sapo diz depois de uma resposta; `null` mantém a fala. */
  comentario?: (respostas: RespostasDoOnboarding) => string | null;
  /** Texto do botão de seguir (padrão: Continuar). */
  botao?: string;
}

/** Os passos do onboarding, na ordem em que aparecem. Para tirar, pôr ou reordenar um passo, mexa só aqui. */
export const PASSOS: readonly Passo[] = [
  {
    id: 'nome',
    fala: () => ({ titulo: 'Oi, eu sou o sapo da sua lagoa!', detalhe: 'E você, como se chama?' }),
    Corpo: CorpoDoNome,
    pronto: () => true,
    podePular: false,
  },
  {
    id: 'dia',
    fala: (r) => ({ titulo: `Prazer, ${comoChamar(r)}! Me conta do seu dia.`, detalhe: 'Fora desse horário eu fico quietinho.' }),
    Corpo: CorpoDoDia,
    pronto: (r) => r.periodo !== null,
    podePular: false,
    comentario: (r) => PERIODOS.find((p) => p.id === r.periodo)?.comentario ?? null,
  },
  {
    id: 'travas',
    fala: () => ({ titulo: 'O que mais te atrapalha quando vai fazer algo?', detalhe: 'Pode marcar mais de um.' }),
    Corpo: CorpoDasTravas,
    pronto: (r) => r.travas.length > 0,
    podePular: true,
    comentario: (r) => {
      if (r.travas.length === 0) return null;
      return r.travas.includes('comecar') ? 'Então vou sugerir focos curtinhos para destravar.' : 'Beleza, vou ficar de olho nisso com você.';
    },
  },
  {
    id: 'lembrete',
    fala: () => ({ titulo: 'Como você prefere que eu te chame para focar?' }),
    Corpo: CorpoDoLembrete,
    pronto: (r) => r.tom !== null && r.focoMinutos !== null,
    podePular: true,
  },
  {
    id: 'habitos',
    fala: () => ({ titulo: 'Escolha até 3 hábitos para começar.', detalhe: 'Cada um vira uma vitória-régia para eu pular.' }),
    Corpo: CorpoDosHabitos,
    pronto: (r) => r.habitos.length > 0,
    podePular: true,
    comentario: (r) => (r.habitos.length > 0 ? `${contarFolhas(r.habitos.length)} na lagoa!` : null),
  },
  {
    id: 'sapo',
    fala: () => ({ titulo: 'Agora que a gente se conhece: como você quer me chamar?', detalhe: 'Pode trocar depois no Perfil.' }),
    Corpo: CorpoDoNomeDoSapo,
    pronto: () => true,
    podePular: true,
    comentario: (r) => (r.nomeDoSapo ? `${r.nomeDoSapo}? Adorei!` : null),
  },
  {
    id: 'aprender',
    fala: () => ({
      titulo: 'Última coisa: posso aprender com o seu jeito?',
      detalhe: 'Uso só o que você me contou e como os seus focos vão indo, para ajustar as sugestões.',
    }),
    Corpo: CorpoDoResumo,
    pronto: () => true,
    podePular: false,
    botao: 'Pular na lagoa',
  },
];
