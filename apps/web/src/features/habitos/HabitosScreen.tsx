import { useState } from 'react';

import { atrelarHabito, criarHabito, editarHabito, type HabitErrorCode, type HabitInput } from '@pulo/core/domain/habits';
import type { Result } from '@pulo/core/domain/result';
import type { EntityId, Habit } from '@pulo/core/domain/types';
import { Botao, EstadoVazio } from '@/ui';

import { confirmar, Tela, useApp, useCarregar } from '../app';
import { DetalheDoHabito, type AcoesDoHabito } from './DetalheDoHabito';
import { FormularioDeHabito } from './FormularioDeHabito';
import { ListaDeHabitos } from './ListaDeHabitos';
import { agruparPorPeriodo, carregarEstatisticas, carregarHabitos } from './logic';

export const TEXTO_DE_ERRO = 'A lagoa ficou sem sinal. Seus hábitos estão salvos.';

type Formulario = { habito?: Habit } | null;

type HabitosScreenProps = {
  /** O hábito aberto pela pessoa. Sem ele, o celular mostra só a lista e o desktop abre o primeiro. */
  aberto?: EntityId;
  onAbrir: (id: EntityId | null) => void;
  onVerMeta: (goalId: EntityId) => void;
};

/** Hábitos: a lista por período à esquerda e o detalhe à direita. No celular, o detalhe ocupa a tela. */
export function HabitosScreen({ aberto, onAbrir, onVerMeta }: HabitosScreenProps) {
  const { repo, clock, user, mostrarAviso, refresh } = useApp();
  const [formulario, setFormulario] = useState<Formulario>(null);
  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    return carregarHabitos(repo, clock, user);
  });
  // À parte: no remoto as estatísticas vêm do servidor, e a lista não pode esperar por elas.
  const contas = useCarregar(() => carregarEstatisticas(repo, clock));

  if (!user) return null;

  if (estado.tipo === 'carregando') {
    return (
      <Tela titulo="Hábitos">
        <div aria-label="Carregando os hábitos" role="progressbar" className="flex flex-col gap-3">
          <div className="h-20 rounded-md bg-line opacity-60" />
          <div className="h-20 rounded-md bg-line opacity-60" />
        </div>
      </Tela>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <Tela titulo="Hábitos">
        <EstadoVazio titulo="Sem sinal por aqui" texto={TEXTO_DE_ERRO} acao="Tentar de novo" onAcao={() => void recarregar()} />
      </Tela>
    );
  }

  const dados = estado.dados;
  const visiveis = agruparPorPeriodo(dados.habitos).flatMap((g) => g.habitos);
  const escolhido = visiveis.find((h) => h.id === aberto);
  const habito = escolhido ?? visiveis[0];
  const estatisticas = contas.estado.tipo === 'ok' ? contas.estado.dados : null;

  /** Roda um caso de uso: erro esperado vira aviso; erro de rede já é avisado pelo repositório. */
  const tentar = async (acao: () => Promise<Result<Habit, HabitErrorCode>>): Promise<Habit | null> => {
    try {
      const r = await acao();
      if (!r.ok) {
        mostrarAviso({ mensagem: r.error.message, variante: 'atencao' });
        return null;
      }
      return r.value;
    } catch {
      return null;
    } finally {
      refresh();
    }
  };

  const acoesDe = (h: Habit): AcoesDoHabito => ({
    mudar: (mudanca) => void tentar(() => editarHabito(repo, h.id, mudanca)),
    mudarEstado: (state) => void tentar(() => editarHabito(repo, h.id, { state })),
    arquivar: () =>
      void confirmar('Arquivar este hábito?', `"${h.title}" sai das listas. O histórico continua.`).then(async (ok) => {
        if (ok && (await tentar(() => editarHabito(repo, h.id, { state: 'arquivado' })))) onAbrir(null);
      }),
    trocarMeta: (goalId) => void tentar(() => atrelarHabito(repo, h.id, goalId)),
    verMeta: onVerMeta,
    editar: () => setFormulario({ habito: h }),
  });

  const salvar = async (entrada: HabitInput) => {
    const editado = formulario?.habito;
    const salvo = await tentar(() => (editado ? editarHabito(repo, editado.id, entrada) : criarHabito(repo, entrada, clock.now())));
    if (!salvo) return false;
    setFormulario(null);
    onAbrir(salvo.id);
    return true;
  };

  return (
    <Tela>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl leading-[1.1] font-extrabold md:text-[32px]">Hábitos</h1>
        <Botao titulo="+ Novo hábito" largura="auto" onPress={() => setFormulario({})} />
      </div>
      {!habito ? (
        <EstadoVazio titulo="Nenhum hábito ainda" texto="Comece por um pequeno, que caiba em qualquer dia." />
      ) : (
        <div className="@container/pagina">
          <div className="grid grid-cols-1 items-start gap-6 @min-[36rem]/pagina:grid-cols-[minmax(240px,380px)_minmax(300px,1fr)]">
            <div className={escolhido ? 'hidden @min-[36rem]/pagina:block' : ''}>
              <ListaDeHabitos dados={dados} estatisticas={estatisticas} selecionado={habito.id} onSelecionar={onAbrir} />
            </div>
            <section
              aria-label="Detalhe do hábito"
              className={`@container min-w-0 flex-col gap-3 ${escolhido ? 'flex' : 'hidden @min-[36rem]/pagina:flex'}`}
            >
              <button
                type="button"
                onClick={() => onAbrir(null)}
                className="min-h-11 cursor-pointer self-start font-extrabold text-sapo-borda @min-[36rem]/pagina:hidden"
              >
                ‹ Todos os hábitos
              </button>
              {contas.estado.tipo === 'erro' ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 text-muted">
                  Não consegui carregar os números dos hábitos.
                  <Botao titulo="Tentar de novo" variante="fantasma" largura="auto" onPress={() => void contas.recarregar()} />
                </div>
              ) : null}
              <DetalheDoHabito
                // Trocar de hábito fecha a lista de metas e o campo de hora.
                key={habito.id}
                habito={habito}
                stats={estatisticas?.get(habito.id) ?? null}
                metas={dados.metas}
                baus={dados.baus}
                acoes={acoesDe(habito)}
              />
            </section>
          </div>
        </div>
      )}
      {formulario ? <FormularioDeHabito habito={formulario.habito} onSalvar={salvar} onFechar={() => setFormulario(null)} /> : null}
    </Tela>
  );
}
