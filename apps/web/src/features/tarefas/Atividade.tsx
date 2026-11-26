import { useEffect, useState } from 'react';

import { TASKS } from '@pulo/core/config/decisions';
import { taskTimeline } from '@pulo/core/domain/tasks';
import type { Repository, TaskActivity } from '@pulo/core/domain/types';

import { haQuanto, textoDoEvento } from './logic';

export interface AutorDaAtividade {
  nome: string;
  agora: number;
  fuso: string;
}

type AtividadeProps = {
  repo: Repository;
  tarefaId: string;
  /** Muda a cada escrita na tarefa: a atividade é lida de novo. */
  revisao: number;
  autor: AutorDaAtividade;
  /** Resolve com `false` se o comentário não foi gravado. */
  onComentar: (texto: string) => Promise<boolean>;
};

function Avatar({ nome }: { nome: string }) {
  return (
    <span aria-hidden="true" className="grid size-5 flex-none place-items-center rounded-full bg-sapo text-[11px] font-black text-ink-sobre-acao">
      {nome.charAt(0).toUpperCase()}
    </span>
  );
}

/** O histórico e os comentários, lidos só quando a gaveta abre. */
export function Atividade({ repo, tarefaId, revisao, autor, onComentar }: AtividadeProps) {
  const [atividade, setAtividade] = useState<TaskActivity | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    let vivo = true;
    repo.listTaskActivity(tarefaId).then(
      (lida) => {
        if (!vivo) return;
        setAtividade(lida);
        setFalhou(false);
      },
      () => {
        if (vivo) setFalhou(true);
      },
    );
    return () => {
      vivo = false;
    };
  }, [repo, tarefaId, revisao, tentativa]);

  const enviar = async () => {
    const comentario = texto.trim();
    if (!comentario) return;
    setTexto('');
    if (!(await onComentar(comentario))) setTexto((atual) => atual || comentario);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <h3 className="text-[17px] font-extrabold">Atividade</h3>
      {falhou ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-muted">
          Não consegui carregar a atividade.
          <button type="button" onClick={() => setTentativa((n) => n + 1)} className="cursor-pointer font-extrabold text-ink underline">
            Tentar de novo
          </button>
        </div>
      ) : null}
      <ul className="flex flex-col gap-3 text-sm text-muted">
        {atividade
          ? taskTimeline(atividade).map((item) =>
              item.type === 'evento' ? (
                <li key={item.event.id} className="flex items-center gap-2.5">
                  <Avatar nome={autor.nome} />
                  <span>
                    <b className="font-bold text-ink">{autor.nome}</b> {textoDoEvento(item.event, autor.fuso)} · {haQuanto(item.event.createdAt, autor.agora, autor.fuso)}
                  </span>
                </li>
              ) : (
                <li key={item.comment.id} className="rounded-[12px] border border-line bg-surface px-3.5 py-3 text-ink">
                  <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                    <Avatar nome={autor.nome} />
                    <b>{autor.nome}</b>
                    <span className="text-muted">· {haQuanto(item.comment.createdAt, autor.agora, autor.fuso)}</span>
                  </div>
                  <p className="break-words whitespace-pre-wrap">{item.comment.body}</p>
                </li>
              ),
            )
          : null}
      </ul>
      <div className="relative rounded-[12px] border border-line bg-surface focus-within:border-sapo">
        <textarea
          aria-label="Comentário"
          placeholder="Deixe um comentário…"
          maxLength={TASKS.commentMaxChars}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            void enviar();
          }}
          className="block min-h-[86px] w-full resize-none bg-transparent px-4 pt-3.5 pb-10 outline-none"
        />
        <button
          type="button"
          aria-label="Enviar"
          onClick={() => void enviar()}
          className="absolute right-3 bottom-2.5 grid size-[30px] cursor-pointer place-items-center rounded-full bg-line/80 font-black"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
