import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { AppProvider, useApp } from '@/features/app';
import { autenticacaoDoApp } from '@/features/sessao/auth';
import { TemaProvider } from '@/theme';
import { Texto, Toast } from '@/ui';

import estilos from '../styles.css?url';

type ComFilhos = { children: ReactNode };

// Um cliente de login por execução do app.
const autenticacao = autenticacaoDoApp();

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#8FE05A' },
      { title: 'Pulo' },
      { name: 'description', content: 'Hábitos e foco sem culpa, com um sapo que cresce junto com você.' },
    ],
    links: [
      { rel: 'stylesheet', href: estilos },
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'apple-touch-icon', href: '/icon.png' },
    ],
  }),
  shellComponent: Documento,
  component: Raiz,
});

function Documento({ children }: ComFilhos) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Raiz() {
  return (
    <AppProvider autenticacao={autenticacao}>
      <TemaDoUsuario>
        <Conteudo />
      </TemaDoUsuario>
    </AppProvider>
  );
}

function TemaDoUsuario({ children }: ComFilhos) {
  const { user } = useApp();
  return (
    <TemaProvider tema={user?.theme ?? 'sistema'} reduzirMovimento={user?.reduceMotion ?? false}>
      {children}
    </TemaProvider>
  );
}

function Conteudo() {
  const { carregando, demo, aviso, esconderAviso } = useApp();
  // Os dados ficam no aparelho: até ler o armazenamento local, não há o que mostrar.
  if (carregando) return null;

  return (
    <>
      {demo ? (
        <div role="alert" data-testid="selo-demo" className="flex min-h-8 items-center justify-center bg-sol px-3 py-1.5">
          <Texto variante="legenda" cor="inkSobreAcao">
            Modo demo, dados de exemplo
          </Texto>
        </div>
      ) : null}
      <Outlet />
      {aviso ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-26 z-40 mx-auto max-w-xl md:bottom-6">
          <div className="pointer-events-auto">
            <Toast
              key={aviso.id}
              mensagem={aviso.mensagem}
              variante={aviso.variante === 'atencao' ? 'aviso' : 'sucesso'}
              acao={aviso.acao}
              onAcao={() => {
                aviso.onAcao?.();
                esconderAviso();
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
