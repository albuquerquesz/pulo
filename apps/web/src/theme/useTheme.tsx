import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { montarTema, resolverEsquema, resolverReduzirMovimento, type PreferenciaDeTema, type Tema } from './tema';

const TemaContext = createContext<Tema | null>(null);

const CONSULTA_ESCURO = '(prefers-color-scheme: dark)';
const CONSULTA_REDUZIR = '(prefers-reduced-motion: reduce)';

export function useConsultaDeMidia(consulta: string) {
  return useSyncExternalStore(
    (avisar) => {
      const lista = window.matchMedia(consulta);
      lista.addEventListener('change', avisar);
      return () => lista.removeEventListener('change', avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}

/** `prefers-reduced-motion` do sistema. */
export function useReduzirMovimentoDoSistema() {
  return useConsultaDeMidia(CONSULTA_REDUZIR);
}

type Sistema = { esquema?: 'light' | 'dark'; reduzirMovimento?: boolean };

export type TemaProviderProps = {
  /** Preferência do Perfil (User.theme). Padrão: sistema. */
  tema?: PreferenciaDeTema;
  /** Flag do Perfil (User.reduceMotion). Vale além do sistema. */
  reduzirMovimento?: boolean;
  /** Para testes: força o esquema e o reduzir do sistema. */
  sistema?: Sistema;
  /** Aplica o esquema no <html> (padrão true; temas aninhados, como na galeria, passam false). */
  raiz?: boolean;
  children: ReactNode;
};

/** Envolva o app uma vez, perto da raiz. Lê o Perfil e o sistema e marca o <html> para o CSS. */
export function TemaProvider({ tema = 'sistema', reduzirMovimento = false, sistema, raiz = true, children }: TemaProviderProps) {
  const escuroDoSistema = useConsultaDeMidia(CONSULTA_ESCURO);
  const reduzirDoSistema = useReduzirMovimentoDoSistema();
  const valor = useMemo(
    () =>
      montarTema(
        resolverEsquema(sistema?.esquema ?? (escuroDoSistema ? 'dark' : 'light'), tema),
        resolverReduzirMovimento(sistema?.reduzirMovimento ?? reduzirDoSistema, reduzirMovimento),
        true,
      ),
    [sistema?.esquema, sistema?.reduzirMovimento, escuroDoSistema, reduzirDoSistema, tema, reduzirMovimento],
  );

  useEffect(() => {
    if (!raiz) return;
    const html = document.documentElement;
    html.dataset.esquema = valor.esquema;
    html.dataset.reduzirMovimento = String(valor.reduzirMovimento);
  }, [raiz, valor.esquema, valor.reduzirMovimento]);

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

/** Tokens resolvidos para o tema atual. Sem provider, segue o sistema. */
export function useTheme() {
  const ctx = useContext(TemaContext);
  const escuroDoSistema = useConsultaDeMidia(CONSULTA_ESCURO);
  const reduzirDoSistema = useReduzirMovimentoDoSistema();
  const padrao = useMemo(
    () => montarTema(escuroDoSistema ? 'escuro' : 'claro', reduzirDoSistema, true),
    [escuroDoSistema, reduzirDoSistema],
  );
  return ctx ?? padrao;
}
