import { createRouter } from '@tanstack/react-router';

import { ErroInesperado, NaoEncontrado } from './features/app/TelasDoRoteador';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NaoEncontrado,
    defaultErrorComponent: ErroInesperado,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
