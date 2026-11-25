import { useState } from 'react';

import { JOIAS } from '@pulo/core/config/decisions';
import { AREAS, comprarNaIlha, verIlha, type AreaId, type AreaNoMapa, type EstadoDaIlha } from '@pulo/core/domain/ilha';
import { textoDeFalta } from '@pulo/core/domain/joias';
import type { Phase } from '@pulo/core/domain/types';
import { MapaDaIlha } from '@/mascot/ilha/MapaDaIlha';
import { Botao, Cartao, EstadoVazio, Joia, Texto } from '@/ui';

import { Secao, useApp, useCarregar } from '../app';

export const TEXTO_DE_ERRO = 'A ilha ficou sem sinal. Suas joias estão guardadas.';

function Preco({ valor }: { valor: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-extrabold">
      <Joia largura={12} altura={14} />
      {valor}
    </span>
  );
}

const GANHOS: { chave: keyof EstadoDaIlha['ganhas']; texto: string; por: number }[] = [
  { chave: 'habitos', texto: 'Hábito feito', por: JOIAS.por.habitDone },
  { chave: 'focos', texto: `${JOIAS.focusMinutesPerJoia} minutos de foco`, por: 1 },
  { chave: 'descansos', texto: 'Dia de descanso', por: JOIAS.por.restDay },
  { chave: 'marcos', texto: 'Marco de meta', por: JOIAS.por.milestoneDone },
  { chave: 'metas', texto: 'Meta concluída', por: JOIAS.por.goalCompleted },
];

type Dados = { ilha: EstadoDaIlha; fase: Phase };

const ehAreaId = (item: string): item is AreaId => AREAS.some((a) => a.id === item);

export function IlhaScreen() {
  const { repo, clock, user, mostrarAviso, emitirEvento, refresh } = useApp();
  const [escolhida, setEscolhida] = useState<AreaId | null>(null);
  const [comprando, setComprando] = useState<string | null>(null);
  const { estado, recarregar } = useCarregar(async (): Promise<Dados> => {
    const [ilha, mascote] = await Promise.all([verIlha(repo), repo.getMascotState()]);
    return { ilha, fase: mascote?.phase ?? 1 };
  });

  if (!user) return null;

  if (estado.tipo !== 'ok') {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4 pb-6">
        <Texto como="h1" variante="titulo">
          Ilha
        </Texto>
        {estado.tipo === 'erro' ? (
          <EstadoVazio titulo="Sem sinal por aqui" texto={TEXTO_DE_ERRO} acao="Tentar de novo" onAcao={() => void recarregar()} />
        ) : (
          <div aria-label="Carregando a ilha" role="progressbar" className="aspect-[530/536] rounded-lg bg-line opacity-60" />
        )}
      </main>
    );
  }

  const { ilha, fase } = estado.dados;
  // Sem escolha, mostra a próxima área a abrir (ou a última, com tudo aberto).
  const padrao = ilha.areas.find((a) => a.estado === 'proxima')?.id ?? ilha.areas[ilha.areas.length - 1].id;
  const area = ilha.areas.find((a) => a.id === (escolhida ?? padrao)) ?? ilha.areas[0];

  const comprar = async (item: string, nome: string, ehArea: boolean) => {
    setComprando(item);
    try {
      const r = await comprarNaIlha(repo, clock, item);
      if (!r.ok) {
        mostrarAviso({ mensagem: r.error.message, variante: 'atencao' });
        return;
      }
      emitirEvento('feliz');
      // Área nova: o painel passa a mostrar os enfeites dela.
      if (ehArea && ehAreaId(item)) setEscolhida(item);
      mostrarAviso({ mensagem: ehArea ? `${nome} aberta! Seu sapo já está explorando.` : `${nome} na ilha!`, variante: 'sucesso' });
      refresh();
    } catch {
      refresh();
    } finally {
      setComprando(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 md:max-w-6xl md:px-8 md:pt-8 md:pb-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <Texto como="h1" variante="titulo">
            Ilha
          </Texto>
          <Texto variante="legenda" cor="muted">
            Nível {ilha.nivel} de {AREAS.length}
          </Texto>
        </div>
        <div
          className="flex items-center gap-2 rounded-full border-b-4 border-line bg-surface px-4 py-2"
          aria-label={`${ilha.saldo} joias`}
          data-testid="saldo-de-joias"
        >
          <Joia largura={18} altura={21} />
          <Texto como="span" variante="subtitulo">
            {ilha.saldo}
          </Texto>
        </div>
      </header>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] md:items-start md:gap-8">
        <div className="md:sticky md:top-8">
          <MapaDaIlha areas={ilha.areas} selecionada={area.id} onSelecionar={setEscolhida} faseDoSapo={fase} />
        </div>

        <div className="flex flex-col gap-4">
          <PainelDaArea area={area} ilha={ilha} comprando={comprando} onComprar={(item, nome, ehArea) => void comprar(item, nome, ehArea)} />

          <Secao titulo="Como ganhar joias" extra={<Texto variante="legenda" cor="muted">{ilha.ganhas.total} no total</Texto>}>
            <Cartao>
              <ul className="flex flex-col gap-2">
                {GANHOS.map((g) => (
                  <li key={g.chave} className="flex items-center justify-between gap-3">
                    <Texto>{g.texto}</Texto>
                    <span className="flex items-center gap-3">
                      <Texto variante="legenda" cor="muted">
                        {ilha.ganhas[g.chave]} ganhas
                      </Texto>
                      <span className="rounded-full bg-sapo px-2.5 py-0.5 text-sm font-extrabold text-ink-sobre-acao">+{g.por}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Cartao>
          </Secao>
        </div>
      </div>
    </main>
  );
}

function PainelDaArea({
  area,
  ilha,
  comprando,
  onComprar,
}: {
  area: AreaNoMapa;
  ilha: EstadoDaIlha;
  comprando: string | null;
  onComprar: (item: string, nome: string, ehArea: boolean) => void;
}) {
  const anterior = ilha.areas[ilha.areas.findIndex((a) => a.id === area.id) - 1];
  const comprados = area.enfeitesNoMapa.filter((e) => e.comprado).length;

  return (
    <Cartao className="gap-3" testID="painel-da-area">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <Texto como="h2" variante="subtitulo">
            {area.nome}
          </Texto>
          <Texto cor="muted">{area.descricao}</Texto>
        </div>
        {area.estado === 'aberta' ? (
          <span className="shrink-0 rounded-full bg-sapo px-3 py-1 text-sm font-extrabold text-ink-sobre-acao">
            {comprados} de {area.enfeitesNoMapa.length}
          </span>
        ) : null}
      </div>

      {area.estado === 'proxima' ? (
        <div className="flex flex-col gap-2">
          <Botao
            titulo={`Abrir por ${area.custo} joias`}
            desativado={ilha.saldo < area.custo}
            carregando={comprando === area.id}
            onPress={() => onComprar(area.id, area.nome, true)}
            testID="abrir-area"
          />
          {ilha.saldo < area.custo ? (
            <Texto variante="legenda" cor="muted">
              {textoDeFalta(area.custo - ilha.saldo)} Cada hábito feito ajuda.
            </Texto>
          ) : null}
        </div>
      ) : null}

      {area.estado === 'fechada' && anterior ? <Texto cor="muted">Abra a área {anterior.nome} primeiro.</Texto> : null}

      <ul className="flex flex-col gap-2">
        {area.enfeitesNoMapa.map((e) => {
          const falta = e.custo - ilha.saldo;
          return (
            <li key={e.id} className="flex min-h-12 items-center justify-between gap-3 rounded-sm border border-line px-3 py-2">
              <span className="flex flex-col">
                <Texto className="font-bold">{e.nome}</Texto>
                <Preco valor={e.custo} />
              </span>
              {e.comprado ? (
                <Texto variante="legenda" cor="muted">
                  Na ilha
                </Texto>
              ) : area.estado === 'aberta' ? (
                <Botao
                  titulo="Comprar"
                  rotulo={`Comprar ${e.nome} por ${e.custo} joias`}
                  largura="auto"
                  desativado={falta > 0}
                  carregando={comprando === e.id}
                  onPress={() => onComprar(e.id, e.nome, false)}
                  className="min-h-10"
                />
              ) : (
                <Texto variante="legenda" cor="muted">
                  Fechado
                </Texto>
              )}
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}
