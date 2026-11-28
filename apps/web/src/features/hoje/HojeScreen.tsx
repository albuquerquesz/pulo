import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { MINUTE_MS } from '@pulo/core/domain/clock';
import { criarPlanoInicial } from '@pulo/core/domain/routine';

import { Tela, useApp, useCarregar, ErroDeCarga } from '../app';
import { MENSAGENS_DE_ERRO } from '../casca/erros';
import { contaNaTela } from '../casca/logic';
import { EstaSemana } from './EstaSemana';
import { HabitosDeHoje } from './HabitosDeHoje';
import { LinhaDoDia, LinhaDoDiaVazia } from './LinhaDoDia';
import { alternarDescanso, alternarHabito, alternarTarefa, barraDaSemana, carregarHoje, comDescansoDeHoje, pulosDoDia } from './logic';
import { Sequencia } from './Sequencia';
import { TarefasDeHoje } from './TarefasDeHoje';
import { Topo } from './Topo';
import { BOTAO_DO_VAZIO } from './Vazio';

export function HojeScreen() {
  const { repo, clock, user, pessoa, refresh, mostrarAviso } = useApp();
  /** O descanso que acabou de ser pedido, mostrado antes da resposta. */
  const [descansoPedido, setDescansoPedido] = useState<boolean | null>(null);
  /** Marcas de hábitos e tarefas pedidas e ainda sem resposta, por chave. */
  const [marcas, setMarcas] = useState<ReadonlyMap<string, boolean>>(new Map());
  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    return carregarHoje(repo, clock, user, contaNaTela(pessoa).nome);
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

  /** Mostra a marca na hora: as leituras só respondem depois que o servidor confirma a escrita. */
  const marcar = async (chave: string, feito: boolean, acao: Promise<unknown>) => {
    setMarcas((atual) => new Map(atual).set(chave, feito));
    refresh();
    await gravar(acao);
    await recarregar();
    setMarcas((atual) => {
      const resto = new Map(atual);
      if (resto.get(chave) === feito) resto.delete(chave);
      return resto;
    });
  };
  const habitos = d.habitos.map((h) => ({ ...h, feito: marcas.get(`habito:${h.id}`) ?? h.feito }));
  const tarefas = d.tarefas.map((t) => ({ ...t, feita: marcas.get(`tarefa:${t.id}`) ?? t.feita }));

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
      <Topo saudacao={d.saudacao} periodo={d.periodo} semHabitos={d.semHabitos} foco={d.foco} pulos={pulosDoDia(habitos, tarefas)} />
      <Sequencia
        dias={d.diasSeguidos}
        barra={barraDaSemana(semana)}
        descanso={descanso}
        gravando={pedido !== null}
        onDescanso={() => void mudarDescanso()}
      />
      <EstaSemana grafico={d.grafico} />
      <HabitosDeHoje habitos={habitos} onAlternar={(h) => void marcar(`habito:${h.id}`, !h.feito, alternarHabito(repo, clock, user, h.id, h.feito))} />
      <TarefasDeHoje tarefas={tarefas} onAlternar={(t) => void marcar(`tarefa:${t.id}`, !t.feita, alternarTarefa(repo, clock, t.id, t.feita))} />
      {d.linha.length > 0 ? (
        <LinhaDoDia itens={d.linha} minutos={d.minutosAgora} />
      ) : d.temRotina ? (
        <LinhaDoDiaVazia titulo="Dia livre na rotina" texto="Não há blocos para hoje. Se quiser, dá para focar mesmo assim.">
          <Link to="/casa" search={{}} className={BOTAO_DO_VAZIO}>
            Começar um foco
          </Link>
        </LinhaDoDiaVazia>
      ) : (
        <LinhaDoDiaVazia titulo="Sua rotina ainda está vazia" texto="Um plano de exemplo mostra os blocos do dia por aqui.">
          <button type="button" className={BOTAO_DO_VAZIO} onClick={() => void gravar(criarPlanoInicial(repo, clock.now()))}>
            Criar plano de exemplo
          </button>
        </LinhaDoDiaVazia>
      )}
    </Tela>
  );
}
