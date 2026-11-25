import { Sapo } from "@/mascot";
import { Botao, EstadoVazio, Texto } from "@/ui";

import { Tela, useApp } from "../app";

/** Uma coluna estreita e centralizada: no desktop os botões não esticam pela tela toda. */
const COLUNA = "mx-auto flex w-full max-w-sm flex-col gap-4 pt-6 md:pt-[12vh]";

export const TEXTO_SEM_SINAL =
  "A lagoa ficou sem sinal. Confira a internet e tente de novo.";

/** Porta do app: sem sessão e sem demo. Também mostra "sem sinal" quando há sessão mas o servidor não respondeu. */
export function WelcomeScreen() {
  const {
    fase,
    entrar,
    entrando,
    erroDeLogin,
    loginDisponivel,
    enableDemo,
    tentarDeNovo,
    sair,
  } = useApp();

  if (fase === "sem_conexao") {
    return (
      <Tela>
        <div className={COLUNA}>
          <EstadoVazio
            titulo="Sem sinal por aqui"
            texto={TEXTO_SEM_SINAL}
            estadoDoSapo="cansado"
            className="p-0"
          />
          <Botao titulo="Tentar de novo" onPress={() => void tentarDeNovo()} />
          <div className="flex flex-col gap-2">
            <Botao
              titulo="Entrar com outra conta"
              variante="fantasma"
              onPress={() => void sair()}
            />
            <Botao
              titulo="Ver o demo"
              variante="fantasma"
              onPress={() => void enableDemo()}
            />
          </div>
        </div>
      </Tela>
    );
  }

  return (
    <Tela>
      <div className={COLUNA}>
        <div className="flex justify-center">
          <Sapo fase={1} estado="feliz" tamanho={160} />
        </div>
        <Texto como="h1" variante="display" className="text-center">
          Boas vindas ao Pulo
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
        <div className="mt-4 flex flex-col gap-2">
          <Texto variante="legenda" cor="muted" className="text-center">
            Só quer espiar? O demo usa dados de exemplo, não pede conta e não
            guarda nada no servidor.
          </Texto>
          <Botao
            titulo="Ver o demo"
            variante="fantasma"
            onPress={() => void enableDemo()}
            testID="ver-demo"
          />
        </div>
      </div>
    </Tela>
  );
}
