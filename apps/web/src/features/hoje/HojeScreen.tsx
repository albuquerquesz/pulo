import { useEffect, useState } from 'react';

import { MINUTE_MS } from '@pulo/core/domain/clock';
import { criarPlanoInicial } from '@pulo/core/domain/routine';
import { useConsultaDeMidia } from '@/theme';
import { Botao } from '@/ui';

import { Tela, useApp, useCarregar, ErroDeCarga } from '../app';
import { MENSAGENS_DE_ERRO } from '../casca/erros';
import { contaNaTela } from '../casca/logic';
import { EstaSemana } from './EstaSemana';
import { HabitosDeHoje } from './HabitosDeHoje';
import { LinhaDoDia } from './LinhaDoDia';
import { alternarDescanso, alternarHabito, alternarTarefa, barraDaSemana, carregarHoje, comDescansoDeHoje, momentoDaSequencia } from './logic';
import { Sequencia } from './Sequencia';
import { SeuMes } from './SeuMes';
import { TarefasDeHoje } from './TarefasDeHoje';
import { Topo } from './Topo';

/** A partir daqui Seu mês fica logo abaixo de Esta semana; no celular, depois dos hábitos. */
const CONSULTA_DA_COLUNA_LARGA = '(min-width: 48rem)';


export function HojeScreen() {
  const { repo, clock, user, pessoa, refresh, mostrarAviso } = useApp();
  const largo = useConsultaDeMidia(CONSULTA_DA_COLUNA_LARGA);
  /** O descanso que acabou de ser pedido, mostrado antes da resposta. */
  const [descansoPedido, setDescansoPedido] = useState<boolean | null>(null);
  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    return carregarHoje(repo, clock, user, contaNaTela(pessoa, user).nome);
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
      <Tela>
        <ErroDeCarga falha={estado.falha} guardado="Seus dados estão salvos." onTentar={() => void recarregar()} />
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

  const pedido = descansoPedido;
  const semana = pedido === null ? d.semana : comDescansoDeHoje(d.semana, pedido);
  const descanso =
    pedido === null
      ? d.descanso
      : { ...d.descanso, marcado: pedido, restantesNaSemana: d.descanso.restantesNaSemana + Number(d.descanso.marcado) - Number(pedido) };
  const mudarDescanso = async () => {
    // Sem vaga na semana não há o que adiantar: só a resposta da regra.
    if (d.descanso.marcado || d.descanso.restantesNaSemana > 0) setDescansoPedido(!d.descanso.marcado);
    try {
      const resultado = await alternarDescanso(repo, clock, d.descanso);
      if (!resultado.ok) mostrarAviso({ mensagem: MENSAGENS_DE_ERRO[resultado.error.code], variante: 'atencao' });
    } catch {
      // O repositório da conta já avisou o que houve e voltou ao que era.
    } finally {
      await recarregar();
      setDescansoPedido(null);
      refresh();
    }
  };

  return (
    <Tela>
      <Topo saudacao={d.saudacao} foco={d.foco} />
      <Sequencia
        momento={momentoDaSequencia({ dias: d.diasSeguidos, recorde: d.recorde, semana, minutos: d.minutosAgora })}
        dias={d.diasSeguidos}
        barra={barraDaSemana(semana)}
        descanso={descanso}
        gravando={pedido !== null}
        onDescanso={() => void mudarDescanso()}
      />
      <EstaSemana grafico={d.grafico} />
      {largo ? <SeuMes /> : null}
      <HabitosDeHoje habitos={d.habitos} onAlternar={(h) => void gravar(alternarHabito(repo, clock, user, h.id, h.feito))} />
      {largo ? null : <SeuMes />}
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
