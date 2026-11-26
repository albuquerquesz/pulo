import { useState } from 'react';

import { ambienteDoApp, apiUrl } from '../sessao/config';
import { BOTAO_DO_DIALOGO, Dialogo } from './Dialogo';
import type { Conexoes } from './useConexoes';

type ClaudeDialogoProps = {
  conexoes: Conexoes;
  onDesconectar: (clientId: string) => Promise<void>;
  onTentarDeNovo: () => void;
  onFechar: () => void;
};

/** Quem tem acesso à conta pelo servidor MCP, com o botão de desconectar, e o endereço para conectar. */
export function ClaudeDialogo({ conexoes, onDesconectar, onTentarDeNovo, onFechar }: ClaudeDialogoProps) {
  const desconectar = async (clientId: string) => {
    try {
      await onDesconectar(clientId);
    } catch {
      // O repositório já avisou; o item continua na lista.
    }
  };
  return (
    <Dialogo titulo="Conectar com o Claude" onFechar={onFechar}>
      {conexoes.tipo === 'carregando' ? <p role="status">Verificando…</p> : null}
      {conexoes.tipo === 'erro' ? (
        <div role="alert" className="flex flex-col items-center gap-2">
          Não consegui ver as conexões.
          <button type="button" onClick={onTentarDeNovo} className={`${BOTAO_DO_DIALOGO} bg-white`}>
            Tentar de novo
          </button>
        </div>
      ) : null}
      {conexoes.tipo === 'ok' && conexoes.lista.length > 0 ? (
        <ul aria-label="Aplicativos conectados" className="flex w-full flex-col gap-2">
          {conexoes.lista.map((c) => (
            <li key={c.clientId} className="flex items-center justify-between gap-3">
              <span className="min-w-0 break-words">
                <b>{c.name ?? 'Aplicativo sem nome'}</b>
                <small className="block">desde {new Date(c.connectedAt).toLocaleDateString('pt-BR')}</small>
              </span>
              <button
                type="button"
                onClick={() => void desconectar(c.clientId)}
                aria-label={`Desconectar ${c.name ?? 'aplicativo sem nome'}`}
                className={`${BOTAO_DO_DIALOGO} shrink-0 bg-cancelar`}
              >
                Desconectar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Endereco />
    </Dialogo>
  );
}

/** O endereço do servidor MCP para colar no Claude: a IA entra com a mesma conta. */
function Endereco() {
  const api = apiUrl(ambienteDoApp(), import.meta.env.DEV);
  const [copiado, setCopiado] = useState(false);
  if (!api) return null;
  const endereco = `${api}/mcp`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <div className="flex w-full flex-col items-center gap-2 text-center">
      <p>Para conectar, adicione este endereço como conector no Claude.</p>
      <code data-testid="endereco-mcp" className="max-w-full break-all">
        {endereco}
      </code>
      <button type="button" onClick={() => void copiar()} className={`${BOTAO_DO_DIALOGO} bg-lima`}>
        {copiado ? 'Copiado' : 'Copiar endereço'}
      </button>
    </div>
  );
}
