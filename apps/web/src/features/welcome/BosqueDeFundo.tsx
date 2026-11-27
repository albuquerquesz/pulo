import { useEffect, useRef, type CSSProperties } from 'react';

/** Desenhos de 1440 por 900, presos embaixo e cortando os lados quando a tela é mais estreita. */
const QUADRO = { viewBox: '0 0 1440 900', preserveAspectRatio: 'xMidYMax slice' } as const;
const RAIO = 'M1072 130 L1066 66 L1094 66 L1088 130 Z';
const ANGULOS_DOS_RAIOS = [0, 45, 90, 135, 180, 225, 270, 315];
const atraso = (segundos: number): CSSProperties => ({ animationDelay: `${segundos}s` });

/** Árvores redondinhas da mata: tronco, copa e, às vezes, um galho de copa ao lado. */
const ARVORES = [
  { x: 100, y: 540, rx: 58, ry: 62, cor: 'var(--b-mata)', tronco: [92, 560, 16, 60], atraso: -1 },
  { x: 239, y: 556, rx: 46, ry: 52, cor: 'var(--b-mata-escura)', tronco: [232, 575, 14, 50], atraso: -3 },
  { x: 380, y: 530, rx: 62, ry: 62, cor: 'var(--b-mata)', tronco: [372, 560, 16, 64], atraso: -2, galho: [350, 560, 34] },
  { x: 573, y: 552, rx: 44, ry: 50, cor: 'var(--b-mata-escura)', tronco: [566, 572, 14, 50], atraso: -2.5 },
  { x: 870, y: 536, rx: 52, ry: 52, cor: 'var(--b-mata)', tronco: [862, 566, 16, 56], atraso: -4.5, galho: [900, 562, 28] },
  { x: 1018, y: 540, rx: 54, ry: 60, cor: 'var(--b-mata-escura)', tronco: [1010, 565, 16, 60], atraso: -5 },
  { x: 1169, y: 522, rx: 70, ry: 70, cor: 'var(--b-mata)', tronco: [1160, 555, 18, 70], atraso: -4, galho: [1206, 556, 36] },
  { x: 1337, y: 548, rx: 48, ry: 56, cor: 'var(--b-mata-escura)', tronco: [1330, 570, 14, 54], atraso: -6 },
] as const;

const CAPIM = [
  { d: 'M60 900 C70 830 66 790 52 742 C84 790 92 840 94 900Z', atraso: 0 },
  { d: 'M100 900 C112 820 120 770 138 720 C140 790 132 850 132 900Z', atraso: -1 },
  { d: 'M150 900 C150 850 140 810 120 780 C156 806 174 850 180 900Z', atraso: -2 },
  { d: 'M1290 900 C1290 840 1300 800 1320 756 C1326 820 1322 860 1322 900Z', atraso: -0.5 },
  { d: 'M1340 900 C1346 830 1362 790 1390 750 C1384 820 1372 860 1372 900Z', atraso: -1.6 },
  { d: 'M1390 900 C1392 850 1404 820 1424 796 C1424 846 1418 876 1418 900Z', atraso: -2.4 },
] as const;

/** Folhas caindo: posições e ritmos fixos (sem sorteio, para o servidor e o navegador desenharem igual). */
const FOLHAS = [
  { esquerda: 9, duracao: 17, atraso: -3, cor: 'var(--b-mata)' },
  { esquerda: 22, duracao: 21, atraso: -14, cor: 'var(--b-lima)' },
  { esquerda: 36, duracao: 15, atraso: -8, cor: 'var(--b-sol-borda)' },
  { esquerda: 49, duracao: 23, atraso: -18, cor: 'var(--b-mata-escura)' },
  { esquerda: 63, duracao: 18, atraso: -5, cor: 'var(--b-mata)' },
  { esquerda: 76, duracao: 20, atraso: -11, cor: 'var(--b-lima)' },
  { esquerda: 90, duracao: 16, atraso: -1, cor: 'var(--b-sol-borda)' },
] as const;

/** O fundo da entrada: céu, morros, mata e lagoa em camadas. No desktop, as camadas seguem um pouco o mouse. */
export function BosqueDeFundo() {
  const cena = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = cena.current;
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reduzirMovimento === 'true';
    if (!raiz || quieto || !matchMedia('(pointer: fine)').matches) return;
    const camadas = [...raiz.querySelectorAll<HTMLElement>('[data-fundura]')];
    const aoMover = (e: PointerEvent) => {
      const x = e.clientX / innerWidth - 0.5;
      const y = e.clientY / innerHeight - 0.5;
      for (const camada of camadas) {
        const fundura = Number(camada.dataset.fundura);
        camada.style.transform = `translate(${-x * fundura}px, ${-y * fundura * 0.4}px)`;
      }
    };
    addEventListener('pointermove', aoMover);
    return () => removeEventListener('pointermove', aoMover);
  }, []);

  return (
    <div ref={cena} aria-hidden="true" className="bosque fixed inset-0 overflow-hidden">
      {/* Céu: sol e nuvens. */}
      <div className="camada" data-fundura="6">
        <svg {...QUADRO} className="size-full">
          <defs>
            <radialGradient id="bosque-halo">
              <stop offset="0" stopColor="#fff2b8" />
              <stop offset="1" stopColor="#fff2b8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle className="brilho" cx="1080" cy="230" r="210" fill="url(#bosque-halo)" />
          <g className="raios" opacity=".55" fill="var(--b-raio)">
            {ANGULOS_DOS_RAIOS.map((angulo) => (
              <path key={angulo} d={RAIO} transform={`rotate(${angulo} 1080 230)`} />
            ))}
          </g>
          <circle cx="1080" cy="230" r="74" fill="var(--b-sol)" stroke="var(--b-sol-borda)" strokeWidth="6" />
          <g fill="#fff" opacity=".95">
            <g className="nuvem" style={{ animationDuration: '95s', animationDelay: '-30s' }}>
              <path d="M60 170c0-26 22-44 48-40 8-22 34-34 58-24 18-14 48-10 60 12 26-2 44 18 40 40H60z" />
            </g>
            <g className="nuvem" style={{ animationDuration: '140s', animationDelay: '-90s' }}>
              <path d="M300 110c0-20 16-34 36-31 6-17 26-26 44-18 14-11 37-8 46 9 20-1 34 14 31 31H300z" opacity=".8" />
            </g>
            <g className="nuvem" style={{ animationDuration: '120s', animationDelay: '-10s' }}>
              <path d="M120 290c0-18 15-30 33-28 6-15 23-23 40-16 12-10 33-7 41 8 18-1 30 12 28 27H120z" opacity=".7" />
            </g>
          </g>
        </svg>
      </div>

      {/* Morros ao longe. */}
      <div className="camada" data-fundura="12">
        <svg {...QUADRO} className="size-full">
          <path d="M0 520 C180 440 330 450 470 500 C620 420 820 410 980 480 C1120 430 1300 440 1440 500 V900 H0Z" fill="var(--b-morro-1)" />
          <path d="M0 590 C220 520 420 540 600 580 C780 520 1000 520 1180 570 C1300 540 1380 545 1440 560 V900 H0Z" fill="var(--b-morro-2)" />
        </svg>
      </div>

      {/* A mata e o chão. */}
      <div className="camada" data-fundura="20">
        <svg {...QUADRO} className="size-full">
          <g stroke="var(--b-contorno)" strokeWidth="4" strokeLinejoin="round">
            {ARVORES.map((a) => (
              <g key={a.x} className="arvore" style={atraso(a.atraso)}>
                <rect x={a.tronco[0]} y={a.tronco[1]} width={a.tronco[2]} height={a.tronco[3]} rx="6" fill="var(--b-tronco)" />
                <ellipse cx={a.x} cy={a.y} rx={a.rx} ry={a.ry} fill={a.cor} />
                {'galho' in a ? <circle cx={a.galho[0]} cy={a.galho[1]} r={a.galho[2]} fill={a.cor} /> : null}
              </g>
            ))}
          </g>
          <path d="M0 610 C240 585 470 600 720 612 C980 600 1200 588 1440 606 V900 H0Z" fill="var(--b-chao)" stroke="var(--b-contorno)" strokeWidth="4" />
        </svg>
      </div>

      {/* A lagoa, as taboas e o capim da frente. */}
      <div className="camada" data-fundura="34">
        <svg {...QUADRO} className="size-full">
          <path
            d="M150 760 C150 690 420 660 720 664 C1030 668 1300 696 1300 760 C1300 826 1010 850 720 850 C420 850 150 828 150 760Z"
            fill="var(--b-agua)"
            stroke="var(--b-contorno)"
            strokeWidth="4"
          />
          <path
            className="brilho-agua"
            d="M260 750 C300 712 520 698 720 700 C940 702 1120 718 1170 748"
            fill="none"
            stroke="var(--b-agua-clara)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <g fill="none" stroke="#e9fff6" strokeWidth="3">
            <ellipse className="onda-lagoa" cx="470" cy="780" rx="38" ry="9" />
            <ellipse className="onda-lagoa" cx="980" cy="800" rx="44" ry="10" style={atraso(-2)} />
            <ellipse className="onda-lagoa" cx="760" cy="770" rx="30" ry="7" style={atraso(-3.4)} />
          </g>
          <g stroke="var(--b-contorno)" strokeWidth="3.5" strokeLinejoin="round">
            <path className="regia" d="M330 790 a46 18 0 1 0 2 -1 L360 782 Z" fill="var(--b-regia)" />
            <path className="regia" style={atraso(-1.5)} d="M1080 770 a40 15 0 1 0 2 -1 L1104 763 Z" fill="var(--b-regia)" />
            <path className="regia" style={atraso(-3)} d="M640 812 a34 13 0 1 0 2 -1 L662 806 Z" fill="var(--b-lima)" />
            <g className="regia" style={atraso(-2)}>
              <circle cx="1086" cy="760" r="9" fill="#ffd6e0" />
              <circle cx="1086" cy="760" r="3.5" fill="var(--b-sol)" stroke="none" />
            </g>
          </g>
          <g className="capim" fill="var(--b-capim)" stroke="var(--b-contorno)" strokeWidth="3" strokeLinejoin="round">
            {CAPIM.map((c) => (
              <path key={c.d} d={c.d} style={atraso(c.atraso)} />
            ))}
          </g>
          <g className="capim" stroke="var(--b-contorno)" strokeWidth="3">
            <path style={atraso(-1.2)} d="M1240 790 C1236 740 1240 700 1246 660" fill="none" />
            <path style={atraso(-1.2)} d="M1239 700 h14 v40 a7 7 0 0 1 -14 0Z" fill="var(--b-tronco)" />
            <path style={atraso(-2.2)} d="M196 800 C200 750 196 712 190 676" fill="none" />
            <path style={atraso(-2.2)} d="M184 712 h14 v38 a7 7 0 0 1 -14 0Z" fill="var(--b-tronco)" />
          </g>
        </svg>
      </div>

      {FOLHAS.map((f) => (
        <svg
          key={f.esquerda}
          viewBox="0 0 24 24"
          className="folha-cai"
          style={{ left: `${f.esquerda}%`, animationDuration: `${f.duracao}s`, animationDelay: `${f.atraso}s` }}
        >
          <path d="M12 2C6 6 4 13 12 22C20 13 18 6 12 2Z" fill={f.cor} stroke="var(--b-contorno)" strokeWidth="1.5" />
          <path d="M12 5V20" stroke="var(--b-contorno)" strokeWidth="1.2" />
        </svg>
      ))}

      <svg className="libelula" viewBox="0 0 60 30">
        <g stroke="var(--b-contorno)" strokeWidth="1.6">
          <ellipse className="asa" cx="24" cy="10" rx="9" ry="7" fill="#e4f7ff" opacity=".9" />
          <ellipse className="asa" cx="36" cy="10" rx="9" ry="7" fill="#e4f7ff" opacity=".9" />
          <rect x="8" y="14" width="44" height="5" rx="2.5" fill="var(--b-agua-funda)" />
          <circle cx="52" cy="16.5" r="4.5" fill="var(--b-agua-funda)" />
        </g>
      </svg>
    </div>
  );
}
