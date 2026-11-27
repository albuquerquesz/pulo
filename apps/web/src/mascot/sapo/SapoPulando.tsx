/** Espelha um lado do sapo para o outro: os desenhos são do lado esquerdo, em torno de x = 150. */
const ESPELHO = 'matrix(-1 0 0 1 300 0)';
const PELE = { fill: 'var(--b-sapo)', stroke: 'var(--b-contorno)', strokeWidth: 5 } as const;
const LINHA = { fill: 'none', stroke: 'var(--b-contorno)' } as const;

/** A perna esquerda: pé, coxa e os brilhos. */
function Perna() {
  return (
    <>
      <path d="M114 262 C94 257 64 258 48 266 C38 272 41 280 55 280 C78 280 100 277 116 273 Z" {...PELE} />
      <path d="M52 276 C52 270 62 266 78 265 C92 264 102 266 108 268 L110 275 C90 278 70 279 56 279 Z" fill="#fff" opacity=".22" />
      <path d="M52 276 C52 270 62 266 78 265 C92 264 102 266 108 268" {...LINHA} strokeWidth="3" />
      <path d="M114 208 C88 196 48 200 40 226 C34 248 62 262 98 262 C114 262 122 246 114 208 Z" {...PELE} />
      <path d="M58 242 C72 252 92 254 108 250" {...LINHA} strokeWidth="4" />
      <ellipse cx="62" cy="222" rx="12" ry="7" fill="#fff" opacity=".25" transform="rotate(-20 62 222)" />
    </>
  );
}

/** O braço esquerdo: contorno grosso por baixo, a cor por cima e três dedos. */
function Braco() {
  const curva = 'M114 204 C106 226 110 246 118 258';
  return (
    <>
      <path d={curva} {...LINHA} strokeWidth="17" />
      <path d={curva} fill="none" stroke="var(--b-sapo)" strokeWidth="9.5" />
      {[107, 118, 129].map((cx) => (
        <circle key={cx} cx={cx} cy={cx === 118 ? 267 : 264} r="6.5" {...PELE} strokeWidth="3.5" />
      ))}
    </>
  );
}

type OlhoProps = { cx: number; pupila: number };

/** Um olho: branco, pupila olhando para o meio e brilho. */
function Olho({ cx, pupila }: OlhoProps) {
  return (
    <g className="sp-olho">
      <ellipse cx={cx} cy="88" rx="27" ry="44" fill="#fff" stroke="var(--b-contorno)" strokeWidth="3" />
      <ellipse cx={pupila} cy="92" rx="13" ry="22" fill="var(--b-contorno)" />
      <ellipse cx={pupila + 4} cy="82" rx="4.5" ry="9.9" fill="#fff" />
    </g>
  );
}

type SapoPulandoProps = {
  /** Onde o sapo fica dentro de outro SVG (os pés ficam na base da caixa). */
  x?: number;
  y?: number;
  width?: number;
  className?: string;
};

/**
 * O sapo de corpo inteiro, da cena "andando" do creator-mcp. Parado, só respira; dentro de
 * `.cena-casa.focando` ou com a classe `pulando`, anda aos pulinhos sutis, um por segundo (CSS `.sapo-pulando`).
 */
export function SapoPulando({ x, y, width, className = '' }: SapoPulandoProps) {
  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={width === undefined ? undefined : (width * 258) / 300}
      viewBox="0 29 300 258"
      aria-hidden="true"
      className={`sapo-pulando overflow-visible ${className}`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse className="sp-sombra" cx="150" cy="278" rx="100" ry="9" fill="var(--b-contorno)" opacity=".12" />
      <g className="sp-corpo">
        <g className="sp-perna-e">
          <Perna />
        </g>
        <g className="sp-perna-d">
          <g transform={ESPELHO}>
            <Perna />
          </g>
        </g>
        <ellipse cx="150" cy="218" rx="46" ry="48" {...PELE} />
        <ellipse cx="150" cy="230" rx="29" ry="30" fill="var(--b-barriga)" />
        <g className="sp-braco-e">
          <Braco />
        </g>
        <g className="sp-braco-d">
          <g transform={ESPELHO}>
            <Braco />
          </g>
        </g>
        <g className="sp-cabeca">
          <ellipse cx="98" cy="86" rx="34" ry="52" {...PELE} />
          <ellipse cx="202" cy="86" rx="34" ry="52" {...PELE} />
          <ellipse cx="150" cy="148" rx="106" ry="54" {...PELE} />
          <ellipse cx="98" cy="86" rx="31.5" ry="49.5" fill="var(--b-sapo)" />
          <ellipse cx="202" cy="86" rx="31.5" ry="49.5" fill="var(--b-sapo)" />
          <Olho cx={98} pupila={101} />
          <Olho cx={202} pupila={199} />
          <ellipse cx="141" cy="132" rx="3.2" ry="2.4" fill="var(--b-contorno)" />
          <ellipse cx="159" cy="132" rx="3.2" ry="2.4" fill="var(--b-contorno)" />
          <ellipse cx="80" cy="158" rx="14" ry="8" fill="var(--b-bochecha)" opacity=".55" />
          <ellipse cx="220" cy="158" rx="14" ry="8" fill="var(--b-bochecha)" opacity=".55" />
          <path d="M106 156 Q150 184 194 156" {...LINHA} strokeWidth="5" />
        </g>
      </g>
    </svg>
  );
}
