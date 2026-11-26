import { useState } from 'react';

import type { HabitInput } from '@pulo/core/domain/habits';
import type { Habit } from '@pulo/core/domain/types';

import { CARTAO, LEGENDA } from '../hoje/estilos';
import { horaCheia } from '../hoje/logic';
import { Dias } from './Dias';
import { alternarDia, lerCampoDeHora, paraCampoDeHora } from './logic';
import { Periodo } from './Periodo';

const LINHA = 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dashed border-line py-3.5 last:border-b-0';

type AgendaProps = { habito: Habit; onMudar: (mudanca: Partial<HabitInput>) => void };

/** O horário e a chave do lembrete. Só a preferência: o aviso ainda não é enviado. */
function Lembrete({ habito, onMudar }: AgendaProps) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const horario = habito.reminderMinutes;
  const ligado = !!habito.reminderOn && horario !== undefined;
  const editar = () => {
    setTexto(horario === undefined ? '' : paraCampoDeHora(horario));
    setEditando(true);
  };
  const gravar = () => {
    setEditando(false);
    const minutos = lerCampoDeHora(texto);
    if (minutos === null || minutos === horario) return;
    // O primeiro horário já liga o lembrete.
    onMudar(horario === undefined ? { reminderMinutes: minutos, reminderOn: true } : { reminderMinutes: minutos });
  };
  return (
    <span className="flex items-center gap-3">
      {editando ? (
        <input
          type="time"
          autoFocus
          aria-label="Horário do lembrete"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={gravar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') gravar();
            if (e.key === 'Escape') setEditando(false);
          }}
          className="min-h-9 rounded-sm border-[1.5px] border-line bg-surface px-2 text-sm"
        />
      ) : horario !== undefined ? (
        <button type="button" onClick={editar} aria-label={`Mudar o horário do lembrete, ${horaCheia(horario)}`} className={`${LEGENDA} min-h-9 cursor-pointer`}>
          {horaCheia(horario)}
        </button>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label="Lembrete"
        onClick={() => (horario === undefined ? editar() : onMudar({ reminderOn: !ligado }))}
        className={`relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full transition-colors ${ligado ? 'bg-sapo' : 'bg-line'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[3px] size-5 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[left] ${ligado ? 'left-[23px]' : 'left-[3px]'}`}
        />
      </button>
    </span>
  );
}

/** Dias, período e lembrete (`.agenda`). */
export function Agenda({ habito, onMudar }: AgendaProps) {
  return (
    <div className={`${CARTAO} flex flex-col px-5 py-1.5`}>
      <div className={LINHA}>
        <b>Dias</b>
        <Dias dias={habito.weekdays} onAlternar={(dia) => onMudar({ weekdays: alternarDia(habito.weekdays, dia) })} />
      </div>
      <div className={LINHA}>
        <b>Período</b>
        <Periodo periodo={habito.period} onEscolher={(period) => onMudar({ period: period ?? null })} />
      </div>
      <div className={LINHA}>
        <b>Lembrete</b>
        <Lembrete habito={habito} onMudar={onMudar} />
      </div>
    </div>
  );
}
