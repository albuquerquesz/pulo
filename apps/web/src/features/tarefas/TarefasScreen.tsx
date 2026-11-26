import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { DEFAULT_TIMEZONE, TASKS } from '@pulo/core/config/decisions';
import { dateKeyOf } from '@pulo/core/domain/day';
import { newId } from '@pulo/core/domain/ids';
import { criarTarefa, moverTarefa, verPomodoros } from '@pulo/core/domain/tasks';
import type { Task, TaskStatus, TaskSubtask } from '@pulo/core/domain/types';

import { confirmar, useApp, useCarregar, ErroDeCarga } from '../app';
import { contaNaTela } from '../casca/logic';
import { Atividade } from './Atividade';
import { CartaoDaTarefa, type AcoesDoCartao } from './CartaoDaTarefa';
import { ColunaDoQuadro } from './ColunaDoQuadro';
import { Descricao } from './Descricao';
import { BOTAO_DA_GAVETA, Gaveta } from './Gaveta';
import {
  alterarSubtarefa,
  alterarTarefa,
  FILTROS,
  montarQuadro,
  novaSubtarefa,
  posicaoAoSoltar,
  subtarefasDa,
  vizinhoDoPasso,
  type Filtro,
} from './logic';
import { Propriedades } from './Propriedades';
import { Subtarefas } from './Subtarefas';
import { TextoEditavel } from './TextoEditavel';

/** O quadro de tarefas com a gaveta de detalhe. */
export function TarefasScreen() {
  const { repo, clock, user, conta, mostrarAviso } = useApp();
  const navegar = useNavigate();
  const { estado, recarregar } = useCarregar(async () => {
    const [tarefas, subtarefas, metas] = await Promise.all([repo.listTasks(), repo.listSubtasks(), repo.listGoals()]);
    return { tarefas, subtarefas, metas };
  });
  // À parte: o remoto só conta depois das escritas pendentes, e o quadro não pode esperar por isso.
  const { estado: contagem } = useCarregar(() => verPomodoros(repo));

  const [filtro, setFiltro] = useState<Filtro>('todas');
  /** Cartões com as subtarefas abertas ou fechadas à mão; os outros seguem o padrão. */
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [arrastada, setArrastada] = useState<string | null>(null);
  const [gaveta, setGaveta] = useState<{ id: string; aberta: boolean } | null>(null);
  const [revisao, setRevisao] = useState(0);

  const dados = estado.tipo === 'ok' ? estado.dados : null;
  const fuso = user?.timezone || DEFAULT_TIMEZONE;
  const agora = clock.now();
  const hoje = dateKeyOf(agora, fuso);
  const pomodoros = contagem.tipo === 'ok' ? contagem.dados : {};
  const quadro = montarQuadro(dados?.tarefas ?? [], filtro, hoje);
  const primeiraEmAndamento = quadro.find((c) => c.status === 'fazendo')?.tarefas[0]?.id;

  /** Mostra a escrita otimista na hora e relê quando ela termina (ou volta atrás, se o servidor recusar). */
  const gravar = async (escrita: () => Promise<unknown>): Promise<boolean> => {
    const pendente = escrita();
    const otimista = setTimeout(() => void recarregar());
    try {
      await pendente;
      return true;
    } catch {
      // O repositório remoto já avisou o que houve e voltou ao que era.
      return false;
    } finally {
      clearTimeout(otimista);
      await recarregar();
      setRevisao((n) => n + 1);
    }
  };

  const criar = (status: TaskStatus, title: string) => {
    void gravar(async () => {
      const resultado = await criarTarefa(repo, { title, status }, clock.now());
      if (!resultado.ok) mostrarAviso({ mensagem: resultado.error.message, variante: 'atencao' });
    });
  };

  const mover = (id: string, status: TaskStatus, antesDe?: string) => {
    const position = posicaoAoSoltar(dados?.tarefas ?? [], status, id, antesDe);
    void gravar(() => moverTarefa(repo, id, status, clock.now(), position));
  };

  const adicionarSubtarefa = (taskId: string, titulo: string) => {
    setAbertos((a) => ({ ...a, [taskId]: true }));
    void gravar(async () => {
      const existentes = subtarefasDa(await repo.listSubtasks(), taskId);
      if (existentes.length >= TASKS.maxSubtasks) return;
      await repo.saveSubtask(novaSubtarefa(existentes, taskId, titulo, clock.now()));
    });
  };
  const marcarSubtarefa = (s: TaskSubtask, done: boolean) => void gravar(() => alterarSubtarefa(repo, s.id, { done }));
  const estaAberto = (id: string) => abertos[id] ?? id === primeiraEmAndamento;

  const acoes: AcoesDoCartao = {
    abrir: (id) => setGaveta({ id, aberta: true }),
    alternarSubtarefas: (id) => setAbertos((a) => ({ ...a, [id]: !estaAberto(id) })),
    marcarSubtarefa,
    novaSubtarefa: (tarefa, titulo) => adicionarSubtarefa(tarefa.id, titulo),
    mover: (tarefa, status) => mover(tarefa.id, status),
    passo: (tarefa, passo) => {
      const visiveis = quadro.find((c) => c.status === tarefa.status)?.tarefas ?? [];
      const destino = vizinhoDoPasso(visiveis, tarefa.id, passo);
      if (destino) mover(tarefa.id, tarefa.status, destino.antesDe);
    },
    arrastar: setArrastada,
  };

  const soltar = (status: TaskStatus, antesDe: string | undefined) => {
    setArrastada(null);
    // Soltar o cartão sobre ele mesmo não muda nada.
    if (arrastada && arrastada !== antesDe) mover(arrastada, status, antesDe);
  };

  const fechar = () => {
    // Sai do campo em edição para ele gravar antes de a gaveta fechar.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setGaveta((g) => (g ? { ...g, aberta: false } : g));
  };
  const detalhe = dados?.tarefas.find((t) => t.id === gaveta?.id) ?? null;
  const nome = contaNaTela(conta, user).nome.split(' ')[0] ?? '';

  const excluir = (tarefa: Task) => {
    void confirmar('Excluir esta tarefa?', `"${tarefa.title}" e as subtarefas dela somem. Não dá para desfazer.`).then((ok) => {
      if (!ok) return;
      fechar();
      void gravar(() => repo.deleteTask(tarefa.id));
    });
  };
  const comentar = (taskId: string, body: string) =>
    gravar(() => {
      const createdAt = clock.now();
      return repo.addTaskComment({ id: newId(createdAt, 'comentario'), taskId, body, createdAt });
    });

  return (
    <main className="flex w-full flex-col gap-5 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 md:px-10 md:pt-8 md:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[32px] leading-[1.1] font-extrabold">Tarefas</h1>
        <div role="group" aria-label="Filtrar por prazo" className="inline-flex rounded-[12px] bg-line/55 p-[3px]">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              type="button"
              aria-pressed={filtro === f.chave}
              onClick={() => setFiltro(f.chave)}
              className={`cursor-pointer rounded-[9px] px-3 py-[5px] text-[13px] ${filtro === f.chave ? 'bg-surface font-extrabold shadow-[0_1px_3px_rgba(0,0,0,0.15)]' : ''}`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      {estado.tipo === 'erro' ? <ErroDeCarga falha={estado.falha} guardado="Suas tarefas estão salvas." onTentar={() => void recarregar()} /> : null}

      {dados ? (
        <div className="grid grid-cols-1 items-stretch gap-4 pb-2 md:min-h-[calc(100dvh-140px)] md:grid-cols-[repeat(4,minmax(240px,1fr))] md:overflow-x-auto">
          {quadro.map((coluna) => (
            <ColunaDoQuadro key={coluna.status} coluna={coluna} onNova={(titulo) => criar(coluna.status, titulo)} onSoltar={(antesDe) => soltar(coluna.status, antesDe)}>
              {coluna.tarefas.map((tarefa) => (
                <CartaoDaTarefa
                  key={tarefa.id}
                  tarefa={tarefa}
                  subtarefas={subtarefasDa(dados.subtarefas, tarefa.id)}
                  pomodoros={pomodoros[tarefa.id] ?? 0}
                  hoje={hoje}
                  aberto={estaAberto(tarefa.id)}
                  arrastando={arrastada === tarefa.id}
                  acoes={acoes}
                />
              ))}
            </ColunaDoQuadro>
          ))}
        </div>
      ) : null}

      <Gaveta
        aberta={gaveta?.aberta === true && detalhe !== null}
        onFechar={fechar}
        acoes={
          detalhe ? (
            <>
              {detalhe.status === 'feito' ? null : (
                <button
                  type="button"
                  aria-label="Focar nessa tarefa"
                  title="Focar nessa tarefa"
                  onClick={() => {
                    fechar();
                    void navegar({ to: '/casa', search: { tarefa: detalhe.id } });
                  }}
                  className={BOTAO_DA_GAVETA}
                >
                  ▶
                </button>
              )}
              <button type="button" aria-label="Excluir" title="Excluir" onClick={() => excluir(detalhe)} className={BOTAO_DA_GAVETA}>
                🗑
              </button>
            </>
          ) : null
        }
      >
        {detalhe && dados ? (
          // A chave troca os campos junto com a tarefa.
          <div key={detalhe.id} className="contents">
            <div className="flex min-w-0 flex-col gap-[18px] border-line px-5 pt-6 pb-8 md:border-r md:px-11 md:pt-9 md:pb-10">
              <TextoEditavel
                valor={detalhe.title}
                rotulo="Título da tarefa"
                maximo={TASKS.titleMaxChars}
                onGravar={(title) => void gravar(() => alterarTarefa(repo, detalhe.id, { title }))}
                className="text-[28px] leading-[1.2] font-extrabold"
              />
              <Descricao
                valor={detalhe.description ?? ''}
                onGravar={(description) => void gravar(() => alterarTarefa(repo, detalhe.id, { description }))}
              />
              <Subtarefas
                subtarefas={subtarefasDa(dados.subtarefas, detalhe.id)}
                onMarcar={marcarSubtarefa}
                onRenomear={(s, title) => void gravar(() => alterarSubtarefa(repo, s.id, { title }))}
                onRemover={(s) => void gravar(() => repo.deleteSubtask(s.taskId, s.id))}
                onAdicionar={(titulo) => adicionarSubtarefa(detalhe.id, titulo)}
              />
              <Atividade
                repo={repo}
                tarefaId={detalhe.id}
                revisao={revisao}
                autor={{ nome, agora, fuso }}
                onComentar={(texto) => comentar(detalhe.id, texto)}
              />
            </div>
            <Propriedades
              tarefa={detalhe}
              metas={dados.metas}
              hoje={hoje}
              onMover={(status) => mover(detalhe.id, status)}
              onMudar={(mudanca) => void gravar(() => alterarTarefa(repo, detalhe.id, mudanca))}
            />
          </div>
        ) : null}
      </Gaveta>
    </main>
  );
}
