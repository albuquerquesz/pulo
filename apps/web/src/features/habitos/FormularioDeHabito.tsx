import { useState } from 'react';

import { HABITS } from '@pulo/core/config/decisions';
import type { HabitInput } from '@pulo/core/domain/habits';
import type { AccentColor, Habit, Weekday } from '@pulo/core/domain/types';
import { Botao, CAMPO_DO_MODAL, Modal, SeletorDeCor } from '@/ui';

import { Dias } from './Dias';
import { alternarDia, SEMANA_DA_TELA } from './logic';
import { Periodo } from './Periodo';

type FormularioDeHabitoProps = {
  /** Sem ele, é um hábito novo. */
  habito?: Habit;
  /** Devolve `false` quando não gravou; o formulário fica aberto. */
  onSalvar: (dados: HabitInput) => Promise<boolean>;
  onFechar: () => void;
};

/** Criar e editar: nome, ícone, cor, dias e período. */
export function FormularioDeHabito({ habito, onSalvar, onFechar }: FormularioDeHabitoProps) {
  const [titulo, setTitulo] = useState(habito?.title ?? '');
  const [icone, setIcone] = useState(habito?.icon ?? HABITS.defaultIcon);
  const [cor, setCor] = useState<AccentColor>(habito?.color ?? HABITS.defaultColor);
  const [dias, setDias] = useState<Weekday[]>(habito?.weekdays ?? [...SEMANA_DA_TELA]);
  const [periodo, setPeriodo] = useState(habito?.period);
  const [salvando, setSalvando] = useState(false);
  const nome = habito ? 'Editar hábito' : 'Novo hábito';

  const salvar = async () => {
    setSalvando(true);
    const gravou = await onSalvar({ title: titulo, weekdays: dias, icon: icone.trim() || null, color: cor, period: periodo ?? null });
    if (!gravou) setSalvando(false);
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      rotulo={nome}
      rodape={<Botao titulo="Cancelar" variante="foco" largura="auto" onPress={onFechar} />}
    >
      <form
        className="@container flex w-full flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <h2 className="text-center text-2xl font-black">{nome}</h2>
        <label className="flex flex-col gap-1 font-extrabold">
          Nome
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={CAMPO_DO_MODAL} />
        </label>
        <label className="flex flex-col gap-1 font-extrabold">
          Ícone
          <input value={icone} maxLength={HABITS.iconMaxChars} onChange={(e) => setIcone(e.target.value)} className={CAMPO_DO_MODAL} />
        </label>
        <SeletorDeCor cor={cor} onEscolher={setCor} />
        <Dias dias={dias} onAlternar={(dia) => setDias(alternarDia(dias, dia))} />
        <Periodo periodo={periodo} onEscolher={(p) => setPeriodo(p === periodo ? undefined : p)} />
        <Botao titulo="Salvar" tipo="submit" carregando={salvando} />
      </form>
    </Modal>
  );
}
