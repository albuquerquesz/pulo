import { useEffect, useState } from 'react';

import type { McpConnection } from '@pulo/core/api/schemas';

import { useApp } from '../app';
import { temConta } from '../app/conta';

export type Conexoes = { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'ok'; lista: McpConnection[] };

/** Os aplicativos com acesso à conta. À parte do resto: vem da rede e a tela não espera por ele. */
export function useConexoes() {
  const { repo, versao } = useApp();
  const [conexoes, setConexoes] = useState<Conexoes>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    const ler = async () => (temConta(repo) ? repo.listConnections() : []);
    ler().then(
      (lista) => vivo && setConexoes({ tipo: 'ok', lista }),
      () => vivo && setConexoes({ tipo: 'erro' }),
    );
    return () => {
      vivo = false;
    };
  }, [repo, versao, tentativa]);

  const desconectar = async (clientId: string) => {
    if (!temConta(repo)) return;
    await repo.disconnect(clientId);
    setConexoes((atual) => (atual.tipo === 'ok' ? { tipo: 'ok', lista: atual.lista.filter((c) => c.clientId !== clientId) } : atual));
  };

  return { conexoes, desconectar, tentarDeNovo: () => setTentativa((n) => n + 1) };
}
