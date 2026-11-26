import { BOTAO_PEQUENO } from './estilos';
import { Linha, Linhas } from './Linha';
import { Secao } from './Secao';

type ContaProps = {
  onSair: () => void;
  onExcluir: () => void;
};

export function Conta({ onSair, onExcluir }: ContaProps) {
  return (
    <Secao titulo="Conta" className="@xl:col-span-2">
      <Linhas>
        <Linha titulo="Sair da conta">
          <button type="button" onClick={onSair} aria-label="Sair da conta" className={BOTAO_PEQUENO}>
            Sair
          </button>
        </Linha>
        <Linha titulo="Excluir conta" detalhe="apaga tudo, inclusive o sapo" perigo>
          <button type="button" onClick={onExcluir} aria-label="Excluir conta" className={`${BOTAO_PEQUENO} text-foco-borda`}>
            Excluir
          </button>
        </Linha>
      </Linhas>
    </Secao>
  );
}
