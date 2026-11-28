import { Link } from '@tanstack/react-router';

import { CARTAO, TITULO } from './estilos';
import type { TarefaDeHoje } from './logic';

type TarefasDeHojeProps = { tarefas: TarefaDeHoje[]; onAlternar: (tarefa: TarefaDeHoje) => void };

/** As tarefas com prazo hoje, com o quadradinho de concluir e o atalho para o quadro. */
export function TarefasDeHoje({ tarefas, onAlternar }: TarefasDeHojeProps) {
  return (
    <section aria-label="Tarefas de hoje" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={TITULO}>Tarefas de hoje</h2>
        <Link to="/tarefas" className="text-[13px] font-extrabold text-sapo-borda">
          Ver quadro
        </Link>
      </div>
      <div className={`${CARTAO} flex flex-col px-5 py-1.5`}>
        {/* Vazio mostra o caminho, não o aviso: ícone, uma frase e o botão de criar, como no cartão de Metas. */}
        {tarefas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span aria-hidden="true" className="mb-1 grid size-14 place-items-center rounded-full bg-sapo/22 text-[28px]">
              📝
            </span>
            <h3 className="text-base font-extrabold">Planeje algo para hoje</h3>
            <p className="text-sm text-muted">Uma tarefa com prazo para hoje aparece aqui, pronta para marcar.</p>
            <Link
              to="/tarefas"
              className="mt-2 rounded-md bg-sapo px-5 py-2.5 font-extrabold text-ink-sobre-acao shadow-[inset_0_-4px_0_var(--pulo-sapo-borda)] active:translate-y-[3px]"
            >
              Criar tarefa
            </Link>
          </div>
        ) : null}
        {tarefas.map((t) => (
          <div key={t.id} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3.5 border-b border-line py-3 last:border-b-0">
            <button
              type="button"
              role="checkbox"
              aria-checked={t.feita}
              aria-label={`Concluir ${t.titulo}`}
              onClick={() => onAlternar(t)}
              className="-m-2.5 grid size-11 cursor-pointer place-items-center"
            >
              <span
                aria-hidden="true"
                className={`grid size-6 place-items-center rounded-[8px] border-[2.5px] text-[13px] font-black text-ink-sobre-acao ${t.feita ? 'border-sapo-borda bg-sapo' : 'border-line'}`}
              >
                {t.feita ? '✓' : null}
              </span>
            </button>
            <b className={t.feita ? 'text-muted line-through' : undefined}>{t.titulo}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
