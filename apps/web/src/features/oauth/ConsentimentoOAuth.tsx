import { useEffect, useState } from 'react';

import { Sapo } from '@/mascot';
import { Botao, Cartao, Texto } from '@/ui';

import { Tela } from '../app';
import { clienteOAuth, escoposLegiveis } from './cliente';

type Estado = { tipo: 'pronto'; nome: string } | { tipo: 'enviando' } | { tipo: 'erro'; mensagem: string };

/** Consentimento: a pessoa libera (ou não) um app para usar o Pulo pelo MCP, com as mesmas ações das telas. */
export function ConsentimentoOAuth() {
  const cliente = clienteOAuth();
  const busca = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const clientId = busca.get('client_id');
  const [estado, setEstado] = useState<Estado>({ tipo: 'pronto', nome: 'Um app' });

  useEffect(() => {
    if (!cliente || !clientId) return;
    // O nome vem do próprio app que se registrou: é o que ele diz ser, não algo que o Pulo verificou.
    void cliente.oauth2.publicClient({ query: { client_id: clientId } }).then(({ data }) => {
      if (data?.client_name) setEstado({ tipo: 'pronto', nome: data.client_name });
    });
    // Só na abertura da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const decidir = async (accept: boolean) => {
    if (!cliente) return;
    setEstado({ tipo: 'enviando' });
    const { error } = await cliente.oauth2.consent({ accept });
    if (error) setEstado({ tipo: 'erro', mensagem: 'O pedido expirou ou não vale mais. Volte ao app e conecte de novo.' });
  };

  const nome = estado.tipo === 'pronto' ? estado.nome : 'O app';
  return (
    <Tela>
      <div className="flex justify-center pt-6">
        <Sapo fase={1} estado="surpreso" tamanho={140} />
      </div>
      <Texto como="h1" variante="titulo" className="text-center">
        {nome} quer usar o seu Pulo
      </Texto>
      <Cartao>
        <Texto variante="subtitulo">Se você liberar, ele poderá:</Texto>
        <Texto>Ver e mudar sua rotina, hábitos, focos, descansos, metas e propostas da semana, como você faz nas telas.</Texto>
        {escoposLegiveis(busca.get('scope')).map((e) => (
          <Texto key={e} variante="legenda" cor="muted">
            {e}
          </Texto>
        ))}
      </Cartao>
      <Texto variante="legenda" cor="muted">
        Só libere apps em que você confia.
      </Texto>
      {estado.tipo === 'erro' ? (
        <Texto cor="atencao" role="alert">
          {estado.mensagem}
        </Texto>
      ) : null}
      <Botao titulo="Liberar" onPress={() => void decidir(true)} carregando={estado.tipo === 'enviando'} desativado={!cliente} testID="oauth-liberar" />
      <Botao titulo="Agora não" variante="fantasma" onPress={() => void decidir(false)} desativado={!cliente || estado.tipo === 'enviando'} />
    </Tela>
  );
}
