import { Sapo } from "@/mascot";
import { Botao, TelaDeEstado, Texto } from "@/ui";

import { Tela, useApp } from "../app";

/** Uma coluna estreita, centralizada na tela: no desktop os botões não esticam pela tela toda. */
const COLUNA = "mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-sm flex-col items-center justify-center gap-4 text-center";

export const TEXTO_SEM_SINAL =
  "A lagoa ficou sem sinal. Confira a internet e tente de novo.";

/** Porta do app: sem sessão. Também mostra "sem sinal" quando há sessão mas o servidor não respondeu. */
export function WelcomeScreen() {
  const {
    fase,
    entrar,
    entrando,
    erroDeLogin,
    loginDisponivel,
    tentarDeNovo,
  } = useApp();

  if (fase === "sem_conexao") {
    return (
      <Tela>
        <TelaDeEstado
          momento="sem-sinal"
          titulo="Sem sinal por aqui"
          texto={TEXTO_SEM_SINAL}
          acao={{ titulo: "Tentar de novo", onPress: () => void tentarDeNovo() }}
        />
      </Tela>
    );
  }

  return (
    <Tela>
      <div className={COLUNA}>
        <div className="flex justify-center">
          <Sapo fase={1} momento="boas-vindas" tamanho={200} />
        </div>
        <Texto como="h1" variante="display" className="text-center">
          Boas-vindas ao Pulo
        </Texto>
        <Texto cor="muted" className="text-center">
          Entre para guardar sua rotina e seu progresso na sua conta, e
          continuar de onde parou em qualquer aparelho.
        </Texto>
        <Botao
          titulo="Entrar com Google"
          onPress={() => void entrar()}
          carregando={entrando}
          desativado={!loginDisponivel}
          testID="entrar-google"
        />
        {erroDeLogin ? (
          <Texto cor="atencao" className="text-center" role="alert">
            {erroDeLogin}
          </Texto>
        ) : null}
        {!loginDisponivel ? (
          <Texto variante="legenda" cor="muted" className="text-center">
            O login ainda não está configurado neste app.
          </Texto>
        ) : null}
      </div>
    </Tela>
  );
}
