import { ASSENTO } from './assento';
import { BAU } from './bau';
import { CAMA } from './cama';
import { ESTANTE } from './estante';
import { JANELA } from './janela';
import { LUMINARIA } from './luminaria';
import { PLANTA } from './planta';
import { QUADRO } from './quadro';
import { RELOGIO } from './relogio';
import { TAPETE } from './tapete';
import type { Movel } from './tipos';

export type { LugarId, Modelo, Movel, TipoDeMovel } from './tipos';

/** Os lugares do quarto. A ordem é o endereço gravado na API (veja `lugares.ts`): só acrescente no fim. */
export const MOVEIS: readonly Movel[] = [QUADRO, JANELA, RELOGIO, ESTANTE, LUMINARIA, CAMA, TAPETE, ASSENTO, BAU, PLANTA];

/** De trás para a frente. */
export const MOVEIS_NA_ORDEM_DE_DESENHO: readonly Movel[] = [...MOVEIS].sort((a, b) => a.camada - b.camada);
