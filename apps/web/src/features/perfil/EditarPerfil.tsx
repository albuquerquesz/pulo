import { useState, type FormEvent } from 'react';

import { ACCOUNT } from '@pulo/core/config/decisions';

import { CAMPO_DO_MODAL } from '@/ui';

import type { ContaNaTela } from '../casca/logic';
import type { MudancaDeConta } from '../sessao/auth';
import { BOTAO_DO_DIALOGO } from './Dialogo';
import { erroDaConta } from './logic';

type EditarPerfilProps = {
  conta: ContaNaTela;
  onSalvar: (mudanca: MudancaDeConta) => Promise<void>;
  onFechar: () => void;
};

export function EditarPerfil({ conta, onSalvar, onFechar }: EditarPerfilProps) {
  const [nome, setNome] = useState(conta.nome);
  const foto = conta.foto ?? '';
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    const problema = erroDaConta(nome, foto);
    setErro(problema);
    if (problema) return;
    setSalvando(true);
    try {
      await onSalvar({ nome: nome.trim(), foto: foto.trim() || null });
      onFechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui salvar seu perfil. Tente de novo.');
      setSalvando(false);
    }
  };

  return (
    <form noValidate onSubmit={(e) => void salvar(e)} className="flex w-full flex-col gap-4 p-5">
        <label className="flex flex-col gap-1">
          Nome
          <input className={CAMPO_DO_MODAL} value={nome} maxLength={ACCOUNT.nameMaxChars} onChange={(e) => setNome(e.target.value)} />
        </label>
        {erro ? (
          <p role="alert" className="font-extrabold">
            {erro}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <button type="submit" disabled={salvando} className={`${BOTAO_DO_DIALOGO} bg-lima`}>
            Salvar
          </button>
        </div>
    </form>
  );
}
