import { useState } from 'react';

import { ACCOUNT, DEFAULT_TIMEZONE } from '@pulo/core/config/decisions';
import { dateKeyOf } from '@pulo/core/domain/day';
import type { PreferencesPatch } from '@pulo/core/domain/user-metadata';

import { Botao, Gaveta } from '@/ui';

import { Tela, useApp, useCarregar, useConfirmacao } from '../app';
import { temConta, temPreferencias } from '../app/conta';
import { contaNaTela } from '../casca/logic';
import { Cabecalho } from './Cabecalho';
import { ClaudeDialogo } from './ClaudeDialogo';
import { Conquistas } from './Conquistas';
import { Conta } from './Conta';
import { EditarPerfil } from './EditarPerfil';
import { Estatisticas } from './Estatisticas';
import { ExcluirConta } from './ExcluirConta';
import { baixarDados } from './baixarDados';
import { carregarPerfil, desdeQuando, medalha } from './logic';
import { Metricas } from './Metricas';
import { Preferencias } from './Preferencias';
import { Rotina } from './Rotina';
import { useConexoes, type Conexoes } from './useConexoes';

type DialogoAberto = 'editar' | 'claude' | 'excluir' | null;

function estadoDoClaude(conexoes: Conexoes): string | null {
  if (conexoes.tipo === 'carregando') return null;
  if (conexoes.tipo === 'erro') return 'Ver';
  return conexoes.lista.length > 0 ? 'Conectado' : 'Conectar';
}

/** O Perfil: cabeçalho, estatísticas, conquistas, métricas, rotina, preferências e conta. */
export function PerfilScreen() {
  const app = useApp();
  const { repo, clock, user, refresh, atualizarPerfil } = app;
  const { estado, recarregar } = useCarregar(() => carregarPerfil(repo, clock));
  const { conexoes, desconectar, tentarDeNovo } = useConexoes();
  const [dialogo, setDialogo] = useState<DialogoAberto>(null);
  const { confirmar, confirmacao } = useConfirmacao();
  if (!user) return null;

  const fuso = user.timezone || DEFAULT_TIMEZONE;
  const conta = contaNaTela(app.pessoa);
  const dados = estado.tipo === 'ok' ? estado.dados : null;
  const fechar = () => setDialogo(null);

  const baixar = async () => {
    if (!temConta(repo)) return;
    try {
      baixarDados(await repo.exportData(), dateKeyOf(clock.now(), fuso));
    } catch {
      // O repositório já avisou.
    }
  };

  const apagar = async () => {
    const sim = await confirmar({
      titulo: 'Apagar meus dados',
      detalhe: 'Isso apaga hábitos, tarefas, metas, focos, joias e a casa do sapo. A conta continua. Não dá para desfazer.',
      acao: 'Apagar tudo',
      palavra: ACCOUNT.wipeConfirmation,
    });
    if (sim) await app.apagarDados();
  };

  const mudar = async (patch: PreferencesPatch) => {
    if (!temPreferencias(repo)) return;
    const gravando = repo.savePreferences(patch);
    // O cache já mudou: a tela mostra a escolha sem esperar o servidor.
    void recarregar();
    try {
      await gravando;
    } catch {
      // O repositório já avisou e voltou ao que era.
    }
    refresh();
  };

  return (
    <Tela>
      {dados ? (
        <>
          <Cabecalho
            conta={conta}
            desde={desdeQuando(dados.estatisticas.desde, fuso)}
            onEditar={() => setDialogo('editar')}
          />
          <Estatisticas sequencia={dados.sequencia} estatisticas={dados.estatisticas} />
          <Conquistas medalhas={dados.conquistas.map((c) => medalha(c, fuso))} />
          <Metricas />
        </>
      ) : null}
      {estado.tipo === 'carregando' ? (
        <p role="status" className="text-muted">
          Abrindo seu perfil…
        </p>
      ) : null}
      {estado.tipo === 'erro' ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-muted">
          Não consegui abrir seu perfil.
          <Botao titulo="Tentar de novo" variante="fantasma" largura="auto" onPress={() => void recarregar()} />
        </div>
      ) : null}

      <div className="@container">
        <div className="grid items-stretch gap-6 @xl:grid-cols-2 @xl:gap-4">
          {dados ? (
            <>
              <Rotina
                comecoDoDia={user.dayStartMinutes}
                preferencias={dados.preferencias}
                onComecoDoDia={(dayStartMinutes) => void atualizarPerfil({ dayStartMinutes })}
                onMudar={(patch) => void mudar(patch)}
              />
              <Preferencias
                tema={user.theme}
                preferencias={dados.preferencias}
                onTema={(theme) => void atualizarPerfil({ theme })}
                onMudar={(patch) => void mudar(patch)}
                reduzirMovimento={user.reduceMotion}
                onReduzirMovimento={(reduceMotion) => void atualizarPerfil({ reduceMotion })}
                claude={estadoDoClaude(conexoes)}
                onClaude={() => setDialogo('claude')}
              />
            </>
          ) : null}
          {/* A conta fica à mão mesmo se os números não abrirem. */}
          <Conta
            onSair={() => void app.sair()}
            onExcluir={() => setDialogo('excluir')}
            onBaixar={temConta(repo) ? () => void baixar() : undefined}
            onApagar={() => void apagar()}
          />
        </div>
      </div>

      <Gaveta aberta={dialogo === 'editar'} onFechar={fechar} rotulo="Editar perfil" titulo="Editar perfil" largura="md:w-[min(560px,94vw)]">
        {dialogo === 'editar' ? <EditarPerfil conta={conta} onSalvar={app.editarConta} onFechar={fechar} /> : null}
      </Gaveta>
      {dialogo === 'claude' ? <ClaudeDialogo conexoes={conexoes} onDesconectar={desconectar} onTentarDeNovo={tentarDeNovo} onFechar={fechar} /> : null}
      {dialogo === 'excluir' ? (
        <ExcluirConta onExcluir={app.excluirConta} onFechar={fechar} />
      ) : null}
      {confirmacao}
    </Tela>
  );
}
