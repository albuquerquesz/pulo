import { MENSAGEM_LOGIN } from '../sessao/auth';

const CANCELADO = 'O login com Google foi cancelado. Tente de novo quando quiser.';
const CONEXAO = 'Não consegui entrar com o Google. Volte ao app que pediu o acesso e conecte de novo.';

/** Mensagem para quem voltou do Google com erro (`?erro=`, e `error=` do Better Auth); `null` sem erro na URL. */
export function erroDoLoginNaUrl(busca: string): string | null {
  const parametros = new URLSearchParams(busca);
  const motivo = parametros.get('erro');
  if (motivo === null && !parametros.has('error')) return null;
  if (motivo === 'conexao') return CONEXAO;
  return parametros.get('error') === 'access_denied' ? CANCELADO : MENSAGEM_LOGIN;
}
