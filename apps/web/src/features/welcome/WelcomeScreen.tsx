import { Navigate } from '@tanstack/react-router';
import { useState } from 'react';

import { authClient } from '@/auth/client';
import { Sapo } from '@/mascot';
import { Botao, Texto } from '@/ui';

import { Tela } from '../app';

/** Porta de entrada: login com Google. Já logado, segue para o app. */
export function WelcomeScreen() {
  const { data, isPending } = authClient.useSession();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (data) return <Navigate to="/" replace />;

  const entrar = async () => {
    setOcupado(true);
    setErro(null);
    const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: `${window.location.origin}/` });
    if (error) setErro(error.message ?? 'Não deu para entrar.');
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
      <Texto cor="muted" className="text-center">
        Entre com sua conta Google para começar.
      </Texto>
      <Botao titulo="Entrar com Google" carregando={ocupado || isPending} onPress={() => void entrar()} testID="entrar-google" />
      {erro ? (
        <Texto cor="atencao" className="text-center">
          {erro}
        </Texto>
      ) : null}
    </Tela>
  );
}
