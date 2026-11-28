import { useCallback, useState, type FormEvent, type ReactNode } from 'react';

import { CAMPO_DO_MODAL, Modal } from '@/ui';

export interface Pergunta {
  titulo: string;
  detalhe?: string;
  /** O texto do botão que confirma. */
  acao: string;
  /** Com ela, o botão só habilita depois de a pessoa digitar a palavra. */
  palavra?: string;
}

export interface Confirmacao {
  /** Abre a pergunta; resolve `true` só com o botão de confirmar. */
  confirmar(pergunta: Pergunta): Promise<boolean>;
  /** O diálogo, para a tela desenhar. */
  confirmacao: ReactNode;
}

const BOTAO =
  'min-h-11 cursor-pointer rounded-[14px] border-[3px] border-contorno px-5 py-2 font-black text-contorno disabled:cursor-not-allowed disabled:opacity-50';

type DialogoProps = { pergunta: Pergunta; onResponder: (sim: boolean) => void };

function DialogoDeConfirmacao({ pergunta: { titulo, detalhe, acao, palavra }, onResponder }: DialogoProps) {
  const [texto, setTexto] = useState('');
  const pronto = palavra === undefined || texto.trim().toUpperCase() === palavra;
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (pronto) onResponder(true);
  };
  return (
    <Modal aberto onFechar={() => onResponder(false)} rotulo={titulo} porCima>
      <h2 className="text-center text-xl font-black">{titulo}</h2>
      {detalhe ? <p className="max-w-full text-center break-words">{detalhe}</p> : null}
      <form onSubmit={enviar} className="flex w-full flex-col items-center gap-4">
        {palavra ? (
          <label className="flex w-full flex-col gap-1 font-extrabold">
            Digite {palavra} para confirmar
            <input className={CAMPO_DO_MODAL} autoComplete="off" autoCapitalize="characters" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
        ) : null}
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => onResponder(false)} className={`${BOTAO} bg-white`}>
            Cancelar
          </button>
          <button type="submit" disabled={!pronto} className={`${BOTAO} bg-lima`}>
            {acao}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** A confirmação dentro do app, no lugar da janela do navegador. */
export function useConfirmacao(): Confirmacao {
  const [aberta, setAberta] = useState<{ pergunta: Pergunta; responder: (sim: boolean) => void } | null>(null);
  const confirmar = useCallback(
    (pergunta: Pergunta) =>
      new Promise<boolean>((responder) => {
        setAberta((anterior) => {
          anterior?.responder(false);
          return { pergunta, responder };
        });
      }),
    [],
  );
  const confirmacao = aberta ? (
    <DialogoDeConfirmacao
      pergunta={aberta.pergunta}
      onResponder={(sim) => {
        setAberta(null);
        aberta.responder(sim);
      }}
    />
  ) : null;
  return { confirmar, confirmacao };
}
