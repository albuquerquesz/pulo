import { BOTAO_PEQUENO } from './estilos';
import { Linha, Linhas } from './Linha';
import { Secao } from './Secao';

type ContaProps = {
  onSair: () => void;
  onExcluir: () => void;
  /** Ausente quando o repositório não exporta. */
  onBaixar?: () => void;
  onApagar: () => void;
};

export function Conta({ onSair, onExcluir, onBaixar, onApagar }: ContaProps) {
  return (
    <Secao titulo="Conta" className="@xl:col-span-2">
      <Linhas>
        <Linha titulo="Sair da conta">
          <button type="button" onClick={onSair} aria-label="Sair da conta" className={BOTAO_PEQUENO}>
            Sair
          </button>
        </Linha>
        {onBaixar ? (
          <Linha titulo="Baixar meus dados" detalhe="um arquivo com tudo o que é seu">
            <button type="button" onClick={onBaixar} aria-label="Baixar meus dados" className={BOTAO_PEQUENO}>
              Baixar
            </button>
          </Linha>
        ) : null}
        <Linha titulo="Apagar meus dados" detalhe="zera o progresso e mantém a conta" perigo>
          <button type="button" onClick={onApagar} aria-label="Apagar meus dados" className={`${BOTAO_PEQUENO} text-perigo-texto`}>
            Apagar
          </button>
        </Linha>
        <Linha titulo="Excluir conta" detalhe="apaga tudo, inclusive o sapo" perigo>
          <button type="button" onClick={onExcluir} aria-label="Excluir conta" className={`${BOTAO_PEQUENO} text-perigo-texto`}>
            Excluir
          </button>
        </Linha>
      </Linhas>
    </Secao>
  );
}
