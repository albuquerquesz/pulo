import { useEffect, useState } from 'react';

import { authClient, lerConta, type Conta } from '@/auth/client';
import { Sapo } from '@/mascot';
import { Botao, Cartao, Texto } from '@/ui';

import { Tela } from '../app';

type EstadoDaConta = { tipo: 'carregando' } | { tipo: 'fora' } | { tipo: 'dentro'; conta: Conta } | { tipo: 'erro'; mensagem: string };

async function lerEstadoDaConta(): Promise<EstadoDaConta> {
  try {
    const { data } = await authClient.getSession();
    if (!data) return { tipo: 'fora' };
    return { tipo: 'dentro', conta: await lerConta() };
  } catch (e) {
    return { tipo: 'erro', mensagem: e instanceof Error ? e.message : 'Não deu para ler a conta.' };
  }
}

/** Tela provisória para testar o login com Google. */
export function WelcomeScreen() {
  const [estado, setEstado] = useState<EstadoDaConta>({ tipo: 'carregando' });
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void lerEstadoDaConta().then((novo) => {
      if (vivo) setEstado(novo);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const entrar = async () => {
    setOcupado(true);
    const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: `${window.location.origin}/welcome` });
    if (error) setEstado({ tipo: 'erro', mensagem: error.message ?? 'Não deu para entrar.' });
    setOcupado(false);
  };

  const sair = async () => {
    setOcupado(true);
    await authClient.signOut();
    setEstado({ tipo: 'fora' });
    setOcupado(false);
  };

  return (
    <Tela semBarra>
      <div className="flex justify-center pt-6">
        <Sapo fase={1} estado="feliz" tamanho={160} />
      </div>
      <Texto como="h1" variante="display" className="text-center">
        Boas vindas ao Pulo
      </Texto>

      {estado.tipo === 'carregando' ? <Texto cor="muted" className="text-center">Conferindo sua conta...</Texto> : null}

      {estado.tipo === 'fora' ? (
        <>
          <Texto cor="muted" className="text-center">
            Entre com sua conta Google para guardar suas preferências.
          </Texto>
          <Botao titulo="Entrar com Google" carregando={ocupado} onPress={() => void entrar()} testID="entrar-google" />
        </>
      ) : null}

      {estado.tipo === 'dentro' ? (
        <>
          <Cartao>
            <Texto variante="subtitulo">{estado.conta.user.name}</Texto>
            <Texto cor="muted">{estado.conta.user.email}</Texto>
          </Cartao>
          <Botao titulo="Sair" variante="fantasma" desativado={ocupado} onPress={() => void sair()} />
        </>
      ) : null}

      {estado.tipo === 'erro' ? (
        <Cartao>
          <Texto cor="atencao">{estado.mensagem}</Texto>
          <Botao titulo="Tentar de novo" variante="fantasma" onPress={() => void lerEstadoDaConta().then(setEstado)} />
        </Cartao>
      ) : null}
    </Tela>
  );
}
