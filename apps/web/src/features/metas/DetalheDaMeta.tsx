import type { ReactNode } from 'react';

import { JOIAS } from '@pulo/core/config/decisions';
import { estadoDoBau, numerosDaMeta, ritmo } from '@pulo/core/domain/goals';
import type { EntityId, Goal } from '@pulo/core/domain/types';
import { FUNDO_DA_COR, Joia } from '@/ui';

import { metaNaTela } from '../casca/logic';
import { BOTAO_FANTASMA } from '../habitos/estilos';
import { CARTAO } from '../hoje/estilos';
import { ICONE } from './estilos';
import { HabitosDaMeta } from './HabitosDaMeta';
import { posicaoDoRitmo, seloDoRitmo, textoDaData, textoDosDias, type DadosMetas, type Selo } from './logic';
import { Marcos } from './Marcos';
import { ProgressoDaMeta } from './ProgressoDaMeta';

const ETIQUETA = 'inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line px-3 py-[5px] text-[13px] font-extrabold';
const TOM: Record<Selo['tom'], string> = { bom: 'bg-sapo/30', atras: 'bg-sol/40' };
const BOTAO = `${BOTAO_FANTASMA} px-4 py-2 text-sm`;
const BOTAO_CHEIO =
  'min-h-11 cursor-pointer rounded-md bg-sapo px-[22px] py-3 font-extrabold text-ink-sobre-acao shadow-[inset_0_-4px_0_var(--pulo-sapo-borda)] active:translate-y-[3px]';

function Numero({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">{rotulo}</dt>
      <dd className="text-[22px] font-extrabold tabular-nums">{children}</dd>
    </div>
  );
}

export interface AcoesDaMeta {
  alternarMarco: (id: EntityId) => void;
  adicionarMarco: (titulo: string) => Promise<boolean>;
  atrelar: (habitoId: EntityId) => void;
  criarHabito: () => void;
  abrirBau: () => void;
  concluir: () => void;
  reabrir: () => void;
  editar: () => void;
  apagar: () => void;
}

type DetalheDaMetaProps = { meta: Goal; dados: DadosMetas; timeZone: string; acoes: AcoesDaMeta };

/** O detalhe à direita: cabeçalho, progresso, marcos, hábitos atrelados e rodapé. */
export function DetalheDaMeta({ meta, dados, timeZone, acoes }: DetalheDaMetaProps) {
  const naTela = metaNaTela(meta, dados.baus);
  const pace = ritmo(meta, dados.hoje, timeZone);
  const selo = seloDoRitmo(pace.estado);
  const numeros = numerosDaMeta(meta, { habits: dados.habitos, habitLogs: dados.registros, sessions: dados.sessoes }, dados.hoje);
  const bau = dados.baus.find((b) => b.goalId === meta.id);
  const pronto = estadoDoBau(meta, dados.baus) === 'fechado';
  const joias = bau?.joias ?? JOIAS.por.goalCompleted;
  const todosFeitos = meta.milestones.length > 0 && meta.milestones.every((m) => m.doneAt !== undefined);

  return (
    <div className="flex flex-col gap-5">
      <div className={`${CARTAO} flex items-start gap-[18px] p-5 @min-[26rem]:p-6`}>
        <span aria-hidden="true" className={`${ICONE} size-16 rounded-[18px] text-[32px] ${FUNDO_DA_COR[naTela.cor]}`}>
          {naTela.icone}
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl leading-[1.15] font-extrabold break-words">{meta.title}</h2>
          {meta.why ? <p className="mt-2 text-muted italic">“{meta.why}”</p> : null}
          <div className="mt-3.5 flex flex-wrap justify-center gap-2">
            <span className={`${ETIQUETA} bg-line/70`}>📅 {textoDaData(meta, dados.hoje, timeZone)}</span>
            {selo ? <span className={`${ETIQUETA} ${TOM[selo.tom]}`}>{selo.texto}</span> : null}
            <span className={`${ETIQUETA} bg-line/70`}>
              <span className="inline-flex items-center gap-1">
                <Joia />+{joias}
              </span>
              no baú
            </span>
          </div>
        </div>
      </div>

      <div className={`${CARTAO} flex flex-col gap-3 p-5 @min-[26rem]:p-6`}>
        <ProgressoDaMeta meta={naTela} grande marca={posicaoDoRitmo(pace)} bau="-my-[18px] -mr-1 size-16" onAbrirBau={acoes.abrirBau} />
        <dl className="mt-1 grid grid-cols-3 gap-3">
          <Numero rotulo="Foco na meta">{numeros.minutosDeFoco} min</Numero>
          <Numero rotulo="Hábitos feitos">{numeros.habitosFeitos}</Numero>
          <Numero rotulo="Dias restantes">{textoDosDias(meta, numeros.diasRestantes)}</Numero>
        </dl>
        {pronto ? (
          <button type="button" onClick={acoes.abrirBau} className={BOTAO_CHEIO}>
            Abrir o baú e ganhar {joias} joias
          </button>
        ) : null}
      </div>

      <Marcos meta={meta} timeZone={timeZone} onAlternar={acoes.alternarMarco} onAdicionar={acoes.adicionarMarco} />

      <HabitosDaMeta
        meta={meta}
        atrelados={numeros.habitos}
        habitos={dados.habitos}
        registros={dados.registros}
        hoje={dados.hoje}
        onAtrelar={acoes.atrelar}
        onCriar={acoes.criarHabito}
      />

      <div className="flex flex-wrap gap-2.5">
        {meta.state === 'concluida' ? (
          <button type="button" onClick={acoes.reabrir} className={BOTAO}>
            Reabrir meta
          </button>
        ) : (
          <button type="button" onClick={acoes.concluir} className={todosFeitos ? BOTAO_CHEIO : BOTAO}>
            Concluir meta
          </button>
        )}
        <button type="button" onClick={acoes.editar} className={BOTAO}>
          Editar
        </button>
        <button type="button" onClick={acoes.apagar} className={`${BOTAO} text-foco-borda`}>
          Apagar
        </button>
      </div>
    </div>
  );
}
