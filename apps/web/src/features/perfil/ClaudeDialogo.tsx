import { useState } from 'react';

import { SapoRosto } from '@/mascot/sapo/SapoRosto';

import { ambienteDoApp, apiUrl } from '../sessao/config';
import { BOTAO_DO_DIALOGO, Dialogo } from './Dialogo';
import type { Conexoes } from './useConexoes';

type ClaudeDialogoProps = {
  conexoes: Conexoes;
  onDesconectar: (clientId: string) => Promise<void>;
  onTentarDeNovo: () => void;
  onFechar: () => void;
};

/** Os raios da marca do Claude: doze traços arredondados, em ângulos e tamanhos levemente diferentes. */
const RAIOS_DO_CLAUDE = [0, 31, 58, 92, 118, 151, 179, 211, 238, 272, 299, 331].map((angulo, i) => ({ angulo, tamanho: i % 2 ? 36 : 42 }));

/** A marca do Claude, desenhada em SVG. */
function MarcaDoClaude() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="size-16">
      <g fill="#D97757">
        {RAIOS_DO_CLAUDE.map(({ angulo, tamanho }) => (
          <rect key={angulo} x="46" y={50 - tamanho} width="8" height={tamanho} rx="4" transform={`rotate(${angulo} 50 50)`} />
        ))}
      </g>
    </svg>
  );
}

/** O sapo e a marca do Claude lado a lado, ligados por um tracinho. */
function SapoComClaude() {
  return (
    <div role="img" aria-label="O sapo do Pulo e o Claude" className="flex items-center gap-3">
      <SapoRosto momento="conectando-conta" className="w-[88px]" />
      <span aria-hidden="true" className="flex items-center gap-1.5">
        <i className="size-2 rounded-full bg-contorno/40" />
        <i className="size-2 rounded-full bg-contorno/60" />
        <i className="size-2 rounded-full bg-contorno/40" />
      </span>
      <MarcaDoClaude />
    </div>
  );
}

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
    <Dialogo titulo="Conectar com o Claude" onFechar={onFechar} ilustracao={<SapoComClaude />}>
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
