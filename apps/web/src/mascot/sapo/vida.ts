/** Vida parada do sapo (spec 32): piscadas em intervalos sorteados e, de vez em quando, um olhar de lado. */
import { useEffect, useState } from 'react';

export const VIDA = {
  piscadaMinMs: 3000,
  piscadaMaxMs: 6000,
  piscadaDuraMs: 140,
  olharACadaMs: 15000,
  olharDuraMs: 1400,
} as const;

/** Gerador pseudoaleatório com semente (mulberry32): devolve números de 0 a 1. */
export function sorteio(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quanto esperar até a próxima piscada, entre o mínimo e o máximo. */
export function esperaDaPiscada(proximo: () => number): number {
  return Math.round(VIDA.piscadaMinMs + proximo() * (VIDA.piscadaMaxMs - VIDA.piscadaMinMs));
}

export interface OpcoesDeVida {
  piscar: boolean;
  olhar: boolean;
  /** Sem ela, sorteada no navegador (cada sapo pisca no seu tempo). */
  semente?: number;
}

/** Liga um estado por `duraMs` a cada intervalo. Devolve quem desliga os timers. */
function repetir(espera: () => number, duraMs: number, mudar: (ligado: boolean) => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const agendar = () => {
    timer = setTimeout(() => {
      mudar(true);
      timer = setTimeout(() => {
        mudar(false);
        agendar();
      }, duraMs);
    }, espera());
  };
  agendar();
  return () => {
    clearTimeout(timer);
    mudar(false);
  };
}

export function useVidaParada({ piscar, olhar, semente }: OpcoesDeVida) {
  const [piscando, setPiscando] = useState(false);
  const [olhandoDeLado, setOlhandoDeLado] = useState(false);

  useEffect(() => {
    if (!piscar) return;
    const proximo = sorteio(semente ?? Math.random() * 4294967296);
    return repetir(() => esperaDaPiscada(proximo), VIDA.piscadaDuraMs, setPiscando);
  }, [piscar, semente]);

  useEffect(() => {
    if (!olhar) return;
    return repetir(() => VIDA.olharACadaMs - VIDA.olharDuraMs, VIDA.olharDuraMs, setOlhandoDeLado);
  }, [olhar]);

  return { piscando, olhandoDeLado };
}
