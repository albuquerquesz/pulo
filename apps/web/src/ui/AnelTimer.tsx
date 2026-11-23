import { useTheme } from '@/theme/useTheme';

import { Texto } from './Texto';

export type EstadoDoAnel = 'parado' | 'rodando' | 'pausa' | 'concluido';

export type AnelTimerProps = {
  /** Tempo restante e total, em ms. O anel só desenha; quem conta o tempo é o domínio. */
  remainingMs: number;
  totalMs: number;
  estado: EstadoDoAnel;
  tamanho?: number;
  testID?: string;
};

export function formatarTempo(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const ROTULO: Record<EstadoDoAnel, string> = {
  parado: 'Pronto para começar',
  rodando: 'Em foco',
  pausa: 'Pausado',
  concluido: 'Concluído',
};

const TRACO: Record<EstadoDoAnel, string> = {
  parado: 'stroke-agua',
  rodando: 'stroke-foco',
  pausa: 'stroke-descanso',
  concluido: 'stroke-sapo',
};

const TRACO_BORDA: Record<EstadoDoAnel, string> = {
  parado: 'stroke-agua-borda',
  rodando: 'stroke-foco-borda',
  pausa: 'stroke-descanso-borda',
  concluido: 'stroke-sapo-borda',
};

export function descricaoDoAnel(remainingMs: number, estado: EstadoDoAnel) {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const tempo = estado === 'concluido' ? 'tempo concluído' : `${m} minutos e ${s} segundos restantes`;
  return `Timer, ${tempo}, ${ROTULO[estado].toLowerCase()}`;
}

function fracaoDoAnel(remainingMs: number, totalMs: number, estado: EstadoDoAnel) {
  if (estado === 'parado' || estado === 'concluido') return 1;
  if (totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, remainingMs / totalMs));
}

export function AnelTimer({ remainingMs, totalMs, estado, tamanho = 240, testID }: AnelTimerProps) {
  const t = useTheme();
  const espessura = Math.max(10, tamanho * 0.075);
  const r = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * r;
  const centro = tamanho / 2;
  // o timer atualiza a cada segundo: um deslizar linear de 1 s deixa o anel contínuo
  const duracao = estado === 'rodando' ? 1000 : t.movimento.slow;
  const transicao = `stroke-dashoffset ${duracao}ms ${estado === 'rodando' ? 'linear' : 'cubic-bezier(0.33, 1, 0.68, 1)'}`;

  return (
    <div className="relative" style={{ width: tamanho, height: tamanho }} role="timer" aria-label={descricaoDoAnel(remainingMs, estado)} data-testid={testID}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden>
        <circle cx={centro} cy={centro} r={r} className="stroke-line" strokeWidth={espessura} fill="none" />
        <circle
          cx={centro}
          cy={centro}
          r={r}
          className={TRACO[estado]}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - fracaoDoAnel(remainingMs, totalMs, estado))}
          style={{ transition: transicao }}
          fill="none"
          transform={`rotate(-90 ${centro} ${centro})`}
        />
        <circle cx={centro} cy={centro} r={r - espessura * 0.85} className={TRACO_BORDA[estado]} strokeOpacity={0.18} strokeWidth={2} fill="none" />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
        {estado === 'concluido' ? (
          <svg width={tamanho * 0.22} height={tamanho * 0.22} viewBox="0 0 24 24" aria-hidden>
            <path d="M4 12.5 L10 18 L20 6" className="stroke-sapo-borda" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        ) : (
          <Texto tabular className="font-extrabold" style={{ fontSize: tamanho * 0.22, lineHeight: `${tamanho * 0.26}px` }}>
            {formatarTempo(remainingMs)}
          </Texto>
        )}
        <Texto variante="legenda" cor="muted">
          {ROTULO[estado]}
        </Texto>
      </div>
    </div>
  );
}
