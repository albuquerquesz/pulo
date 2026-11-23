import { Sapo } from '@/mascot';
import { Botao, EstadoVazio, Texto } from '@/ui';

import { Tela, useApp } from '../app';

export const TEXTO_SEM_SINAL = 'A lagoa ficou sem sinal. Confira a internet e tente de novo.';

/** Porta do app: sem sessão e sem demo. Também mostra "sem sinal" quando há sessão mas o servidor não respondeu. */
export function WelcomeScreen() {
  const { fase, entrar, entrando, erroDeLogin, loginDisponivel, enableDemo, tentarDeNovo, sair } = useApp();

  if (fase === 'sem_conexao') {
    return (
      <Tela semBarra>
        <EstadoVazio titulo="Sem sinal por aqui" texto={TEXTO_SEM_SINAL} acao="Tentar de novo" onAcao={() => void tentarDeNovo()} />
        <Botao titulo="Entrar com outra conta" variante="fantasma" onPress={() => void sair()} />
        <Botao titulo="Ver o demo" variante="fantasma" onPress={() => void enableDemo()} />
      </Tela>
    );
  }

  return (
    <Tela semBarra>
      <div className="flex justify-center pt-6">
        <Sapo fase={1} estado="feliz" tamanho={160} />
      </div>
      <Texto como="h1" variante="display" className="text-center">
        Boas vindas ao Pulo
      </Texto>
      <Texto cor="muted" className="text-center">
        Entre para guardar sua rotina e seu progresso na sua conta, e continuar de onde parou em qualquer aparelho.
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
          Só quer espiar? O demo usa dados de exemplo, não pede conta e não guarda nada no servidor.
        </Texto>
        <Botao titulo="Ver o demo" variante="fantasma" onPress={() => void enableDemo()} testID="ver-demo" />
      </div>
    </Tela>
  );
}
