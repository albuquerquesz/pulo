import { useState } from 'react';

import { GOALS } from '@pulo/core/config/decisions';
import {
  adicionarMarco,
  alternarMarco,
  apagarMeta,
  concluirMeta,
  criarMeta,
  editarMeta,
  goalProgress,
  reabrirMeta,
  removerMarco,
  type GoalErrorCode,
} from '@pulo/core/domain/goals';
import { dateKeyOf } from '@pulo/core/domain/day';
import type { Result } from '@pulo/core/domain/result';
import type { DateKey, Goal } from '@pulo/core/domain/types';
import { Botao, Cartao, EstadoVazio, Texto } from '@/ui';

import { confirmar, Secao, Tela, useApp, useCarregar } from '../app';
import { carregarMetas, dataPorExtenso, marcosDoTexto, mesEAno, textoDoPrazo } from './logic';

export const TEXTO_DE_ERRO = 'A lagoa ficou sem sinal. Suas metas estão salvas.';

const CAMPO = 'min-h-12 w-full rounded-[16px] border-2 border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted';

type Formulario = { tipo: 'nova' } | { tipo: 'editar'; meta: Goal } | null;

export function MetasScreen() {
  const { repo, clock, user, mostrarAviso, emitirEvento, refresh } = useApp();
  const [formulario, setFormulario] = useState<Formulario>(null);
  const [aberta, setAberta] = useState<string | null>(null);
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

  const d = estado.dados;

  /** Roda um caso de uso: erro esperado vira aviso; erro de rede já é avisado pelo repositório. */
  const tentar = async (acao: () => Promise<Result<Goal, GoalErrorCode>>): Promise<Goal | null> => {
    try {
      const r = await acao();
      if (!r.ok) {
        mostrarAviso({ mensagem: r.error.message, variante: 'atencao' });
        return null;
      }
      refresh();
      return r.value;
    } catch {
      refresh();
      return null;
    }
  };

  const concluir = async (meta: Goal) => {
    const ok = await confirmar('Concluir esta meta?', `"${meta.title}" vai para as conquistas.`);
    if (!ok) return;
    if (await tentar(() => concluirMeta(repo, meta.id, clock.now()))) {
      emitirEvento('feliz');
      mostrarAviso({ mensagem: 'Meta conquistada! Que salto.', variante: 'sucesso' });
    }
  };

  const apagar = async (meta: Goal) => {
    const ok = await confirmar('Apagar esta meta?', `"${meta.title}" e os marcos dela somem. Não dá para desfazer.`);
    if (!ok) return;
    try {
      await apagarMeta(repo, meta.id);
    } finally {
      refresh();
    }
  };

  if (formulario) {
    return (
      <FormularioDeMeta
        hoje={d.hoje}
        meta={formulario.tipo === 'editar' ? formulario.meta : undefined}
        onCancelar={() => setFormulario(null)}
        onSalvar={async (dados) => {
          const salva = await tentar(() =>
            formulario.tipo === 'editar'
              ? editarMeta(repo, formulario.meta.id, dados, d.hoje)
              : criarMeta(repo, dados, clock.now(), d.hoje),
          );
          if (!salva) return;
          setFormulario(null);
          setAberta(salva.id);
          if (formulario.tipo === 'nova') emitirEvento('feliz');
        }}
      />
    );
  }

  return (
    <Tela titulo="Metas">
      <Texto cor="muted">Os grandes saltos, de meses ou anos. Quebre cada um em marcos e vá riscando.</Texto>

      {d.ativas.length === 0 ? (
        <EstadoVazio
          titulo="Qual é o seu grande salto?"
          texto="Uma meta grande, como terminar um curso, correr uma maratona ou juntar uma reserva."
          acao="Criar minha primeira meta"
          onAcao={() => setFormulario({ tipo: 'nova' })}
          estadoDoSapo="pensando"
          testID="metas-vazio"
        />
      ) : (
        <Secao
          titulo="Em andamento"
          extra={
            <Texto variante="legenda" cor="muted" tabular>
              {d.ativas.length} de {GOALS.maxActive}
            </Texto>
          }
        >
          {d.ativas.map((meta) => (
            <CartaoDeMeta
              key={meta.id}
              meta={meta}
              hoje={d.hoje}
              aberta={aberta === meta.id}
              onAbrir={() => setAberta(aberta === meta.id ? null : meta.id)}
              onMarco={(id) => void tentar(() => alternarMarco(repo, meta.id, id, clock.now())).then((m) => m && emitirEvento('feliz'))}
              onAdicionarMarco={(titulo) => tentar(() => adicionarMarco(repo, meta.id, titulo, clock.now()))}
              onRemoverMarco={(id) => void tentar(() => removerMarco(repo, meta.id, id))}
              onEditar={() => setFormulario({ tipo: 'editar', meta })}
              onConcluir={() => void concluir(meta)}
              onApagar={() => void apagar(meta)}
            />
          ))}
          {d.cabeMais ? (
            <Botao titulo="Nova meta" onPress={() => setFormulario({ tipo: 'nova' })} testID="nova-meta" />
          ) : (
            <Texto variante="legenda" cor="muted">
              Até {GOALS.maxActive} metas ativas de cada vez, para cada uma receber atenção de verdade.
            </Texto>
          )}
        </Secao>
      )}

      {d.concluidas.length > 0 ? (
        <Secao titulo="Conquistas">
          {d.concluidas.map((meta) => (
            <Cartao key={meta.id} className="flex-row items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sapo" aria-hidden="true">
                <Texto como="span" variante="legenda" cor="inkSobreAcao">
                  ✓
                </Texto>
              </span>
              <div className="min-w-0 flex-1">
                <Texto variante="subtitulo" className="line-clamp-2">
                  {meta.title}
                </Texto>
                {meta.completedAt ? (
                  <Texto variante="legenda" cor="muted">
                    Conquistada em {mesEAno(dateKeyOf(meta.completedAt, user.timezone))}
                  </Texto>
                ) : null}
              </div>
              <Botao
                titulo="Reabrir"
                variante="fantasma"
                largura="auto"
                rotulo={`Reabrir a meta ${meta.title}`}
                onPress={() => void tentar(() => reabrirMeta(repo, meta.id))}
              />
            </Cartao>
          ))}
        </Secao>
      ) : null}
    </Tela>
  );
}

type CartaoDeMetaProps = {
  meta: Goal;
  hoje: DateKey;
  aberta: boolean;
  onAbrir(): void;
  onMarco(id: string): void;
  onAdicionarMarco(titulo: string): Promise<Goal | null>;
  onRemoverMarco(id: string): void;
  onEditar(): void;
  onConcluir(): void;
  onApagar(): void;
};

function CartaoDeMeta({ meta, hoje, aberta, onAbrir, onMarco, onAdicionarMarco, onRemoverMarco, onEditar, onConcluir, onApagar }: CartaoDeMetaProps) {
  const [novoMarco, setNovoMarco] = useState('');
  const progresso = goalProgress(meta);
  const prazo = textoDoPrazo(meta, hoje);
  const atrasada = prazo !== null && meta.targetDate !== undefined && meta.targetDate < hoje;

  const adicionar = async () => {
    if (!novoMarco.trim()) return;
    if (await onAdicionarMarco(novoMarco)) setNovoMarco('');
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-b-4 border-line bg-surface p-4" data-testid="meta">
      <button type="button" onClick={onAbrir} aria-expanded={aberta} className="flex cursor-pointer flex-col gap-2 text-left">
        <Texto variante="subtitulo">{meta.title}</Texto>
        {meta.why ? <Texto cor="muted">{meta.why}</Texto> : null}
        {meta.targetDate ? (
          <Texto variante="legenda" cor={atrasada ? 'atencao' : 'muted'}>
            Até {dataPorExtenso(meta.targetDate)}. {prazo}.
          </Texto>
        ) : null}
        <div className="flex items-center gap-3">
          <div
            className="h-3 flex-1 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label={`Marcos de ${meta.title}`}
            aria-valuemin={0}
            aria-valuemax={progresso.total}
            aria-valuenow={progresso.done}
          >
            <div className="h-full rounded-full bg-sapo transition-[width] duration-300" style={{ width: `${Math.round(progresso.ratio * 100)}%` }} />
          </div>
          <Texto variante="legenda" cor="muted" tabular>
            {progresso.total === 0 ? 'Sem marcos' : `${progresso.done} de ${progresso.total}`}
          </Texto>
        </div>
      </button>

      {aberta ? (
        <div className="flex flex-col gap-3 border-t-2 border-line pt-3">
          {meta.milestones.length === 0 ? (
            <Texto variante="legenda" cor="muted">
              Quebre a meta em marcos: passos concretos que mostram que você está chegando lá.
            </Texto>
          ) : (
            <ul className="flex flex-col gap-1">
              {meta.milestones.map((m) => {
                const feito = m.doneAt !== undefined;
                return (
                  <li key={m.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={feito}
                      aria-label={m.title}
                      onClick={() => onMarco(m.id)}
                      className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-left"
                    >
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${feito ? 'border-sapo-borda bg-sapo' : 'border-muted'}`}
                        aria-hidden="true"
                      >
                        {feito ? (
                          <Texto como="span" variante="legenda" cor="inkSobreAcao">
                            ✓
                          </Texto>
                        ) : null}
                      </span>
                      <Texto como="span" cor={feito ? 'muted' : 'ink'} className={feito ? 'line-through' : ''}>
                        {m.title}
                      </Texto>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoverMarco(m.id)}
                      aria-label={`Remover o marco ${m.title}`}
                      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted"
                    >
                      <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden className="stroke-current">
                        <path d="M6 6 L18 18 M18 6 L6 18" strokeWidth={2.2} strokeLinecap="round" fill="none" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {meta.milestones.length < GOALS.maxMilestones ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void adicionar();
              }}
            >
              <input
                value={novoMarco}
                onChange={(e) => setNovoMarco(e.target.value)}
                placeholder="Novo marco"
                maxLength={80}
                aria-label={`Novo marco para ${meta.title}`}
                className={CAMPO}
              />
              <Botao
                titulo="Adicionar marco"
                largura="auto"
                tipo="submit"
                desativado={!novoMarco.trim()}
                icone={
                  <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="stroke-current">
                    <path d="M12 5 L12 19 M5 12 L19 12" strokeWidth={2.6} strokeLinecap="round" fill="none" />
                  </svg>
                }
              />
            </form>
          ) : null}

          <Botao titulo="Concluir meta" onPress={onConcluir} testID="concluir-meta" />
          <div className="flex gap-2">
            <Botao titulo="Editar" variante="fantasma" onPress={onEditar} className="flex-1" />
            <Botao titulo="Apagar" variante="fantasma" onPress={onApagar} className="flex-1" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type DadosDoFormulario = { title: string; why?: string; targetDate?: DateKey; milestones?: string[] };

type FormularioDeMetaProps = {
  hoje: DateKey;
  meta?: Goal;
  onCancelar(): void;
  onSalvar(dados: DadosDoFormulario): Promise<void>;
};

function FormularioDeMeta({ hoje, meta, onCancelar, onSalvar }: FormularioDeMetaProps) {
  const [titulo, setTitulo] = useState(meta?.title ?? '');
  const [porque, setPorque] = useState(meta?.why ?? '');
  const [prazo, setPrazo] = useState(meta?.targetDate ?? '');
  const [marcos, setMarcos] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSalvar({
        title: titulo,
        why: porque,
        targetDate: prazo || undefined,
        ...(meta ? {} : { milestones: marcosDoTexto(marcos) }),
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Tela titulo={meta ? 'Editar meta' : 'Nova meta'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <label className="flex flex-col gap-2">
          <Texto como="span" variante="subtitulo">
            Qual é a meta?
          </Texto>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Correr uma maratona"
            maxLength={80}
            data-testid="titulo-da-meta"
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-2">
          <Texto como="span" variante="subtitulo">
            Por que ela importa?
          </Texto>
          <input
            value={porque}
            onChange={(e) => setPorque(e.target.value)}
            placeholder="Opcional, em uma frase"
            maxLength={200}
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-2">
          <Texto como="span" variante="subtitulo">
            Até quando?
          </Texto>
          <input type="date" value={prazo} min={hoje} onChange={(e) => setPrazo(e.target.value)} className={CAMPO} />
          <Texto variante="legenda" cor="muted">
            Opcional. Metas grandes costumam levar meses.
          </Texto>
        </label>

        {meta ? null : (
          <label className="flex flex-col gap-2">
            <Texto como="span" variante="subtitulo">
              Primeiros marcos
            </Texto>
            <textarea
              value={marcos}
              onChange={(e) => setMarcos(e.target.value)}
              placeholder={'Correr 5 km\nCorrer 10 km\nMeia maratona'}
              rows={4}
              className={`${CAMPO} py-3`}
            />
            <Texto variante="legenda" cor="muted">
              Um por linha. Dá para adicionar mais depois.
            </Texto>
          </label>
        )}

        <Botao titulo={meta ? 'Salvar' : 'Criar meta'} tipo="submit" carregando={salvando} desativado={!titulo.trim()} testID="salvar-meta" />
        <Botao titulo="Cancelar" variante="fantasma" onPress={onCancelar} />
      </form>
    </Tela>
  );
}
