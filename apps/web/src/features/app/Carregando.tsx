import { SapoRosto } from '@/mascot';
import { Texto } from '@/ui';

/** Enquanto o app abre (ou tenta de novo): o sapo no meio do fundo, no lugar de uma tela em branco. */
export function Carregando() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div role="status" className="flex flex-col items-center gap-3">
        <div aria-hidden="true">
          <SapoRosto className="w-[120px]" />
        </div>
        <Texto cor="muted">Carregando…</Texto>
      </div>
    </main>
  );
}
