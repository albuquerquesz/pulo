import type { Preferences, User } from '@pulo/core/domain/types';
import type { PreferencesPatch } from '@pulo/core/domain/user-metadata';

import { Chave } from '@/ui';

import { VALOR } from './estilos';
import { Linha, Linhas } from './Linha';
import { Secao } from './Secao';

type OpcaoDeTema = { chave: User['theme']; rotulo: string };

const TEMAS: OpcaoDeTema[] = [
  { chave: 'claro', rotulo: 'Claro' },
  { chave: 'escuro', rotulo: 'Escuro' },
  { chave: 'sistema', rotulo: 'Sistema' },
];

type PreferenciasProps = {
  tema: User['theme'];
  preferencias: Preferences;
  onTema: (tema: User['theme']) => void;
  reduzirMovimento: boolean;
  onReduzirMovimento: (ligado: boolean) => void;
  onMudar: (patch: PreferencesPatch) => void;
  /** O estado da conexão com o Claude; `null` enquanto não se sabe. */
  claude: string | null;
  onClaude: () => void;
};

export function Preferencias({ tema, preferencias, onTema, reduzirMovimento, onReduzirMovimento, onMudar, claude, onClaude }: PreferenciasProps) {
  return (
    <Secao titulo="Preferências">
      <Linhas>
        <Linha titulo="Tema">
          <div role="group" aria-label="Tema" className="inline-flex rounded-sm bg-line/55 p-[3px]">
            {TEMAS.map((o) => (
              <button
                key={o.chave}
                type="button"
                aria-pressed={o.chave === tema}
                onClick={() => onTema(o.chave)}
                className={`min-h-11 cursor-pointer rounded-[9px] px-3 py-[5px] text-[13px] md:min-h-0 ${o.chave === tema ? 'bg-surface font-extrabold shadow-[0_1px_3px_rgba(0,0,0,0.15)]' : ''}`}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </Linha>
        <Linha titulo="Reduzir movimento" detalhe="para as animações, além do que o aparelho já pede">
          <Chave rotulo="Reduzir movimento" ligada={reduzirMovimento} onMudar={onReduzirMovimento} />
        </Linha>
        <Linha titulo="Assistente de IA" detalhe="sugere ajustes na semana">
          <Chave rotulo="Assistente de IA" ligada={preferencias.aiEnabled} onMudar={(aiEnabled) => onMudar({ aiEnabled })} />
        </Linha>
        <Linha titulo="Conectar com o Claude" detalhe="funciona com o Claude e com qualquer agente que use MCP">
          <button type="button" onClick={onClaude} aria-label={`Conectar com o Claude: ${claude ?? 'verificando'}`} className={VALOR}>
            {claude ?? '…'}
          </button>
        </Linha>
      </Linhas>
    </Secao>
  );
}
