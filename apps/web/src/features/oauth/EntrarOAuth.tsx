import { useState } from 'react';

import { SapoRosto } from '@/mascot';
import { Botao, Texto } from '@/ui';

import { Tela } from '../app';
import { MENSAGEM_LOGIN, urlDeErroDoLogin } from '../sessao/auth';
import { useVoltaDaPagina } from '../sessao/useVoltaDaPagina';
import { clienteOAuth } from './cliente';

/**
 * Login pedido por um app que quer usar o Pulo pelo MCP (Claude, por exemplo). Depois do Google, o servidor
 * continua sozinho para o consentimento: o plugin do cliente manda a consulta assinada da URL junto.
 */
export function EntrarOAuth() {
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cliente = clienteOAuth();

  const entrar = async () => {
    if (!cliente) return;
    setEntrando(true);
    setErro(null);
    const resposta = await cliente.signIn
      .social({ provider: 'google', callbackURL: `${window.location.origin}/`, errorCallbackURL: urlDeErroDoLogin('conexao') })
      .catch(() => null);
    // Deu certo: a página está saindo para o Google, então o botão continua ocupado.
    if (!resposta || resposta.error) {
      setErro(MENSAGEM_LOGIN);
      setEntrando(false);
    }
  };
  useVoltaDaPagina(() => setEntrando(false));

  return (
    <Tela>
      <div className="flex justify-center pt-6">
        <SapoRosto momento="conectando-conta" className="w-[140px]" />
      </div>
      <Texto como="h1" variante="display" className="text-center">
        Conectar ao Pulo
      </Texto>
      <Texto cor="muted" className="text-center">
        Um app quer usar o Pulo por você. Entre na sua conta para continuar; na próxima tela você decide se libera.
      </Texto>
      <Botao titulo="Entrar com Google" onPress={() => void entrar()} carregando={entrando} desativado={!cliente} testID="oauth-entrar" />
      {erro ? (
        <Texto cor="atencao" className="text-center" role="alert">
          {erro}
        </Texto>
      ) : null}
    </Tela>
  );
}
