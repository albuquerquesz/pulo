import { useState, type FormEvent } from 'react';

import { ACCOUNT } from '@pulo/core/config/decisions';

import { CAMPO_DO_MODAL } from '@/ui';

import { BOTAO_DO_DIALOGO, Dialogo } from './Dialogo';
import { podeExcluir } from './logic';

type ExcluirContaProps = { onExcluir: () => Promise<void>; onFechar: () => void };

/** A exclusão só habilita com a palavra de confirmação digitada. */
export function ExcluirConta({ onExcluir, onFechar }: ExcluirContaProps) {
  const [texto, setTexto] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const excluir = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeExcluir(texto) || excluindo) return;
    setExcluindo(true);
    try {
      await onExcluir();
    } catch {
      // O repositório já avisou o que houve; a conta continua.
      setExcluindo(false);
    }
  };

  return (
    <Dialogo titulo="Excluir conta" onFechar={onFechar}>
      <p className="text-center">
        Isso apaga sua conta e tudo o que há nela, inclusive o sapo. Não dá para desfazer.
      </p>
      <form onSubmit={(e) => void excluir(e)} className="flex w-full flex-col gap-3">
        <label className="flex flex-col gap-1">
          Digite {ACCOUNT.deleteConfirmation} para confirmar
          <input className={CAMPO_DO_MODAL} autoComplete="off" autoCapitalize="characters" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <div className="flex justify-center gap-3">
          <button type="button" onClick={onFechar} className={`${BOTAO_DO_DIALOGO} bg-white`}>
            Cancelar
          </button>
          <button type="submit" disabled={!podeExcluir(texto) || excluindo} className={`${BOTAO_DO_DIALOGO} bg-cancelar`}>
            Excluir minha conta
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
