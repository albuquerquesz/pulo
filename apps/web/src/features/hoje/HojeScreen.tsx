import { useEffect } from 'react';

import { MINUTE_MS } from '@pulo/core/domain/clock';
import { criarPlanoInicial } from '@pulo/core/domain/routine';
import { Botao, EstadoVazio } from '@/ui';

import { Tela, useApp, useCarregar } from '../app';
import { contaNaTela } from '../casca/logic';
import { EstaSemana } from './EstaSemana';
import { HabitosDeHoje } from './HabitosDeHoje';
import { LinhaDoDia } from './LinhaDoDia';
import { alternarHabito, alternarTarefa, carregarHoje } from './logic';
import { Sequencia } from './Sequencia';
import { TarefasDeHoje } from './TarefasDeHoje';
import { Topo } from './Topo';

export const TEXTO_DE_ERRO = 'A lagoa ficou sem sinal. Seus dados estão salvos aqui.';

export function HojeScreen() {
  const { repo, clock, user, conta, refresh } = useApp();
  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    return carregarHoje(repo, clock, user, contaNaTela(conta, user).nome);
  });

  // A saudação e o ponto da hora atual andam com o relógio.
  useEffect(() => {
    const id = setInterval(() => void recarregar(), MINUTE_MS);
    return () => clearInterval(id);
  }, [recarregar]);

  if (!user) return null;

  if (estado.tipo === 'carregando') {
    return (
      <Tela>
        <div aria-label="Carregando o dia" role="progressbar" className="flex flex-col gap-6">
          <div className="h-[200px] rounded-md bg-line opacity-60" />
          <div className="h-40 rounded-md bg-line opacity-60" />
          <div className="h-48 rounded-md bg-line opacity-60" />
        </div>
      </Tela>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <Tela titulo="Hoje">
        <EstadoVazio titulo="Sem sinal por aqui" texto={TEXTO_DE_ERRO} acao="Tentar de novo" onAcao={() => void recarregar()} />
      </Tela>
    );
  }

  const d = estado.dados;
  /** Grava e recarrega tudo (tela e trilho). Se o servidor recusar, a recarga devolve o que vale. */
  const gravar = async (acao: Promise<unknown>) => {
    try {
      await acao;
    } catch {
      // O repositório da conta já avisou o que houve e voltou ao que era.
    } finally {
      refresh();
    }
  };

  return (
    <Tela>
      <Topo saudacao={d.saudacao} foco={d.foco} />
      <Sequencia dias={d.diasSeguidos} barra={d.barra} />
      <EstaSemana grafico={d.grafico} />
      <HabitosDeHoje habitos={d.habitos} onAlternar={(h) => void gravar(alternarHabito(repo, clock, user, h.id, h.feito))} />
      <TarefasDeHoje tarefas={d.tarefas} onAlternar={(t) => void gravar(alternarTarefa(repo, clock, t.id, t.feita))} />
      {d.temRotina ? (
        <LinhaDoDia itens={d.linha} minutos={d.minutosAgora} />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted">Sua rotina ainda está vazia.</p>
          <Botao titulo="Criar plano de exemplo" largura="auto" onPress={() => void gravar(criarPlanoInicial(repo, clock.now()))} />
        </div>
      )}
    </Tela>
  );
}
