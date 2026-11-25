import type { ReactNode } from 'react';

import type { ComodoId, ParteId } from '@pulo/core/domain/casa';

import { cor, mistura } from '../cores';
import { caixa, cilindro, circuloNoChao, cone, projetar, telhado, type CoresDoTelhado, type Volume } from './geometria';
import { CONTORNO, MADEIRA, PAREDE, PEDRA, TELHADO, TELHADO_AZUL, TELHADO_ROSA, VIDRO } from './paleta';
import { Bloco, Faces, Janela, Porta, type Vao } from './pecas';

/*
 * A mansão: os cômodos e a estrutura. Cada parte recebe o que já está pronto, para um andar de cima
 * substituir o telhado de baixo (ou subir em palafitas enquanto o de baixo não existe).
 */

export type Prontas = ReadonlySet<ParteId>;
export type Arte = (prontas: Prontas) => ReactNode;

const COZINHA: Volume = { u: [0, 2.6], v: [-2.6, -0.4], z: [0, 2.2] };
const SALA: Volume = { u: [-5.6, -3], v: [-3, -0.4], z: [0, 2.4] };
const BANHEIRO: Volume = { u: [0.8, 2.8], v: [-0.4, 1.1], z: [0, 1.5] };
const QUARTO: Volume = { u: [-3, 0], v: [-3, 0], z: [0, 2.6] };
const TORRE = { centro: [0.6, -3.7], raio: 0.95 } as const;

/** A janela principal de cada cômodo: é nela que o sapo aparece. */
export const JANELA_DO_COMODO: Record<ComodoId, Vao> = {
  quarto: { parede: 'esquerda', em: 0, ao: [-1.45, -0.8], z: [1.05, 1.8] },
  cozinha: { parede: 'direita', em: 2.6, ao: [-1.7, -0.8], z: [1, 1.75] },
  sala: { parede: 'esquerda', em: -0.4, ao: [-5.1, -3.9], z: [0.8, 1.7] },
  banheiro: { parede: 'direita', em: 2.8, ao: [0, 0.7], z: [0.6, 1.15] },
  escritorio: { parede: 'direita', em: 2.6, ao: [-1.8, -0.9], z: [2.75, 3.55] },
  biblioteca: { parede: 'esquerda', em: -0.4, ao: [-5.1, -3.9], z: [3, 3.9] },
  estudio: { parede: 'esquerda', em: 1.1, ao: [1.25, 2.35], z: [1.95, 2.7] },
  // Redonda, na frente da torre: só o centro e o tamanho são usados.
  observatorio: { parede: 'esquerda', em: -3, ao: [0.95, 1.55], z: [6.3, 6.9] },
};

const cobertura = ({ u, v, z }: Volume, altura: number, cores: CoresDoTelhado) => (
  <Faces faces={telhado({ u, v, z: [z[1], z[1] + altura] }, cores)} />
);

/** Os postes que seguram um andar enquanto o cômodo de baixo não foi construído. */
function Palafitas({ u, v, z }: Volume) {
  const postes = [
    { u: [u[0] + 0.1, u[0] + 0.28], v: [v[1] - 0.28, v[1] - 0.1] },
    { u: [u[1] - 0.28, u[1] - 0.1], v: [v[1] - 0.28, v[1] - 0.1] },
    { u: [u[1] - 0.28, u[1] - 0.1], v: [v[0] + 0.1, v[0] + 0.28] },
  ] as const;
  return <Faces faces={postes.flatMap((p) => caixa({ ...p, z: [0, z[0]] }, MADEIRA))} traco={3} />;
}

interface AndarProps {
  volume: Volume;
  base: ParteId;
  prontas: Prontas;
  telhadoDe: CoresDoTelhado;
  janela: Vao;
  children?: ReactNode;
}

function Andar({ volume, base, prontas, telhadoDe, janela, children }: AndarProps) {
  return (
    <>
      {prontas.has(base) ? null : <Palafitas {...volume} />}
      <Bloco volume={volume} cores={PAREDE} />
      {cobertura(volume, 1.1, telhadoDe)}
      <Janela {...janela} />
      {children}
    </>
  );
}

const FUMACA = [0, 1, 2] as const;

function Chamine({ prontas }: { prontas: Prontas }) {
  const volume: Volume = { u: [2.6, 3.05], v: [-2.55, -2.1], z: [0, 4.3] };
  const boca = projetar([2.82, -2.32, 4.65]);
  return (
    <>
      <Bloco volume={volume} cores={{ esquerda: cor('cancelar-borda'), direita: cor('cancelar'), topo: cor('cancelar-borda') }} />
      <Faces faces={caixa({ u: [2.5, 3.15], v: [-2.65, -2], z: [4.3, 4.55] }, PEDRA)} />
      {prontas.has('chamine') ? (
        <g className="fumaca" data-testid="fumaca">
          {FUMACA.map((i) => (
            <circle
              key={i}
              cx={boca.x + i * 9}
              cy={boca.y - i * 22}
              r={9 + i * 3}
              fill={cor('folha')}
              stroke={CONTORNO}
              strokeWidth="3"
              style={{ animationDelay: `${-i * 1.2}s` }}
            />
          ))}
        </g>
      ) : null}
    </>
  );
}

function Torre() {
  const [u, v] = TORRE.centro;
  const faixa = (z: number) => circuloNoChao([u, v, z], TORRE.raio);
  const ponta = projetar([u, v, 9.9]);
  return (
    <>
      <path d={cilindro({ ...TORRE, z: [0, 7.2] })} fill={PAREDE.direita} stroke={CONTORNO} strokeWidth="4" strokeLinejoin="round" />
      {/* Sombra interna do lado esquerdo e os anéis de pedra. */}
      <path d={cilindro({ centro: [u - 0.2, v + 0.2], raio: TORRE.raio * 0.62, z: [0.2, 6.9] })} fill={CONTORNO} opacity=".1" />
      {[2.6, 5].map((z) => {
        const anel = faixa(z);
        return <path key={z} d={`M${anel.cx - anel.rx} ${anel.cy}a${anel.rx} ${anel.ry} 0 0 0 ${anel.rx * 2} 0`} fill="none" stroke={CONTORNO} strokeWidth="3" />;
      })}
      {[3.4, 5.4].map((z) => (
        <Janela key={z} parede="esquerda" em={v + 0.9} ao={[u + 0.1, u + 0.55]} z={[z, z + 0.8]} />
      ))}
      <path d={cone({ centro: TORRE.centro, raio: TORRE.raio + 0.28, z: [7.2, 9.9] })} fill={cor('descanso')} stroke={CONTORNO} strokeWidth="4" strokeLinejoin="round" />
      <path d={cone({ centro: [u - 0.25, v + 0.25], raio: 0.55, z: [7.2, 9.4] })} fill={CONTORNO} opacity=".16" />
      <path d={`M${ponta.x} ${ponta.y}v-34`} stroke={CONTORNO} strokeWidth="4" />
      <path d={`M${ponta.x} ${ponta.y - 34}l30 8-30 10z`} fill={cor('foco')} stroke={CONTORNO} strokeWidth="3" strokeLinejoin="round" />
    </>
  );
}

/** A varanda redonda no alto da torre, com a escotilha e o telescópio. */
function Observatorio() {
  const [u, v] = TORRE.centro;
  const janela = centroDaEscotilha();
  const luneta = projetar([u + 1.1, v + 0.1, 6.4]);
  return (
    <>
      <path d={cilindro({ centro: TORRE.centro, raio: TORRE.raio + 0.35, z: [5.7, 6.05] })} fill={cor('joia')} stroke={CONTORNO} strokeWidth="4" strokeLinejoin="round" />
      <ellipse {...circuloNoChao([u, v, 6.05], TORRE.raio + 0.35)} fill={cor('joia-clara')} stroke={CONTORNO} strokeWidth="3" />
      <path d={cilindro({ centro: TORRE.centro, raio: TORRE.raio, z: [6.05, 7.2] })} fill={cor('joia-clara')} stroke={CONTORNO} strokeWidth="4" strokeLinejoin="round" />
      <circle cx={janela.x} cy={janela.y} r="22" fill={cor('folha')} stroke={CONTORNO} strokeWidth="3" />
      <circle className="janela-vidro" cx={janela.x} cy={janela.y} r="16" fill={VIDRO} stroke={CONTORNO} strokeWidth="2.5" />
      <g transform={`translate(${luneta.x},${luneta.y}) rotate(-34)`}>
        <rect x="-6" y="-8" width="48" height="16" rx="5" fill={cor('timer-ouro')} stroke={CONTORNO} strokeWidth="3" />
        <rect x="38" y="-11" width="14" height="22" rx="5" fill={cor('madeira')} stroke={CONTORNO} strokeWidth="3" />
      </g>
      <path d={cone({ centro: TORRE.centro, raio: TORRE.raio + 0.28, z: [7.2, 9.9] })} fill={cor('descanso')} stroke={CONTORNO} strokeWidth="4" strokeLinejoin="round" />
    </>
  );
}

const centroDaEscotilha = () => projetar([TORRE.centro[0] + 0.65, TORRE.centro[1] + 0.75, 6.6]);

function Escadinha() {
  return <Faces faces={caixa({ u: [-2.5, -1.55], v: [0, 0.35], z: [0, 0.15] }, PEDRA)} traco={3} />;
}

export const ARTE_DA_CONSTRUCAO = {
  quarto: (prontas) => (
    <>
      <Bloco volume={QUARTO} cores={PAREDE} />
      {prontas.has('segundo-andar') ? null : cobertura(QUARTO, 1.4, TELHADO)}
      <Porta cor={cor('etiqueta-azul')} parede="esquerda" em={0} ao={[-2.35, -1.7]} z={[0, 1.5]} />
      <Janela {...JANELA_DO_COMODO.quarto} />
      <Escadinha />
    </>
  ),
  sala: (prontas) => (
    <>
      <Bloco volume={SALA} cores={PAREDE} />
      {prontas.has('biblioteca') ? null : cobertura(SALA, 1.2, TELHADO_ROSA)}
      <Janela {...JANELA_DO_COMODO.sala} />
      {/* Floreira sob a janela. */}
      <Faces faces={caixa({ u: [-5.2, -3.8], v: [-0.4, -0.2], z: [0.4, 0.62] }, MADEIRA)} traco={3} />
      {[-5, -4.5, -4].map((u) => {
        const flor = projetar([u, -0.2, 0.72]);
        return <circle key={u} cx={flor.x} cy={flor.y} r="6" fill={cor('etiqueta-rosa')} stroke={CONTORNO} strokeWidth="2" />;
      })}
    </>
  ),
  cozinha: (prontas) => (
    <>
      <Bloco volume={COZINHA} cores={PAREDE} />
      {prontas.has('escritorio') ? null : cobertura(COZINHA, 1.1, TELHADO)}
      <Janela {...JANELA_DO_COMODO.cozinha} />
      <Janela parede="esquerda" em={-0.4} ao={[0.25, 0.75]} z={[1, 1.75]} />
    </>
  ),
  banheiro: (prontas) => (
    <>
      <Bloco volume={BANHEIRO} cores={{ esquerda: mistura('ceu', 70, 'etiqueta-cinza'), direita: cor('ceu') }} />
      {prontas.has('estudio') ? null : cobertura(BANHEIRO, 0.7, TELHADO_AZUL)}
      <Janela {...JANELA_DO_COMODO.banheiro} />
      <Porta cor={cor('agua')} parede="esquerda" em={1.1} ao={[1.45, 2.05]} z={[0, 1.05]} />
    </>
  ),
  'segundo-andar': () => {
    const volume: Volume = { u: [-3, 0], v: [-3, 0], z: [2.6, 4.8] };
    return (
      <>
        <Bloco volume={volume} cores={PAREDE} />
        <Faces faces={caixa({ u: [-3.1, 0.1], v: [-3.1, 0.1], z: [2.5, 2.68] }, MADEIRA)} />
        {cobertura(volume, 1.6, TELHADO)}
        <Janela parede="esquerda" em={0} ao={[-2.5, -1.75]} z={[3.25, 4.2]} />
        <Janela parede="esquerda" em={0} ao={[-1.25, -0.5]} z={[3.25, 4.2]} />
      </>
    );
  },
  biblioteca: (prontas) => (
    <Andar volume={{ ...SALA, z: [2.4, 4.4] }} base="sala" prontas={prontas} telhadoDe={TELHADO_ROSA} janela={JANELA_DO_COMODO.biblioteca} />
  ),
  escritorio: (prontas) => (
    <Andar volume={{ ...COZINHA, z: [2.2, 4.1] }} base="cozinha" prontas={prontas} telhadoDe={TELHADO} janela={JANELA_DO_COMODO.escritorio} />
  ),
  estudio: (prontas) => {
    const nota = projetar([2.8, 0.3, 2.35]);
    return (
      <Andar volume={{ ...BANHEIRO, z: [1.5, 3.1] }} base="banheiro" prontas={prontas} telhadoDe={TELHADO_AZUL} janela={JANELA_DO_COMODO.estudio}>
        <g transform={`translate(${nota.x},${nota.y})`}>
          <circle r="7" cy="10" fill={cor('joia-escura')} stroke={CONTORNO} strokeWidth="2" />
          <path d="M6 10v-24l12 5" fill="none" stroke={CONTORNO} strokeWidth="3" strokeLinejoin="round" />
        </g>
      </Andar>
    );
  },
  sotao: () => {
    const volume: Volume = { u: [-2.15, -0.85], v: [-1.2, -0.25], z: [5, 5.85] };
    return (
      <>
        <Faces faces={caixa(volume, PAREDE)} />
        {cobertura(volume, 0.65, TELHADO_ROSA)}
        <Janela parede="esquerda" em={-0.25} ao={[-1.8, -1.2]} z={[5.2, 5.7]} />
      </>
    );
  },
  torre: () => <Torre />,
  observatorio: () => <Observatorio />,
  chamine: (prontas) => <Chamine prontas={prontas} />,
} as const satisfies Partial<Record<ParteId, Arte>>;
