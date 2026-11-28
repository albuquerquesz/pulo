import { useState, type ReactNode } from 'react';

import { GOALS } from '@pulo/core/config/decisions';
import { TASK_COLUMNS } from '@pulo/core/domain/tasks';
import type { DateKey, Goal, Task, TaskStatus } from '@pulo/core/domain/types';

import { Etiqueta } from './Etiqueta';
import { IconeDaEtiqueta, IconeDaMeta, IconeDaPrioridade, IconeDoPrazo, ICONE_DO_STATUS } from './icones';
import {
  etiquetasLivres,
  NOME_DA_COLUNA,
  OPCOES_DE_POMODOROS,
  prazoDaLista,
  prazoEscolhido,
  rotuloDaMeta,
  type Mudanca,
} from './logic';
import { useTextoAdiado } from './useTextoAdiado';

type LinhaProps = {
  rotulo: string;
  icone: ReactNode;
  valor: string | number;
  vazio?: boolean;
  onEscolher: (valor: string) => void;
  children: ReactNode;
};

/** Uma propriedade: ícone e lista nativa sem moldura (`.dr-prop`). */
function Linha({ rotulo, icone, valor, vazio = false, onEscolher, children }: LinhaProps) {
  return (
    <label className="relative -mx-2 flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 focus-within:bg-line/45 hover:bg-line/45">
      <span className="grid size-4 flex-none place-items-center text-muted">{icone}</span>
      <select
        aria-label={rotulo}
        value={valor}
        onChange={(e) => onEscolher(e.target.value)}
        className={`min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-[15px] outline-none [&>option]:bg-surface [&>option]:text-ink ${vazio ? 'font-semibold text-muted' : 'font-bold'}`}
      >
        {children}
      </select>
    </label>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="mb-1.5 text-sm font-bold text-muted">{titulo}</h3>
      {children}
    </div>
  );
}

/** O campo de data do aparelho, para um prazo que não está na lista. Grava depois de uma pausa: o ano é digitado aos poucos. */
function DataDoPrazo({ prazo, onMudar }: { prazo: DateKey | undefined; onMudar: (prazo: DateKey | undefined) => void }) {
  const [texto, setTexto] = useState(prazo ?? '');
  const [visto, setVisto] = useState(prazo);
  if (prazo !== visto) {
    setVisto(prazo);
    setTexto(prazo ?? '');
  }
  const adiado = useTextoAdiado((valor) => onMudar(valor || undefined));
  return (
    <label className="-mx-2 flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 focus-within:bg-line/45 hover:bg-line/45">
      <span className="grid size-4 flex-none place-items-center text-muted">
        <IconeDoPrazo />
      </span>
      <input
        type="date"
        aria-label="Data do prazo"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          adiado.digitar(e.target.value);
        }}
        onBlur={adiado.agora}
        className={`min-w-0 flex-1 bg-transparent text-[15px] outline-none ${prazo ? 'font-bold' : 'font-semibold text-muted'}`}
      />
    </label>
  );
}

type PropriedadesProps = {
  tarefa: Task;
  metas: readonly Goal[];
  hoje: DateKey;
  onMover: (status: TaskStatus) => void;
  onMudar: (mudanca: Mudanca) => void;
};

export function Propriedades({ tarefa, metas, hoje, onMover, onMudar }: PropriedadesProps) {
  const alta = tarefa.priority === 'alta';
  const prazo = prazoDaLista(tarefa.dueDate, hoje);
  const estimados = tarefa.pomodorosEstimated;
  const pomodoros = OPCOES_DE_POMODOROS.includes(estimados) || !estimados ? OPCOES_DE_POMODOROS : [...OPCOES_DE_POMODOROS, estimados];
  const livres = etiquetasLivres(tarefa.tags, metas, GOALS.defaultIcon);
  const escolhiveis = metas.filter((m) => m.state === 'ativa' || m.id === tarefa.goalId);
  return (
    <div className="flex flex-col gap-7 px-5 py-6 md:py-9">
      <Grupo titulo="Propriedades">
        <Linha
          rotulo="Status"
          icone={ICONE_DO_STATUS[tarefa.status]}
          valor={tarefa.status}
          onEscolher={(valor) => {
            const status = TASK_COLUMNS.find((c) => c === valor);
            if (status) onMover(status);
          }}
        >
          {TASK_COLUMNS.map((c) => (
            <option key={c} value={c}>
              {NOME_DA_COLUNA[c]}
            </option>
          ))}
        </Linha>
        <Linha
          rotulo="Prioridade"
          icone={<IconeDaPrioridade alta={alta} />}
          valor={tarefa.priority}
          vazio={!alta}
          onEscolher={(valor) => onMudar({ priority: valor === 'alta' ? 'alta' : 'normal' })}
        >
          <option value="normal">Sem prioridade</option>
          <option value="alta">Alta</option>
        </Linha>
        <Linha
          rotulo="Prazo"
          icone={<IconeDoPrazo />}
          valor={prazo.valor}
          vazio={!tarefa.dueDate}
          onEscolher={(valor) => onMudar({ dueDate: prazoEscolhido(valor, tarefa.dueDate, hoje) })}
        >
          {prazo.opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Linha>
        <DataDoPrazo prazo={tarefa.dueDate} onMudar={(dueDate) => onMudar({ dueDate })} />
        <Linha
          rotulo="Pomodoros"
          icone={<span className="text-[13px]">🍅</span>}
          valor={estimados}
          vazio={!estimados}
          onEscolher={(valor) => onMudar({ pomodorosEstimated: Number(valor) })}
        >
          <option value={0}>Estimar pomodoros</option>
          {pomodoros.map((n) => (
            <option key={n} value={n}>
              {n} {n > 1 ? 'pomodoros' : 'pomodoro'}
            </option>
          ))}
        </Linha>
      </Grupo>
      <Grupo titulo="Etiquetas">
        {tarefa.tags.length ? (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {tarefa.tags.map((nome) => (
              <Etiqueta key={nome} nome={nome}>
                <button
                  type="button"
                  aria-label={`Remover ${nome}`}
                  onClick={() => onMudar({ tags: tarefa.tags.filter((t) => t !== nome) })}
                  className="cursor-pointer pl-0.5 text-[11px] text-muted"
                >
                  ✕
                </button>
              </Etiqueta>
            ))}
          </div>
        ) : null}
        {livres.length ? (
          <Linha rotulo="Etiquetas" icone={<IconeDaEtiqueta />} valor="" vazio onEscolher={(valor) => valor && onMudar({ tags: [...tarefa.tags, valor] })}>
            <option value="">Adicionar etiqueta</option>
            {livres.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </Linha>
        ) : null}
      </Grupo>
      <Grupo titulo="Meta">
        <Linha
          rotulo="Meta"
          icone={<IconeDaMeta />}
          valor={tarefa.goalId ?? ''}
          vazio={!tarefa.goalId}
          onEscolher={(valor) => onMudar({ goalId: valor || undefined })}
        >
          <option value="">Adicionar a uma meta</option>
          {escolhiveis.map((m) => (
            <option key={m.id} value={m.id}>
              {rotuloDaMeta(m, GOALS.defaultIcon)}
            </option>
          ))}
        </Linha>
      </Grupo>
    </div>
  );
}
