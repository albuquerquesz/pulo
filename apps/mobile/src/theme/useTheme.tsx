import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { useFontesPulo } from './fontes';
import {
  montarTema,
  resolverEsquema,
  resolverReduzirMovimento,
  type PreferenciaDeTema,
  type Tema,
} from './tema';

const TemaContext = createContext<Tema | null>(null);

/** Reduzir movimento pedido ao sistema (iOS, Android e `prefers-reduced-motion` no web). */
export function useReduzirMovimentoDoSistema(): boolean {
  const [reduzir, setReduzir] = useState(false);
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => vivo && setReduzir(!!v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduzir(!!v));
    return () => {
      vivo = false;
      sub?.remove?.();
    };
  }, []);
  return reduzir;
}

export interface TemaProviderProps {
  /** Preferência do Perfil (User.theme). Padrão: sistema. */
  tema?: PreferenciaDeTema;
  /** Flag do Perfil (User.reduceMotion). Vale além do sistema. */
  reduzirMovimento?: boolean;
  /** Carrega a Nunito. Padrão true; testes passam false. */
  carregarFontes?: boolean;
  /** Para testes: força o esquema e o reduzir do sistema. */
  sistema?: { esquema?: 'light' | 'dark'; reduzirMovimento?: boolean };
  children: ReactNode;
}

function FontesGate({ children }: { children: (prontas: boolean) => ReactNode }) {
  return <>{children(useFontesPulo())}</>;
}

function Interno({
  tema = 'sistema',
  reduzirMovimento = false,
  sistema,
  fontesProntas,
  children,
}: Omit<TemaProviderProps, 'carregarFontes'> & { fontesProntas: boolean }) {
  const esquemaSistema = useColorScheme();
  const reduzirSistema = useReduzirMovimentoDoSistema();
  const valor = useMemo(
    () =>
      montarTema(
        resolverEsquema(sistema?.esquema ?? esquemaSistema, tema),
        resolverReduzirMovimento(sistema?.reduzirMovimento ?? reduzirSistema, reduzirMovimento),
        fontesProntas,
      ),
    [sistema?.esquema, sistema?.reduzirMovimento, esquemaSistema, reduzirSistema, tema, reduzirMovimento, fontesProntas],
  );
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

/** Envolva o app uma vez, perto da raiz. Lê o Perfil e o sistema; carrega a Nunito. */
export function TemaProvider({ carregarFontes = true, children, ...resto }: TemaProviderProps) {
  const pai = useContext(TemaContext);
  if (!carregarFontes) {
    // herda as fontes do provider de fora (útil para temas aninhados, como na galeria)
    return (
      <Interno {...resto} fontesProntas={pai?.fontesProntas ?? false}>
        {children}
      </Interno>
    );
  }
  return (
    <FontesGate>
      {(prontas) => (
        <Interno {...resto} fontesProntas={prontas}>
          {children}
        </Interno>
      )}
    </FontesGate>
  );
}

/** Tokens resolvidos para o tema atual. Sem provider, segue o sistema. */
export function useTheme(): Tema {
  const ctx = useContext(TemaContext);
  const esquemaSistema = useColorScheme();
  const reduzirSistema = useReduzirMovimentoDoSistema();
  const padrao = useMemo(
    () => montarTema(resolverEsquema(esquemaSistema, 'sistema'), reduzirSistema, false),
    [esquemaSistema, reduzirSistema],
  );
  return ctx ?? padrao;
}
