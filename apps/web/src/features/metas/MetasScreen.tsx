import { useState } from 'react';

import { GOALS } from '@pulo/core/config/decisions';
import {
  abrirBau,
  adicionarMarco,
  alternarMarco,
  apagarMeta,
  concluirMeta,
  criarMeta,
  editarMeta,
  reabrirMeta,
  removerMarco,
  type GoalInput,
} from '@pulo/core/domain/goals';
import { atrelarHabito, criarHabito, type HabitInput } from '@pulo/core/domain/habits';
import type { Result } from '@pulo/core/domain/result';
import type { EntityId, Goal } from '@pulo/core/domain/types';
import { Botao, EstadoVazio } from '@/ui';

import { confirmar, Tela, useApp, useCarregar } from '../app';
import { FormularioDeHabito } from '../habitos/FormularioDeHabito';
import { DetalheDaMeta, type AcoesDaMeta } from './DetalheDaMeta';
import { FormularioDeMeta } from './FormularioDeMeta';
import { JoiasVoando } from './JoiasVoando';
import { ListaDeMetas } from './ListaDeMetas';
import { carregarMetas } from './logic';
import { planejarVoo, type Voo } from './voo';

export const TEXTO_DE_ERRO = 'A lagoa ficou sem sinal. Suas metas estão salvas.';
export const TEXTO_DO_LIMITE = `Até ${GOALS.maxActive} metas ativas de cada vez. Conclua ou apague uma para abrir espaço.`;

type Formulario = { tipo: 'meta'; id?: EntityId } | { tipo: 'habito'; metaId: EntityId } | null;

type MetasScreenProps = {
  /** A meta que abre junto com a tela (o "Ver meta" do hábito). */
  metaAberta?: EntityId;
};

/** Metas: a lista à esquerda e o detalhe à direita. No celular, o detalhe ocupa a tela. */
export function MetasScreen({ metaAberta }: MetasScreenProps) {
  const { repo, clock, user, mostrarAviso, emitirEvento, refresh } = useApp();
  const [aberta, setAberta] = useState(metaAberta);
  const [formulario, setFormulario] = useState<Formulario>(null);
  const [voo, setVoo] = useState<Voo | null>(null);
  // Um conjunto que não muda de identidade: marca na hora o baú que está sendo aberto.
  const [abrindo] = useState(() => new Set<EntityId>());
  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    return carregarMetas(repo, clock, user);
  });

  if (!user) return null;

  if (estado.tipo === 'carregando') {
    return (
      <Tela titulo="Metas">
        <div aria-label="Carregando as metas" role="progressbar" className="flex flex-col gap-3">
          <div className="h-28 rounded-md bg-line opacity-60" />
          <div className="h-28 rounded-md bg-line opacity-60" />
        </div>
      </Tela>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <Tela titulo="Metas">
        <EstadoVazio titulo="Sem sinal por aqui" texto={TEXTO_DE_ERRO} acao="Tentar de novo" onAcao={() => void recarregar()} />
      </Tela>
    );
  }

  const dados = estado.dados;
  const metas = [...dados.ativas, ...dados.concluidas];
  const escolhida = metas.find((m) => m.id === aberta);
  const meta = escolhida ?? metas[0];

  /** Roda um caso de uso: erro esperado vira aviso; erro de rede já é avisado pelo repositório. */
  const tentar = async <T, E extends string>(acao: () => Promise<Result<T, E>>): Promise<T | null> => {
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

  const nova = () => {
    if (!dados.cabeMais) return mostrarAviso({ mensagem: TEXTO_DO_LIMITE, variante: 'atencao' });
    setFormulario({ tipo: 'meta' });
  };

  const abrirOBau = async (id: EntityId) => {
    // Dois cliques seguidos não podem chamar a rota duas vezes.
    if (abrindo.has(id)) return;
    abrindo.add(id);
    // Mede antes de gravar: depois o baú já é outro desenho.
    const plano = planejarVoo();
    const bau = await tentar(() => abrirBau(repo, id, clock.now()));
    abrindo.delete(id);
    if (!bau) return;
    setVoo({ ...plano, joias: bau.joias });
    emitirEvento('feliz');
    mostrarAviso({ mensagem: `Baú aberto! Mais ${bau.joias} joias.`, variante: 'sucesso' });
  };

  const acoesDe = (m: Goal): AcoesDaMeta => ({
    alternarMarco: (marco) =>
      void tentar(() => alternarMarco(repo, m.id, marco, clock.now())).then((salva) => {
        if (salva?.milestones.find((x) => x.id === marco)?.doneAt !== undefined) emitirEvento('feliz');
      }),
    adicionarMarco: async (titulo) => (await tentar(() => adicionarMarco(repo, m.id, titulo, clock.now()))) !== null,
    atrelar: (habito) => void tentar(() => atrelarHabito(repo, habito, m.id)),
    criarHabito: () => setFormulario({ tipo: 'habito', metaId: m.id }),
    abrirBau: () => void abrirOBau(m.id),
    concluir: () =>
      void confirmar('Concluir esta meta?', `"${m.title}" vai para as concluídas e o baú fica esperando.`).then(async (ok) => {
        if (!ok || !(await tentar(() => concluirMeta(repo, m.id, clock.now())))) return;
        setAberta(m.id);
        emitirEvento('feliz');
        mostrarAviso({ mensagem: 'Meta conquistada! Que salto.', variante: 'sucesso' });
      }),
    reabrir: () =>
      void tentar(() => reabrirMeta(repo, m.id)).then((salva) => {
        if (salva) setAberta(salva.id);
      }),
    editar: () => setFormulario({ tipo: 'meta', id: m.id }),
    apagar: () =>
      void confirmar('Apagar esta meta?', `"${m.title}" e os marcos dela somem. Não dá para desfazer.`).then(async (ok) => {
        if (!ok) return;
        try {
          await apagarMeta(repo, m.id);
          setAberta(undefined);
        } catch {
          // O repositório já avisou.
        } finally {
          refresh();
        }
      }),
  });

  const salvarMeta = async (entrada: GoalInput, id: EntityId | undefined) => {
    const salva = await tentar(() =>
      id ? editarMeta(repo, id, entrada, dados.hoje) : criarMeta(repo, entrada, clock.now(), dados.hoje),
    );
    if (!salva) return false;
    setFormulario(null);
    setAberta(salva.id);
    if (!id) emitirEvento('feliz');
    return true;
  };

  const salvarHabito = async (entrada: HabitInput, metaId: EntityId) => {
    const criado = await tentar(() => criarHabito(repo, entrada, clock.now()));
    if (!criado) return false;
    // Criado, o formulário fecha mesmo se atrelar falhar: salvar de novo duplicaria o hábito.
    setFormulario(null);
    await tentar(() => atrelarHabito(repo, criado.id, metaId));
    return true;
  };

  return (
    <Tela>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl leading-[1.1] font-extrabold md:text-[32px]">Metas</h1>
        <Botao titulo="+ Nova meta" largura="auto" onPress={nova} />
      </div>
      {!meta ? (
        <EstadoVazio
          titulo="Qual é o seu grande salto?"
          texto="Uma meta grande, como terminar um curso, correr uma maratona ou juntar uma reserva."
          acao="Criar minha primeira meta"
          onAcao={nova}
          estadoDoSapo="pensando"
          testID="metas-vazio"
        />
      ) : (
        <div className="@container/pagina">
          <div className="grid grid-cols-1 items-start gap-6 @min-[36rem]/pagina:grid-cols-[minmax(240px,380px)_minmax(300px,1fr)]">
            <div className={escolhida ? 'hidden @min-[36rem]/pagina:block' : ''}>
              <ListaDeMetas dados={dados} selecionada={meta.id} onSelecionar={setAberta} />
            </div>
            <section
              aria-label="Detalhe da meta"
              className={`@container min-w-0 flex-col gap-3 ${escolhida ? 'flex' : 'hidden @min-[36rem]/pagina:flex'}`}
            >
              <button
                type="button"
                onClick={() => setAberta(undefined)}
                className="min-h-11 cursor-pointer self-start font-extrabold text-sapo-borda @min-[36rem]/pagina:hidden"
              >
                ‹ Todas as metas
              </button>
              {/* Trocar de meta fecha o campo de marco e a lista de hábitos. */}
              <DetalheDaMeta key={meta.id} meta={meta} dados={dados} timeZone={user.timezone} acoes={acoesDe(meta)} />
            </section>
          </div>
        </div>
      )}
      {formulario?.tipo === 'meta' ? (
        <FormularioDeMeta
          hoje={dados.hoje}
          meta={metas.find((m) => m.id === formulario.id)}
          onSalvar={(entrada) => salvarMeta(entrada, formulario.id)}
          onRemoverMarco={(marco) => {
            const id = formulario.id;
            if (id) void tentar(() => removerMarco(repo, id, marco));
          }}
          onFechar={() => setFormulario(null)}
        />
      ) : null}
      {formulario?.tipo === 'habito' ? (
        <FormularioDeHabito onSalvar={(entrada) => salvarHabito(entrada, formulario.metaId)} onFechar={() => setFormulario(null)} />
      ) : null}
      {voo ? <JoiasVoando voo={voo} onTerminar={() => setVoo(null)} /> : null}
    </Tela>
  );
}
