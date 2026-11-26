import { Link } from '@tanstack/react-router';

import type { Period } from '@pulo/core/domain/types';

import { SapoRosto } from '@/mascot';

import { CARTAO } from './estilos';
import { fraseDosPulos, type FocoDoTopo, type PulosDoDia } from './logic';

/** Posições fixas das estrelas, em % do cartão (sem sorteio, para o SSR bater com o cliente). */
const ESTRELAS = [
  [8, 18],
  [14, 60],
  [22, 30],
  [31, 12],
  [38, 48],
  [46, 22],
  [55, 62],
  [63, 16],
  [70, 40],
  [78, 24],
  [86, 56],
  [93, 14],
  [60, 34],
  [27, 70],
] as const;

/** No celular cabem menos folhas na lagoa. */
const FOLHAS_NO_CELULAR = 5;
/** As colunas da lagoa por quantidade de folhas, escritas por extenso para o Tailwind achar as classes. */
const COLUNAS_NO_CELULAR = ['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'];
const COLUNAS_NO_LARGO = ['sm:grid-cols-1', 'sm:grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3', 'sm:grid-cols-4', 'sm:grid-cols-5', 'sm:grid-cols-6', 'sm:grid-cols-7', 'sm:grid-cols-8'];

const BOTAO =
  'flex min-h-11 shrink-0 items-center justify-center rounded-md bg-foco px-[30px] py-4 text-[17px] font-extrabold text-ink-sobre-acao shadow-[inset_0_-4px_0_var(--pulo-foco-borda)] active:translate-y-[3px]';

/** O céu da hora atrás do topo: gradiente, estrelas de noite, uma nuvem passando e o sol ou a lua. */
function Ceu() {
  return (
    <>
      <div aria-hidden="true" className="lagoa-ceu absolute inset-0" />
      <div aria-hidden="true" className="lagoa-estrelas absolute inset-0">
        {ESTRELAS.map(([x, y], i) => (
          <i key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.37}s` }} />
        ))}
      </div>
      <div aria-hidden="true" className="lagoa-nuvem" />
      <div aria-hidden="true" className="lagoa-astro max-md:hidden" />
    </>
  );
}

/** Colinas do bosque, as mesmas da margem da lagoa. */
function Colinas({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={`lagoa-margem ${className}`} viewBox="0 0 1200 64" preserveAspectRatio="none">
      <path d="M0 40 Q200 6 420 30 T860 22 T1200 28 V64 H0Z" />
      <path d="M0 52 Q260 30 560 48 T1200 44 V64 H0Z" />
    </svg>
  );
}

/** Ainda sem hábito: o sapo pede o primeiro num balão, e o botão leva a criar. */
function TopoSemHabitos({ saudacao, periodo }: { saudacao: string; periodo: Period }) {
  return (
    <section aria-label="Primeiro hábito" data-periodo={periodo} className={`${CARTAO} lagoa-topo relative flex min-h-[290px] flex-col overflow-hidden`}>
      <Ceu />
      <Colinas className="absolute inset-x-0 bottom-0 h-20 w-full" />
      <div className="relative z-2 my-auto flex flex-col gap-5 p-5 pb-24 md:flex-row md:items-center md:gap-6 md:px-9 md:pb-[72px]">
        <SapoRosto className="w-28 shrink-0 md:w-[150px]" />
        <div className="lagoa-balao min-w-0 flex-1 md:max-w-[560px]">
          <h1 className="text-2xl leading-tight font-extrabold">{saudacao}</h1>
          <p className="mt-1">Bora criar seu primeiro hábito? Cada um vira uma vitória-régia para eu pular.</p>
        </div>
        <Link to="/habitos" search={{ novo: true }} className={`${BOTAO} md:ml-auto`}>
          + Criar hábito
        </Link>
      </div>
    </section>
  );
}

type TopoProps = {
  saudacao: string;
  periodo: Period;
  semHabitos: boolean;
  foco: FocoDoTopo;
  pulos: PulosDoDia;
};

/** O topo do Hoje: sem hábito, o convite do sapo; com hábito, a lagoa com o céu da hora, os pulos do dia e o botão Começar foco, que abre a Casa já com o próximo foco. */
export function Topo({ saudacao, periodo, semHabitos, foco, pulos }: TopoProps) {
  if (semHabitos) return <TopoSemHabitos saudacao={saudacao} periodo={periodo} />;
  const { folhas, feitos } = pulos;
  // O sapo fica na última folha pulada (a da entrada já conta como pulo).
  const ondeEsta = Math.min(feitos, folhas.length) - 1;
  const colunas = `${COLUNAS_NO_CELULAR[Math.min(folhas.length, FOLHAS_NO_CELULAR)]} ${COLUNAS_NO_LARGO[folhas.length]}`;
  return (
    <section aria-label="Próximo foco" data-periodo={periodo} className={`${CARTAO} lagoa-topo relative flex min-h-[290px] flex-col overflow-hidden`}>
      <Ceu />

      <div className="relative z-2 flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between md:px-9 md:pt-8">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-[1.1] font-extrabold">{saudacao}</h1>
          <p className="lagoa-frase mt-1.5">{fraseDosPulos(pulos)}</p>
        </div>
        <Link to="/casa" search={foco.busca} className={BOTAO}>
          ▶ Começar foco
        </Link>
      </div>

      <div className="relative z-1 mt-auto h-[132px]">
        <Colinas className="absolute inset-x-0 -top-[34px] h-16 w-full" />
        <div aria-hidden="true" className="lagoa-agua absolute inset-x-0 top-[22px] bottom-0" />
        <ol aria-label="Pulos de hoje" className={`absolute inset-0 grid items-center px-3 md:px-[60px] ${colunas}`}>
          {folhas.map((folha, i) => (
            <li
              key={folha.chave}
              data-feito={folha.feito}
              className={`relative grid min-w-0 place-items-center ${i >= FOLHAS_NO_CELULAR ? 'max-sm:hidden' : ''}`}
            >
              {i === ondeEsta ? <span aria-hidden="true" className="lagoa-onda" /> : null}
              <span aria-hidden="true" className="lagoa-folha" style={{ animationDelay: `${i * 0.3}s` }} />
              {i === ondeEsta ? <SapoRosto className="lagoa-sapinho absolute -top-1.5 w-[62px]" /> : null}
              <span className="lagoa-rotulo absolute top-[78px] max-w-full truncate px-1 text-xs font-black">
                {folha.titulo}
                <span className="sr-only">{folha.feito ? ', feito' : ', por fazer'}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
