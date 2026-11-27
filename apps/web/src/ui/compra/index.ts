export { animar, apoiarEm, caixaDo, centroNaTela, chegar, efeito, esperar, joiasVoando, semMovimento, sumir } from './efeitos';
export type { CaixaDoDesenho, Chegada, PontoNaTela, TipoDeChegada } from './efeitos';
export { useSaldoContando } from './useSaldoContando';

/** O selo do saldo dá um pulinho. */
export const PULINHO: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }];
export const RITMO_DO_PULINHO: KeyframeAnimationOptions = { duration: 360, easing: 'ease-out' };
