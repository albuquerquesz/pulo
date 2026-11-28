import { useRef, useState } from 'react';

import type { HabitInput } from '@pulo/core/domain/habits';
import type { Habit, Weekday } from '@pulo/core/domain/types';
import { EmBreve } from '@/ui';

import { CARTAO, LEGENDA } from '../hoje/estilos';
import { horaCheia } from '../hoje/logic';
import { Dias } from './Dias';
import { alternarDia } from './logic';
import { Periodo } from './Periodo';

const LINHA = 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dashed border-line py-3.5 last:border-b-0';

type AgendaProps = { habito: Habit; onMudar: (mudanca: Partial<HabitInput>) => Promise<unknown> };

/** O horário e a chave do lembrete, desligados enquanto o aviso não é enviado. O que já estava gravado continua à vista. */
function Lembrete({ habito }: { habito: Habit }) {
  const horario = habito.reminderMinutes;
  const ligado = !!habito.reminderOn && horario !== undefined;
  return (
    <span className="flex items-center gap-3">
      <EmBreve />
      {horario !== undefined ? <span className={LEGENDA}>{horaCheia(horario)}</span> : null}
      <button
        type="button"
        role="switch"
        disabled
        aria-checked={ligado}
        aria-label="Lembrete"
        className={`relative h-[26px] w-[46px] shrink-0 cursor-not-allowed rounded-full opacity-50 ${ligado ? 'bg-sapo' : 'bg-line'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[3px] size-5 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.25)] ${ligado ? 'left-[23px]' : 'left-[3px]'}`}
        />
      </button>
    </span>
  );
}

/** Dias, período e lembrete (`.agenda`). */
export function Agenda({ habito, onMudar }: AgendaProps) {
  /** Os dias já tocados e ainda não gravados: o toque seguinte parte deles. */
  const [escolhidos, setEscolhidos] = useState<Weekday[] | null>(null);
  const ultima = useRef(0);
  const dias = escolhidos ?? habito.weekdays;
  const alternar = async (dia: Weekday) => {
    const novos = alternarDia(dias, dia);
    const minha = ++ultima.current;
    setEscolhidos(novos);
    await onMudar({ weekdays: novos });
    if (ultima.current === minha) setEscolhidos(null);
  };
  return (
    <div className={`${CARTAO} flex flex-col px-5 py-1.5`}>
      <div className={LINHA}>
        <b>Dias</b>
        <Dias dias={dias} onAlternar={(dia) => void alternar(dia)} />
      </div>
      <div className={LINHA}>
        <b>Período</b>
        <Periodo periodo={habito.period} onEscolher={(period) => void onMudar({ period: period ?? null })} />
      </div>
      <div className={LINHA}>
        <b>Lembrete</b>
        <Lembrete habito={habito} />
      </div>
    </div>
  );
}
