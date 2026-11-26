import { useId, useState } from 'react';

import { GELO } from '@pulo/core/config/decisions';
import { verCasa } from '@pulo/core/domain/casa';
import { comprarGelo, validarCompraDeGelo, verGelo } from '@pulo/core/domain/gelo';

import { Joia } from '@/ui';

import { useApp, useCarregar } from '../app';
import { MENSAGENS_DE_ERRO } from './erros';
import { Floco } from './Floco';

/** O gelo à venda: quantos há, o máximo, o preço e a compra com joias. */
export function CartaoDoGelo() {
  const { repo, clock, refresh, mostrarAviso } = useApp();
  const { estado, recarregar } = useCarregar(async () => {
    const [gelo, casa] = await Promise.all([verGelo(repo, clock), verCasa(repo)]);
    return gelo ? { gelo, saldo: casa.saldo } : null;
  });
  /** O que a tela mostra enquanto o servidor responde: um gelo a mais e as joias a menos. */
  const [pedido, setPedido] = useState<{ guardados: number; saldo: number } | null>(null);
  const motivoId = useId();
  if (estado.tipo === 'erro') {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 font-black">
        Não consegui ver seus gelos.
        <button type="button" onClick={() => void recarregar()} className="cursor-pointer underline">
          Tentar de novo
        </button>
      </div>
    );
  }
  if (estado.tipo !== 'ok' || !estado.dados) return null;

  const { gelo, saldo: saldoAtual } = estado.dados;
  const { guardados, saldo } = pedido ?? { guardados: gelo.guardados, saldo: saldoAtual };
  const regra = validarCompraDeGelo(guardados, saldo);
  const motivo = pedido || regra.ok ? null : regra.error.message;
  const bloqueado = pedido !== null || !regra.ok;

  const comprar = async () => {
    if (bloqueado) return;
    setPedido({ guardados: guardados + 1, saldo: saldo - GELO.preco });
    try {
      const resultado = await comprarGelo(repo, clock);
      if (!resultado.ok) {
        const { code, message } = resultado.error;
        mostrarAviso({ mensagem: code === 'indisponivel' ? message : MENSAGENS_DE_ERRO[code], variante: 'atencao' });
      }
    } catch {
      // O repositório da conta já avisou o que houve.
    } finally {
      await recarregar();
      setPedido(null);
      refresh();
    }
  };

  return (
    <section aria-label="Gelo" className="flex w-full shrink-0 flex-col gap-2 rounded-[18px] border-4 border-contorno bg-creme p-3 text-contorno shadow-[inset_0_-5px_0_var(--pulo-agua)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl border-4 border-contorno bg-agua">
          <Floco className="size-8" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] font-black tracking-wider uppercase">Gelo</b>
          <span className="block text-[13px] font-extrabold">{`Você tem ${guardados} de ${gelo.max}`}</span>
          <span className="block text-xs">{`Salva sozinho um dia vazio. Joias: ${saldo}`}</span>
        </div>
        <button
          type="button"
          aria-label={`Comprar gelo por ${GELO.preco} joias`}
          aria-disabled={bloqueado}
          aria-describedby={motivo ? motivoId : undefined}
          onClick={() => void comprar()}
          className="min-h-11 cursor-pointer rounded-[14px] border-4 border-contorno bg-lima-clara px-3.5 py-2 text-sm font-black tracking-wide uppercase shadow-[inset_0_-5px_0_var(--pulo-lima)] aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          Comprar{' '}
          <span className="ml-1.5 inline-flex items-center gap-1">
            <Joia />
            {GELO.preco}
          </span>
        </button>
      </div>
      {motivo ? (
        <p id={motivoId} className="text-center text-[13px] font-extrabold">
          {motivo}
        </p>
      ) : null}
    </section>
  );
}
