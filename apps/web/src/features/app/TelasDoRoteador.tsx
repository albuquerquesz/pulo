import { useNavigate, useRouter, type ErrorComponentProps } from '@tanstack/react-router';

import { TelaDeEstado } from '@/ui';

import { ErroDeCarga } from './ErroDeCarga';
import { falhaDe } from './falha';
import { Tela } from './Tela';

/** O 404 do roteador. */
export function NaoEncontrado() {
  const navegar = useNavigate();
  return (
    <Tela>
      <TelaDeEstado
        momento="nao-encontrado"
        titulo="Essa folha não existe"
        texto="O endereço pode ter mudado. Sua rotina e seu progresso continuam onde estavam."
        acao={{ titulo: 'Voltar ao início', onPress: () => void navegar({ to: '/' }) }}
      />
    </Tela>
  );
}

/** O erro que escapou de uma rota. */
export function ErroInesperado({ error, reset }: ErrorComponentProps) {
  const roteador = useRouter();
  const tentar = () => {
    reset();
    void roteador.invalidate();
  };
  return (
    <Tela>
      <ErroDeCarga falha={falhaDe(error)} guardado="O que você já salvou continua salvo." onTentar={tentar} />
    </Tela>
  );
}
