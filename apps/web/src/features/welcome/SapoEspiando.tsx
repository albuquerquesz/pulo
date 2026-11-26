import { useId } from 'react';

/** Um olho: branco, pupila com brilho e a pálpebra que desce por dentro dele para piscar. */
function Olho({ cx, pupila, recorte }: { cx: number; pupila: number; recorte: string }) {
  return (
    <g clipPath={`url(#${recorte})`}>
      <ellipse cx={cx} cy="88" rx="27" ry="44" fill="#fff" />
      <g className="pupila">
        <ellipse cx={pupila} cy="92" rx="13" ry="22" fill="var(--b-contorno)" />
        <ellipse cx={pupila + 4} cy="82" rx="4.5" ry="9.9" fill="#fff" />
      </g>
      <g className="palpebra">
        <rect x={cx - 32} y="30" width="64" height="104" fill="var(--b-sapo)" />
        <path d={`M${cx - 32} 132 Q${cx} 142 ${cx + 32} 132`} fill="none" stroke="var(--b-contorno)" strokeWidth="5" strokeLinecap="round" />
      </g>
    </g>
  );
}

/** Só o rosto do sapo, espiando por cima do cartão da entrada: respira e pisca. */
export function SapoEspiando({ className = '' }: { className?: string }) {
  // O id do React traz sinais que não valem dentro de url(#...).
  const id = `sapo${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const esquerdo = `${id}-olho-e`;
  const direito = `${id}-olho-d`;
  return (
    <svg viewBox="0 28 300 180" role="img" aria-label="Sapo, espiando" className={`sapo-espiando overflow-visible ${className}`}>
      <defs>
        <clipPath id={esquerdo}>
          <ellipse cx="98" cy="88" rx="27" ry="44" />
        </clipPath>
        <clipPath id={direito}>
          <ellipse cx="202" cy="88" rx="27" ry="44" />
        </clipPath>
      </defs>
      <g className="rosto" stroke="var(--b-contorno)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="98" cy="86" rx="34" ry="52" fill="var(--b-sapo)" />
        <ellipse cx="202" cy="86" rx="34" ry="52" fill="var(--b-sapo)" />
        <ellipse cx="150" cy="148" rx="106" ry="54" fill="var(--b-sapo)" />
        <ellipse cx="98" cy="86" rx="31" ry="49" fill="var(--b-sapo)" stroke="none" />
        <ellipse cx="202" cy="86" rx="31" ry="49" fill="var(--b-sapo)" stroke="none" />
        <g stroke="none">
          <Olho cx={98} pupila={101} recorte={esquerdo} />
          <Olho cx={202} pupila={199} recorte={direito} />
          <ellipse cx="141" cy="132" rx="3.2" ry="2.4" fill="var(--b-contorno)" />
          <ellipse cx="159" cy="132" rx="3.2" ry="2.4" fill="var(--b-contorno)" />
          <ellipse cx="80" cy="158" rx="14" ry="8" fill="var(--b-bochecha)" opacity=".55" />
          <ellipse cx="220" cy="158" rx="14" ry="8" fill="var(--b-bochecha)" opacity=".55" />
        </g>
        <path d="M106 156 Q150 184 194 156" fill="none" />
      </g>
    </svg>
  );
}
