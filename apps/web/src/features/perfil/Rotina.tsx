import type { Preferences } from '@pulo/core/domain/types';
import type { PreferencesPatch } from '@pulo/core/domain/user-metadata';

import { Chave } from '@/ui';

import { Escolha, Linha, Linhas } from './Linha';
import { lembreteEscolhido, opcoesDeComecoDoDia, opcoesDeLembrete, SEM_LEMBRETE } from './logic';
import { Secao } from './Secao';

type RotinaProps = {
  comecoDoDia: number;
  preferencias: Preferences;
  onComecoDoDia: (minutos: number) => void;
  onMudar: (patch: PreferencesPatch) => void;
};

export function Rotina({ comecoDoDia, preferencias, onComecoDoDia, onMudar }: RotinaProps) {
  const { eveningReminder: lembrete, vacation } = preferencias;
  return (
    <Secao titulo="Rotina">
      <Linhas>
        <Linha titulo="Meu dia começa" detalhe="usado para virar o dia da sequência">
          <Escolha rotulo="Meu dia começa" valor={String(comecoDoDia)} opcoes={opcoesDeComecoDoDia(comecoDoDia)} onEscolher={(v) => onComecoDoDia(Number(v))} />
        </Linha>
        <Linha titulo="Lembrete da noite" detalhe="se faltar hábito para manter o fogo">
          <Escolha
            rotulo="Lembrete da noite"
            valor={lembrete.ligado ? String(lembrete.minutos) : SEM_LEMBRETE}
            opcoes={opcoesDeLembrete(lembrete)}
            onEscolher={(v) => onMudar({ eveningReminder: lembreteEscolhido(v, lembrete) })}
          />
        </Linha>
        <Linha titulo="Modo férias" detalhe="pausa a sequência sem perder o fogo">
          <Chave rotulo="Modo férias" ligada={vacation.ligado} onMudar={(ligado) => onMudar({ vacation: { ligado } })} />
        </Linha>
      </Linhas>
    </Secao>
  );
}
