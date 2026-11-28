import { useEffect, useState } from 'react';

import { SapoRosto } from '@/mascot';
import { Botao, Cartao, Texto } from '@/ui';

import { Tela } from '../app';
import { clienteOAuth, escoposLegiveis } from './cliente';

type Envio = { tipo: 'parado' } | { tipo: 'enviando'; liberar: boolean } | { tipo: 'erro'; mensagem: string };

const PEDIDO_VENCIDO = 'O pedido expirou ou não vale mais. Volte ao app e conecte de novo.';
const SEM_CONEXAO = 'Não foi possível falar com o Pulo. Confira sua conexão e tente de novo.';

/** O que as ferramentas do MCP fazem (apps/api/src/mcp/ferramentas.ts): ler e, com escrita, mudar. */
const LEITURA = 'Ver sua rotina, hábitos, focos, descansos, métricas, metas, tarefas, perfil e ilha.';
const ESCRITA = [
  'Criar, mudar e remover hábitos, blocos da rotina e metas.',
  'Marcar hábitos, controlar focos e descansos e decidir as propostas da semana.',
  'Criar e mover tarefas.',
  'Mudar seu perfil: nome do sapo, horário do dia, tema e movimento.',
  'Gastar suas joias em partes da casa e decorações (sem desfazer) e mudar decorações de lugar.',
];

/** Consentimento: a pessoa libera (ou não) um app para usar o Pulo pelo MCP. */
export function ConsentimentoOAuth() {
  const cliente = clienteOAuth();
  const busca = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const clientId = busca.get('client_id');
  const [nome, setNome] = useState('Um app');
  const [envio, setEnvio] = useState<Envio>({ tipo: 'parado' });
  const enviando = envio.tipo === 'enviando';
  // Só quem pede leitura sem escrita fica sem mudar nada; na dúvida, a tela avisa do acesso completo.
  const escopos = busca.get('scope')?.split(' ') ?? [];
  const somenteLeitura = escopos.includes('pulo:read') && !escopos.includes('pulo:write');

  useEffect(() => {
    if (!cliente || !clientId) return;
    // O nome vem do próprio app que se registrou: é o que ele diz ser, não algo que o Pulo verificou.
    cliente.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then(({ data }) => {
        if (data?.client_name) setNome(data.client_name);
      })
      // Sem o nome, a tela segue com "Um app" e os botões continuam valendo.
      .catch(() => undefined);
    // Só na abertura da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const decidir = async (liberar: boolean) => {
    if (!cliente) return;
    setEnvio({ tipo: 'enviando', liberar });
    const resposta = await cliente.oauth2.consent({ accept: liberar }).catch(() => null);
    // Sem erro, o cliente leva a página de volta ao app: os botões continuam ocupados.
    if (resposta && !resposta.error) return;
    const semConexao = !resposta?.error || resposta.error.status === 0 || resposta.error.status >= 500;
    setEnvio({ tipo: 'erro', mensagem: semConexao ? SEM_CONEXAO : PEDIDO_VENCIDO });
  };

  return (
    <Tela>
      <div className="flex justify-center pt-6">
        <SapoRosto momento="pedido-de-acesso" className="w-[140px]" />
      </div>
      <Texto como="h1" variante="titulo" className="text-center">
        {nome} quer usar o seu Pulo
      </Texto>
      <Cartao>
        <Texto variante="subtitulo">Se você liberar, ele poderá:</Texto>
        <ul className="m-0 grid list-disc gap-1 pl-5">
          {(somenteLeitura ? [LEITURA] : [LEITURA, ...ESCRITA]).map((acesso) => (
            <li key={acesso}>
              <Texto como="span">{acesso}</Texto>
            </li>
          ))}
        </ul>
        {escoposLegiveis(busca.get('scope')).map((e) => (
          <Texto key={e} variante="legenda" cor="muted">
            {e}
          </Texto>
        ))}
      </Cartao>
      {somenteLeitura ? null : (
        <div role="note" className="rounded-md bg-atencao p-4">
          <Texto cor="inkSobreAcao" className="font-extrabold">
            Atenção: ele também pode apagar todos os seus dados (sapo, rotina, hábitos, focos, descansos, propostas, metas, tarefas, casa e quarto), em todos os aparelhos. Não dá para desfazer.
          </Texto>
        </div>
      )}
      <Texto variante="legenda" cor="muted">
        Só libere apps em que você confia.
      </Texto>
      {envio.tipo === 'erro' ? (
        <Texto cor="atencao" role="alert">
          {envio.mensagem}
        </Texto>
      ) : null}
      <Botao titulo="Liberar" onPress={() => void decidir(true)} carregando={envio.tipo === 'enviando' && envio.liberar} desativado={!cliente || enviando} testID="oauth-liberar" />
      <Botao titulo="Agora não" variante="fantasma" onPress={() => void decidir(false)} carregando={envio.tipo === 'enviando' && !envio.liberar} desativado={!cliente || enviando} />
    </Tela>
  );
}
