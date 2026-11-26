import { useId, useState } from 'react';

import { GOALS } from '@pulo/core/config/decisions';
import type { GoalInput } from '@pulo/core/domain/goals';
import type { AccentColor, DateKey, EntityId, Goal } from '@pulo/core/domain/types';
import { Botao, CAMPO_DO_MODAL, Modal, SeletorDeCor } from '@/ui';

import { marcosDoTexto } from './logic';

export const TEXTO_SEM_NOME_DA_META = 'Dê um nome à meta.';

type FormularioDeMetaProps = {
  hoje: DateKey;
  /** Sem ela, é uma meta nova. */
  meta?: Goal;
  /** Devolve `false` quando não gravou; o formulário fica aberto. */
  onSalvar: (dados: GoalInput) => Promise<boolean>;
  onRemoverMarco: (id: EntityId) => void;
  onFechar: () => void;
};

/** Criar e editar: nome, porquê, data, ícone, cor e marcos. */
export function FormularioDeMeta({ hoje, meta, onSalvar, onRemoverMarco, onFechar }: FormularioDeMetaProps) {
  const [titulo, setTitulo] = useState(meta?.title ?? '');
  const [porque, setPorque] = useState(meta?.why ?? '');
  const [prazo, setPrazo] = useState(meta?.targetDate ?? '');
  const [icone, setIcone] = useState<string>(meta?.icon ?? GOALS.defaultIcon);
  const [cor, setCor] = useState<AccentColor>(meta?.color ?? GOALS.defaultColor);
  const [marcos, setMarcos] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [semNome, setSemNome] = useState(false);
  const idDoErro = useId();
  const nome = meta ? 'Editar meta' : 'Nova meta';

  const salvar = async () => {
    if (!titulo.trim()) {
      setSemNome(true);
      return;
    }
    setSalvando(true);
    const gravou = await onSalvar({
      title: titulo,
      why: porque,
      targetDate: prazo || undefined,
      icon: icone,
      color: cor,
      ...(meta ? {} : { milestones: marcosDoTexto(marcos) }),
    });
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
        className="flex w-full flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <h2 className="text-center text-2xl font-black">{nome}</h2>
        <div className="flex flex-col gap-1 font-extrabold">
          <label className="flex flex-col gap-1">
            Qual é a meta?
            <input
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                setSemNome(false);
              }}
              placeholder="Correr uma maratona"
              maxLength={80}
              aria-required="true"
              aria-invalid={semNome}
              aria-describedby={semNome ? idDoErro : undefined}
              className={CAMPO_DO_MODAL}
            />
          </label>
          {semNome ? (
            <p id={idDoErro} role="alert">
              {TEXTO_SEM_NOME_DA_META}
            </p>
          ) : null}
        </div>
        <label className="flex flex-col gap-1 font-extrabold">
          Por que ela importa?
          <input value={porque} onChange={(e) => setPorque(e.target.value)} placeholder="Opcional, em uma frase" maxLength={200} className={CAMPO_DO_MODAL} />
        </label>
        <label className="flex flex-col gap-1 font-extrabold">
          Até quando?
          <input type="date" value={prazo} min={meta?.targetDate && meta.targetDate < hoje ? meta.targetDate : hoje} onChange={(e) => setPrazo(e.target.value)} className={CAMPO_DO_MODAL} />
        </label>
        <label className="flex flex-col gap-1 font-extrabold">
          Ícone
          <input value={icone} maxLength={GOALS.iconMaxChars} onChange={(e) => setIcone(e.target.value)} className={CAMPO_DO_MODAL} />
        </label>
        <SeletorDeCor cor={cor} onEscolher={setCor} />
        {meta ? (
          meta.milestones.length > 0 ? (
            <ul aria-label="Marcos da meta" className="flex flex-col gap-1">
              {meta.milestones.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 break-words">{m.title}</span>
                  <button
                    type="button"
                    aria-label={`Remover o marco ${m.title}`}
                    onClick={() => onRemoverMarco(m.id)}
                    className="size-11 shrink-0 cursor-pointer rounded-full text-xl font-black"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null
        ) : (
          <label className="flex flex-col gap-1 font-extrabold">
            Primeiros marcos, um por linha
            <textarea
              value={marcos}
              onChange={(e) => setMarcos(e.target.value)}
              placeholder={'Correr 5 km\nCorrer 10 km\nMeia maratona'}
              rows={4}
              className={`${CAMPO_DO_MODAL} py-3`}
            />
          </label>
        )}
        <Botao titulo={meta ? 'Salvar' : 'Criar meta'} tipo="submit" carregando={salvando} />
      </form>
    </Modal>
  );
}
