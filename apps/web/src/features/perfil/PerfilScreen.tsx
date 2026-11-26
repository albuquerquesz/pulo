import { useState } from 'react';

import { DEFAULT_TIMEZONE } from '@pulo/core/config/decisions';
import { dateKeyOf } from '@pulo/core/domain/day';
import type { PreferencesPatch } from '@pulo/core/domain/user-metadata';

import { Botao } from '@/ui';

import { Tela, useApp, useCarregar } from '../app';
import { temConta, temPreferencias } from '../app/conta';
import { contaNaTela } from '../casca/logic';
import { baixarJson } from './baixar';
import { Cabecalho } from './Cabecalho';
import { ClaudeDialogo } from './ClaudeDialogo';
import { Conquistas } from './Conquistas';
import { Conta } from './Conta';
import { EditarPerfil } from './EditarPerfil';
import { Estatisticas } from './Estatisticas';
import { ExcluirConta } from './ExcluirConta';
import { carregarPerfil, desdeQuando, medalha, nomeDoArquivo } from './logic';
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
  const [baixando, setBaixando] = useState(false);
  if (!user) return null;

  const fuso = user.timezone || DEFAULT_TIMEZONE;
  const conta = contaNaTela(app.pessoa, user);
  const dados = estado.tipo === 'ok' ? estado.dados : null;
  const fechar = () => setDialogo(null);

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

  const baixar = async () => {
    if (!temConta(repo)) return;
    setBaixando(true);
    try {
      baixarJson(nomeDoArquivo(dateKeyOf(clock.now(), fuso)), await repo.exportData());
    } catch {
      // O repositório já avisou o que houve.
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Tela>
      {dados ? (
        <>
          <Cabecalho
            conta={conta}
            desde={desdeQuando(dados.estatisticas.desde, fuso)}
            nomeDoSapo={user.frogName}
            sapo={dados.sapo}
            saldo={dados.saldo}
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
                claude={estadoDoClaude(conexoes)}
                onClaude={() => setDialogo('claude')}
              />
            </>
          ) : null}
          {/* A conta fica à mão mesmo se os números não abrirem. */}
          <Conta
            baixando={baixando}
            onBaixar={() => void baixar()}
            onSair={() => void app.sair()}
            onExcluir={() => setDialogo('excluir')}
          />
        </div>
      </div>

      {dialogo === 'editar' ? <EditarPerfil conta={conta} onSalvar={app.editarConta} onFechar={fechar} /> : null}
      {dialogo === 'claude' ? <ClaudeDialogo conexoes={conexoes} onDesconectar={desconectar} onTentarDeNovo={tentarDeNovo} onFechar={fechar} /> : null}
      {dialogo === 'excluir' ? (
        <ExcluirConta onExcluir={app.excluirConta} onFechar={fechar} />
      ) : null}
    </Tela>
  );
}
