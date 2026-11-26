import { isRemoteError, type RemoteError } from '@pulo/client';

import type { Momento } from '@/mascot/momentos';

/** O que deu errado ao abrir uma tela: falta de rede ou um erro, com o código para o suporte. */
export type Falha = {
  momento: Extract<Momento, 'sem-sinal' | 'erro'>;
  codigo?: string;
};

const SEM_SINAL: Falha = { momento: 'sem-sinal' };

const estaSemRede = (): boolean => typeof navigator !== 'undefined' && !navigator.onLine;

function falhaRemota(erro: RemoteError): Falha {
  if (erro.kind === 'rede') return SEM_SINAL;
  return { momento: 'erro', codigo: erro.code ?? (erro.status ? `http_${erro.status}` : erro.kind) };
}

/** Classifica o que veio de um `catch`. */
export function falhaDe<E>(erro: E): Falha {
  if (estaSemRede()) return SEM_SINAL;
  if (isRemoteError(erro)) return falhaRemota(erro);
  return { momento: 'erro', codigo: erro instanceof Error ? erro.name : 'desconhecido' };
}
