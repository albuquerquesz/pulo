import { Link } from '@tanstack/react-router';

import { useApp, useCarregar } from '../app';
import { CARTAO, LEGENDA, TITULO } from './estilos';
import { carregarMes } from './mes';

const NUMEROS = [
  { chave: 'diasDeCuidado', legenda: 'dias de cuidado', cor: 'text-ink' },
  { chave: 'descansos', legenda: 'descansos', cor: 'text-descanso' },
  { chave: 'gelosUsados', legenda: 'gelos usados', cor: 'text-agua' },
] as const;

/** O cartão Seu mês: três números do mês e o caminho para as métricas do Perfil. */
export function SeuMes() {
  const { repo, clock, user, versao } = useApp();
  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    return carregarMes(repo, clock, user, versao);
  });
  return (
    <section aria-label="Seu mês" className={`${CARTAO} p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={TITULO}>Seu mês</h2>
        <Link to="/perfil" hash="metricas" className="text-[13px] font-extrabold tracking-wide text-sapo-borda">
          Ver métricas
        </Link>
      </div>
      {estado.tipo === 'erro' ? (
        <div role="alert" className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
          Não consegui somar o seu mês.
          <button type="button" onClick={() => void recarregar()} className="cursor-pointer font-extrabold underline">
            Tentar de novo
          </button>
        </div>
      ) : (
        <dl className="mt-3.5 grid grid-cols-3 gap-3">
          {NUMEROS.map(({ chave, legenda, cor }) => (
            <div key={chave} className="flex min-w-0 flex-col-reverse justify-end">
              <dt className={LEGENDA}>{legenda}</dt>
              <dd className={`text-2xl font-extrabold ${cor}`}>{estado.tipo === 'ok' ? estado.dados[chave] : '…'}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
