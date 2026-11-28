import { SapoRosto } from '@/mascot';

type TrilhaProps = { ids: readonly string[]; atual: number };

/** As vitórias-régias do progresso, com o sapinho na folha do passo atual. */
export function Trilha({ ids, atual }: TrilhaProps) {
  const fracao = ids.length > 1 ? atual / (ids.length - 1) : 0;
  return (
    <div role="progressbar" aria-label="Passos" aria-valuemin={1} aria-valuemax={ids.length} aria-valuenow={atual + 1} className="onboarding-trilha relative flex h-[34px] flex-1 items-center justify-between">
      {ids.map((id, i) => (
        <span
          key={id}
          aria-hidden="true"
          className={`relative h-[15px] w-6 rounded-[50%] border-[2.5px] border-contorno transition-[scale,background-color] duration-300 ${i <= atual ? 'bg-[#79c94a]' : 'bg-[#c9d8b8]'} ${i === atual ? 'scale-125' : ''}`}
        />
      ))}
      {/* A folha tem 24 px: o sapinho (32 px) anda no mesmo intervalo, 4 px antes dela. */}
      <span aria-hidden="true" className="onboarding-sapinho pointer-events-none absolute -top-[15px] w-8" style={{ left: `calc((100% - 24px) * ${fracao} - 4px)` }}>
        <SapoRosto className="block w-full" />
      </span>
    </div>
  );
}
