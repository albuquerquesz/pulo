import type { Period } from '@pulo/core/domain/types';

import { Escolha } from '@/ui';

import { PERIODOS } from './logic';

const SEM_PERIODO = '';
const OPCOES = [{ valor: SEM_PERIODO, rotulo: 'Sem período' }, ...PERIODOS.map((p) => ({ valor: p.chave, rotulo: `${p.icone} ${p.nome}` }))];

type PeriodoProps = { periodo: Period | undefined; onEscolher: (periodo: Period | undefined) => void };

/** O seletor de período: manhã, tarde, noite ou nenhum. */
export function Periodo({ periodo, onEscolher }: PeriodoProps) {
  return (
    <Escolha
      rotulo="Período"
      valor={periodo ?? SEM_PERIODO}
      opcoes={OPCOES}
      onEscolher={(valor) => onEscolher(PERIODOS.find((p) => p.chave === valor)?.chave)}
    />
  );
}
