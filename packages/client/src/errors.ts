import { type ApiErrorBody, type ApiErrorCode, apiErrorSchema } from '@pulo/core/api/schemas';

/** Texto da tela de "sem conexão" (o mesmo do app: a lagoa ficou sem sinal). */
export const MENSAGEM_SEM_SINAL = 'A lagoa ficou sem sinal. Confira a internet e tente de novo.';

/** Mensagem em português para cada código da API (docs/api.md). `satisfies` garante que nenhum código fique sem texto. */
export const MENSAGENS_DA_API = {
  nao_autenticado: 'Sua sessão acabou. Entre de novo para continuar.',
  origem_nao_permitida: 'Este endereço do app não tem permissão para falar com o servidor.',
  origem_ausente: 'Não consegui confirmar de onde veio o pedido. Recarregue a página e tente de novo.',
  corpo_invalido: 'Alguma informação não ficou certa. Confira os campos e tente de novo.',
  consulta_invalida: 'Não consegui entender esse pedido. Tente de novo.',
  parametro_invalido: 'Não consegui entender esse pedido. Tente de novo.',
  id_divergente: 'Algo saiu errado ao salvar. Tente de novo.',
  data_divergente: 'Algo saiu errado ao salvar. Tente de novo.',
  horario_no_futuro: 'O relógio do aparelho parece adiantado. Acerte a hora e tente de novo.',
  nao_encontrado: 'Não encontrei isso na sua conta.',
  referencia_inexistente: 'Isso depende de algo que não existe mais. Atualize a tela e tente de novo.',
  rota_inexistente: 'Esta versão do app não conversa com o servidor. Atualize o app.',
  conflito_de_id: 'Algo saiu errado ao salvar. Tente de novo.',
  limite_por_dia: 'Um dia comporta poucos hábitos. Que tal deixar um para outro dia?',
  limite_de_metas: 'Já tem metas ativas demais. Conclua ou apague uma para abrir espaço.',
  sessao_em_andamento: 'Já existe um foco em andamento.',
  sessao_encerrada: 'Esse foco já terminou e não pode mais mudar.',
  sessao_imutavel: 'Um foco em andamento não pode mudar de horário ou duração.',
  proposta_transicao_invalida: 'Essa sugestão já foi decidida.',
  proposta_imutavel: 'Essa sugestão não pode mais ser alterada.',
  semana_ja_tem_proposta: 'Essa semana já tem uma sugestão.',
  bloco_mudou: 'Seu bloco mudou desde que a ideia foi feita. Atualize a semana para ver uma nova.',
  horario_ocupado: 'Esse horário já está ocupado. Tente outro.',
  conflito_concorrente: 'Duas mudanças aconteceram ao mesmo tempo. Tente de novo.',
  erro_interno: 'O servidor tropeçou. Tente de novo daqui a pouco.',
} as const satisfies Record<ApiErrorCode, string>;

/**
 * Tipos de falha que a tela sabe tratar:
 * - `rede`: a requisição nem chegou (sem internet, servidor fora do ar);
 * - `sessao`: 401, a pessoa precisa entrar de novo;
 * - `api`: o servidor recusou com um código conhecido;
 * - `resposta_invalida`: o servidor respondeu algo fora do contrato.
 */
export type RemoteErrorKind = 'rede' | 'sessao' | 'api' | 'resposta_invalida';

export interface RemoteErrorInit {
  kind: RemoteErrorKind;
  /** Texto pronto para mostrar, em português. */
  mensagem: string;
  /** Status HTTP, quando houve resposta. */
  status?: number;
  /** Código da API, quando o corpo seguia o contrato. */
  code?: ApiErrorCode;
  issues?: ApiErrorBody['issues'];
  cause?: unknown;
}

export class RemoteError extends Error {
  readonly kind: RemoteErrorKind;
  readonly mensagem: string;
  readonly status: number | undefined;
  readonly code: ApiErrorCode | undefined;
  readonly issues: ApiErrorBody['issues'];

  constructor(init: RemoteErrorInit) {
    super(init.mensagem, { cause: init.cause });
    this.name = 'RemoteError';
    this.kind = init.kind;
    this.mensagem = init.mensagem;
    this.status = init.status;
    this.code = init.code;
    this.issues = init.issues;
  }

  /** Vale tentar de novo sem mudar nada (rede ou servidor). */
  get transitorio(): boolean {
    return this.kind === 'rede' || this.code === 'erro_interno' || this.code === 'conflito_concorrente';
  }
}

export function isRemoteError(error: unknown): error is RemoteError {
  return error instanceof RemoteError;
}

/** Texto em português para qualquer erro que chegue à tela. */
export function mensagemDeErro(error: unknown): string {
  return error instanceof RemoteError ? error.mensagem : MENSAGEM_SEM_SINAL;
}

export function networkError(cause: unknown): RemoteError {
  return new RemoteError({ kind: 'rede', mensagem: MENSAGEM_SEM_SINAL, cause });
}

/** Lê o corpo de uma resposta que não é 2xx e devolve o erro tipado. */
export async function errorFromResponse(response: { status: number; json(): Promise<unknown> }): Promise<RemoteError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  if (!parsed.success) {
    return new RemoteError({
      kind: 'resposta_invalida',
      status: response.status,
      mensagem: MENSAGENS_DA_API.erro_interno,
    });
  }
  const { error: code, issues } = parsed.data;
  return new RemoteError({
    kind: code === 'nao_autenticado' ? 'sessao' : 'api',
    status: response.status,
    code,
    issues,
    // O texto do app, não o do servidor: o código é o contrato estável.
    mensagem: MENSAGENS_DA_API[code],
  });
}
