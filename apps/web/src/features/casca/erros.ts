import { isRemoteError, mensagemDeErro } from '@pulo/client';
import { DESCANSO, GELO } from '@pulo/core/config/decisions';
import type { RestErrorCode } from '@pulo/core/domain/descanso';
import type { FreezeErrorCode } from '@pulo/core/domain/gelo';

type CodigoDaCasca = RestErrorCode | FreezeErrorCode;

/** Os erros do descanso e do gelo em palavras, para a recusa da API e para a regra conferida no app. */
export const MENSAGENS_DE_ERRO: Record<CodigoDaCasca, string> = {
  descanso_so_hoje: 'O descanso vale só para o dia de hoje.',
  limite_de_descanso: `Você já usou os ${DESCANSO.maxPorSemana} descansos desta semana.`,
  joias_insuficientes: 'Ainda faltam joias para isso. Cada hábito e cada foco ajudam a juntar mais.',
  gelo_no_maximo: `Você já guarda ${GELO.maxGuardados} gelos, que é o máximo.`,
};

const temTexto = (codigo: string): codigo is CodigoDaCasca => codigo in MENSAGENS_DE_ERRO;

/** O texto de um erro qualquer: o daqui quando o código tem um; senão o do client. */
export function mensagemNaTela(erro: unknown): string {
  const codigo = isRemoteError(erro) ? erro.code : undefined;
  return codigo && temTexto(codigo) ? MENSAGENS_DE_ERRO[codigo] : mensagemDeErro(erro);
}
