import { useCallback, useRef, useState, type PointerEvent as PonteiroNoReact } from 'react';

import { arrastar, cameraInicial, PASSO_DA_RODINHA, viewBoxDe, zoomNoPonto, type Camera, type LimitesDaCamera, type Ponto, type Tamanho } from './camera';

/** Quanto o ponteiro precisa andar para virar arrasto (antes disso o toque ainda é um clique). */
const FOLGA_DO_TOQUE = 4;

interface Arrasto {
  de: Ponto;
  camera: Camera;
}

const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
const meio = (a: Ponto, b: Ponto): Ponto => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Rodinha (mirando o ponteiro), arrasto e pinça sobre um `<svg>`. Espalhe `props` no elemento.
 * `limites` deve ser uma constante. `viewBox` é `undefined` enquanto o elemento não foi medido.
 */
export function useCamera(limites: LimitesDaCamera) {
  // Até o primeiro gesto, a câmera é a de abertura e acompanha o tamanho do contêiner.
  const [movida, setMovida] = useState<Camera | null>(null);
  const [tamanho, setTamanho] = useState<Tamanho | null>(null);
  const camera = movida ?? (tamanho ? cameraInicial(limites, tamanho) : null);
  const [arrastando, setArrastando] = useState(false);
  const dedos = useRef(new Map<number, Ponto>());
  const arrasto = useRef<Arrasto | null>(null);

  const ref = useCallback(
    (svg: SVGSVGElement | null) => {
      if (!svg) return;
      const medir = () => {
        const { width, height } = svg.getBoundingClientRect();
        if (!width || !height) return;
        setTamanho({ largura: width, altura: height });
      };
      // Ouvinte próprio porque o `onWheel` do React é passivo e não segura a rolagem da página.
      const rodar = (e: WheelEvent) => {
        e.preventDefault();
        const caixa = svg.getBoundingClientRect();
        const fator = e.deltaY > 0 ? PASSO_DA_RODINHA : 1 / PASSO_DA_RODINHA;
        const abertura = cameraInicial(limites, { largura: caixa.width, altura: caixa.height });
        setMovida((c) => zoomNoPonto(c ?? abertura, limites, caixa, { x: e.clientX, y: e.clientY }, fator));
      };
      svg.addEventListener('wheel', rodar, { passive: false });
      const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
      observador?.observe(svg);
      medir();
      return () => {
        svg.removeEventListener('wheel', rodar);
        observador?.disconnect();
      };
    },
    [limites],
  );

  const onPointerDown = (e: PonteiroNoReact<SVGSVGElement>) => {
    const de = { x: e.clientX, y: e.clientY };
    dedos.current.set(e.pointerId, de);
    arrasto.current = camera && dedos.current.size === 1 ? { de, camera } : null;
  };

  const onPointerMove = (e: PonteiroNoReact<SVGSVGElement>) => {
    const antes = dedos.current.get(e.pointerId);
    if (!antes) return;
    const svg = e.currentTarget;
    const agora = { x: e.clientX, y: e.clientY };
    const outro = [...dedos.current].find(([id]) => id !== e.pointerId)?.[1];
    dedos.current.set(e.pointerId, agora);
    const caixa = svg.getBoundingClientRect();
    if (outro) {
      svg.setPointerCapture?.(e.pointerId);
      const anterior = distancia(antes, outro);
      const atual = distancia(agora, outro);
      if (camera && anterior && atual) setMovida((c) => zoomNoPonto(c ?? camera, limites, caixa, meio(agora, outro), anterior / atual));
      return;
    }
    const inicio = arrasto.current;
    if (!inicio || !caixa.width) return;
    if (!arrastando) {
      if (distancia(inicio.de, agora) < FOLGA_DO_TOQUE) return;
      svg.setPointerCapture?.(e.pointerId);
      setArrastando(true);
    }
    setMovida(arrastar(inicio.camera, limites, caixa.width, agora.x - inicio.de.x, agora.y - inicio.de.y));
  };

  const soltar = (e: PonteiroNoReact<SVGSVGElement>) => {
    dedos.current.delete(e.pointerId);
    // Sobrou um dedo da pinça: o arrasto recomeça de onde ele está.
    const [resto] = [...dedos.current.values()];
    arrasto.current = resto && camera ? { de: resto, camera } : null;
    if (!resto) setArrastando(false);
  };

  return {
    camera,
    viewBox: camera && tamanho ? viewBoxDe(camera, tamanho) : undefined,
    arrastando,
    props: { ref, onPointerDown, onPointerMove, onPointerUp: soltar, onPointerCancel: soltar },
  };
}
