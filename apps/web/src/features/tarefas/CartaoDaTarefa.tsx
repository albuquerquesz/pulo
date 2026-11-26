import { TASK_COLUMNS } from '@pulo/core/domain/tasks';
import type { DateKey, Task, TaskStatus, TaskSubtask } from '@pulo/core/domain/types';

import { CHIP, Etiqueta } from './Etiqueta';
import { NOME_DA_COLUNA, textoDoPrazo, type Passo } from './logic';

export interface AcoesDoCartao {
  abrir(id: string): void;
  alternarSubtarefas(id: string): void;
  marcarSubtarefa(subtarefa: TaskSubtask, feita: boolean): void;
  novaSubtarefa(tarefa: Task): void;
  mover(tarefa: Task, status: TaskStatus): void;
  passo(tarefa: Task, passo: Passo): void;
  arrastar(id: string | null): void;
}

type CartaoProps = {
  tarefa: Task;
  subtarefas: TaskSubtask[];
  pomodoros: number;
  hoje: DateKey;
  aberto: boolean;
  arrastando: boolean;
  acoes: AcoesDoCartao;
};

function Prioridade({ alta, pomodoros }: { alta: boolean; pomodoros: string }) {
  const apagada = alta ? 'fill-foco' : 'fill-line';
  const acesa = alta ? 'fill-foco' : 'fill-muted';
  return (
    <span className={CHIP} title={alta ? 'prioridade alta' : 'prioridade normal'}>
      <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
        <rect x="1" y="7" width="2" height="4" rx=".6" className={acesa} />
        <rect x="5" y="4" width="2" height="7" rx=".6" className={acesa} />
        <rect x="9" y="1" width="2" height="10" rx=".6" className={apagada} />
      </svg>
      {alta ? <span className="sr-only">Prioridade alta</span> : null}
      {pomodoros}
    </span>
  );
}

/** Menu de mover para telas de toque, onde não há arrastar. */
function Mover({ tarefa, acoes }: { tarefa: Task; acoes: AcoesDoCartao }) {
  return (
    <label className="relative grid size-8 flex-none place-items-center rounded-[8px] text-muted [@media(hover:hover)]:hidden">
      <span aria-hidden="true">⇅</span>
      <select
        aria-label={`Mover ${tarefa.title}`}
        value=""
        onChange={(e) => {
          const valor = e.target.value;
          const coluna = TASK_COLUMNS.find((c) => c === valor);
          if (coluna) acoes.mover(tarefa, coluna);
          else if (valor === 'subir' || valor === 'descer') acoes.passo(tarefa, valor);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="" disabled>
          Mover
        </option>
        <option value="subir">Subir</option>
        <option value="descer">Descer</option>
        {TASK_COLUMNS.filter((c) => c !== tarefa.status).map((c) => (
          <option key={c} value={c}>
            Para {NOME_DA_COLUNA[c]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CartaoDaTarefa({ tarefa, subtarefas, pomodoros, hoje, aberto, arrastando, acoes }: CartaoProps) {
  const total = subtarefas.length;
  const feitas = subtarefas.filter((s) => s.done).length;
  return (
    <article
      data-tarefa={tarefa.id}
      aria-label={tarefa.title}
      draggable
      onDragStart={(e) => {
        // O Firefox só arrasta com algum dado.
        e.dataTransfer?.setData('text/plain', tarefa.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        acoes.arrastar(tarefa.id);
      }}
      onDragEnd={() => acoes.arrastar(null)}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest('button,input,label,select')) return;
        acoes.abrir(tarefa.id);
      }}
      className={`flex flex-none cursor-grab flex-col gap-2.5 overflow-hidden rounded-[14px] border border-line bg-surface px-3.5 pt-3.5 transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--pulo-sapo)_45%,var(--pulo-line))] active:cursor-grabbing ${total ? '' : 'pb-3.5'} ${arrastando ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <b
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            acoes.abrir(tarefa.id);
          }}
          className={`min-w-0 text-[15px] leading-[1.35] font-bold break-words ${tarefa.status === 'feito' ? 'text-muted line-through' : ''}`}
        >
          {tarefa.title}
        </b>
        <Mover tarefa={tarefa} acoes={acoes} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Prioridade
          alta={tarefa.priority === 'alta'}
          pomodoros={tarefa.pomodorosEstimated ? `${pomodoros}/${tarefa.pomodorosEstimated} 🍅` : '—'}
        />
        {tarefa.tags.map((nome) => (
          <Etiqueta key={nome} nome={nome} />
        ))}
        {tarefa.dueDate ? <span className={CHIP}>📅 {textoDoPrazo(tarefa.dueDate, hoje)}</span> : null}
      </div>
      {total ? (
        <div className="-mx-3.5 mt-0.5 border-t border-line">
          <button
            type="button"
            aria-expanded={aberto}
            onClick={() => acoes.alternarSubtarefas(tarefa.id)}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 pt-2.5 pb-2 text-sm font-bold text-muted"
          >
            <span aria-hidden="true" className="text-base">
              ↳
            </span>
            <span>Subtarefas</span>
            <span className="rounded-[8px] border border-line px-[9px] py-px text-[13px] font-extrabold text-ink">
              {feitas}/{total}
            </span>
            <span
              aria-hidden="true"
              className={`ml-auto text-lg leading-none transition-transform duration-150 ${aberto ? '[transform:rotate(180deg)_translateY(-3px)]' : '[transform:translateY(-3px)]'}`}
            >
              ⌄
            </span>
          </button>
          <div className="mx-3.5 mb-2.5 h-1 overflow-hidden rounded-full bg-line/70">
            <i className="block h-full rounded-full bg-sapo" style={{ width: `${(feitas / total) * 100}%` }} />
          </div>
          {aberto ? (
            <div className="flex flex-col gap-0.5 px-2.5 pb-3">
              {subtarefas.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-1 py-1.5 text-sm hover:bg-line/40">
                  <input type="checkbox" checked={s.done} onChange={(e) => acoes.marcarSubtarefa(s, e.target.checked)} className="size-4 flex-none accent-sapo" />
                  <span className={s.done ? 'text-muted line-through' : undefined}>{s.title}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => acoes.novaSubtarefa(tarefa)}
                className="cursor-pointer self-start px-1 py-1.5 text-[13px] font-extrabold text-muted hover:text-ink"
              >
                + subtarefa
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
