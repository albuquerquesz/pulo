import type { ComponentType } from 'react';

import {
  CorpoDasTravas,
  CorpoDoNome,
  CorpoDaIdade,
  CorpoDoMomento,
  CorpoDosHabitos,
  type CorpoProps,
} from './corpos';
import { comentarioDaIdade, comoChamar, contarFolhas, MOMENTOS, TRAVAS, type RespostasDoOnboarding } from './logic';

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
    fala: () => ({ titulo: 'Oi! Como você se chama?' }),
    Corpo: CorpoDoNome,
    pronto: (r) => r.nome.trim() !== '' && r.sobrenome.trim() !== '',
    podePular: false,
  },
  {
    id: 'idade',
    fala: (r) => ({ titulo: r.idade === null ? `Prazer, ${comoChamar(r)}! Quantos anos você tem?` : comentarioDaIdade(r.idade), detalhe: r.idade === null ? 'Arrasta a folhinha ou usa o + e o −.' : undefined }),
    Corpo: CorpoDaIdade,
    pronto: (r) => r.idade !== null,
    podePular: false,
  },
  {
    id: 'momento',
    fala: () => ({ titulo: 'Como anda a sua vida hoje?' }),
    Corpo: CorpoDoMomento,
    pronto: (r) => r.momento !== null,
    podePular: false,
    comentario: (r) => MOMENTOS.find((m) => m.id === r.momento)?.comentario ?? null,
  },
  {
    id: 'travas',
    fala: () => ({ titulo: 'O que mais te atrapalha quando vai fazer algo?', detalhe: 'Pode marcar mais de um.' }),
    Corpo: CorpoDasTravas,
    pronto: (r) => r.travas.length > 0,
    podePular: true,
    // Comenta a última marcada; desmarcar volta ao comentário da anterior.
    comentario: (r) => TRAVAS.find((t) => t.id === r.travas.at(-1))?.comentario ?? null,
  },
  {
    id: 'habitos',
    fala: () => ({ titulo: 'Escolha até 3 hábitos para começar.', detalhe: 'Cada um vira uma vitória-régia para eu pular.' }),
    Corpo: CorpoDosHabitos,
    pronto: (r) => r.habitos.length > 0,
    podePular: true,
    comentario: (r) => (r.habitos.length > 0 ? `${contarFolhas(r.habitos.length)} na lagoa!` : null),
    botao: 'Pular na lagoa',
  },
];
