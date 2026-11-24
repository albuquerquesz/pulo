import { type ApiErrorBody, type ApiErrorCode, apiErrorSchema } from '@pulo/core/api/schemas';
import type { WeeklyAiClient } from '@pulo/core/domain/ia/client';
import { type UserMetadata, readUserMetadata } from '@pulo/core/domain/user-metadata';
import { type Db, Prisma } from '@pulo/db';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import { z } from 'zod';
import type { Auth } from './auth';

/** Cliente do Prisma ou o de dentro de uma transação interativa. */
export type Client = Db | Prisma.TransactionClient;

/** O que cada rota de domínio recebe: tudo injetado, nada global. */
export interface RouteDeps {
  auth: Auth;
  /** Um cliente por requisição (o Worker cria e fecha). */
  db: Db;
  now: () => number;
  /** IA da proposta semanal: `client` é `null` quando o ambiente não pede IA (vale só a regra). `timeoutMs` padrão é `WEEKLY_AI.timeoutMs`. */
  ai: { client: WeeklyAiClient | null; timeoutMs?: number };
  /** Id de proposta nova (injetável nos testes). */
  newId: (now: number) => string;
}

/** Pessoa da sessão, lida UMA vez por requisição pelo middleware (sem query extra por rota). */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  metadata: UserMetadata;
}

/**
 * `usuarioInterno` só existe quando a própria API se chama por dentro (o servidor MCP, depois de verificar o token OAuth):
 * vem do segundo argumento de `app.fetch`, que nenhuma requisição de fora consegue preencher.
 */
export type AppEnv = { Variables: { user: SessionUser }; Bindings: { usuarioInterno?: () => Promise<SessionUser | null> } | undefined };

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

/** Erro esperado: vira JSON `{ error, message? }` com o status certo, sem stack trace. */
export class ApiError extends Error {
  constructor(
    readonly status: ErrorStatus,
    readonly code: ApiErrorCode,
    message?: string,
    readonly issues?: ApiErrorBody['issues'],
  ) {
    super(message ?? code);
  }
}

/** Exige sessão do Better Auth (ou a pessoa já verificada pelo MCP) e guarda em `c.var.user`. Toda rota de domínio passa por aqui. */
export function requireSession(auth: Auth) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const interno = c.env?.usuarioInterno;
    const user = interno ? await interno() : await userDaSessao(auth, c.req.raw.headers);
    if (!user) throw new ApiError(401, 'nao_autenticado', 'Entre na sua conta para continuar.');
    c.set('user', user);
    await next();
  });
}

async function userDaSessao(auth: Auth, headers: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const { id, name, email, image, metadata } = session.user;
  return { id, name, email, image: image ?? null, metadata: readUserMetadata(metadata) };
}

// ---------- Validação com zod ----------

function parseWith<S extends z.ZodType>(schema: S, value: unknown, code: ApiErrorCode): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }));
  throw new ApiError(400, code, 'Dados inválidos.', issues);
}

/** Corpo JSON validado; o tipo do corpo vem do schema (e chega ao cliente `hc`). */
export const jsonBody = <S extends z.ZodType>(schema: S) =>
  validator('json', (value) => parseWith(schema, value, 'corpo_invalido'));

export const queryParams = <S extends z.ZodType>(schema: S) =>
  validator('query', (value) => parseWith(schema, value, 'consulta_invalida'));

export const pathParams = <S extends z.ZodType>(schema: S) =>
  validator('param', (value) => parseWith(schema, value, 'parametro_invalido'));

// ---------- Erros ----------

function errorBody(error: ApiError): ApiErrorBody {
  return apiErrorSchema.parse({ error: error.code, message: error.message, issues: error.issues });
}

/** Falha de serialização e deadlock: duas escritas ao mesmo tempo, e quem perdeu pode tentar de novo. */
const CONFLITOS_DO_POSTGRES = ['40001', '40P01'];

/** Com o adaptador do Postgres, o código original fica em `meta.driverAdapterError.cause.originalCode`. */
const metaDoAdaptador = z.object({ driverAdapterError: z.object({ cause: z.object({ originalCode: z.string() }) }) });

function codigoDoPostgres(meta: unknown): string | null {
  const lido = metaDoAdaptador.safeParse(meta);
  return lido.success ? lido.data.driverAdapterError.cause.originalCode : null;
}

/**
 * Conflito detectado no COMMIT de uma transação Serializable: o adaptador do Postgres lança `DriverAdapterError`
 * (fora do `PrismaClientKnownRequestError`) com `cause.kind` igual a `TransactionWriteConflict`.
 */
const erroDoAdaptador = z.object({ name: z.literal('DriverAdapterError'), cause: z.object({ kind: z.string() }) });

function ehConflitoNoCommit(error: Error): boolean {
  const lido = erroDoAdaptador.safeParse(error);
  return lido.success && lido.data.cause.kind === 'TransactionWriteConflict';
}

const conflitoConcorrente = () => new ApiError(409, 'conflito_concorrente', 'Outra escrita aconteceu ao mesmo tempo. Tente de novo.');

/** Erros do Prisma que viram resposta de cliente (o resto é 500 sem detalhes). */
function fromPrisma(error: Prisma.PrismaClientKnownRequestError): ApiError | null {
  switch (error.code) {
    case 'P2002':
      return new ApiError(409, 'conflito_de_id', 'Já existe um registro com este identificador.');
    case 'P2003':
      return new ApiError(404, 'referencia_inexistente', 'O registro referenciado não existe.');
    case 'P2034':
      return conflitoConcorrente();
    // Consulta crua (SELECT ... FOR UPDATE numa transação Serializable): o código do Postgres vem do adaptador.
    case 'P2010':
      return CONFLITOS_DO_POSTGRES.includes(codigoDoPostgres(error.meta) ?? '') ? conflitoConcorrente() : null;
    default:
      return null;
  }
}

export function handleError(error: Error, c: Context) {
  if (error instanceof ApiError) return c.json(errorBody(error), error.status);
  // JSON quebrado: o validador do Hono lança HTTPException 400.
  if (error instanceof HTTPException && error.status === 400) {
    return c.json(errorBody(new ApiError(400, 'corpo_invalido', 'JSON inválido.')), 400);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = fromPrisma(error);
    if (mapped) return c.json(errorBody(mapped), mapped.status);
  }
  if (ehConflitoNoCommit(error)) return c.json(errorBody(conflitoConcorrente()), 409);
  // Só o código vai ao cliente; o detalhe fica no log do Worker.
  console.error('erro_interno', error.name, error.message);
  return c.json(errorBody(new ApiError(500, 'erro_interno', 'Algo deu errado. Tente de novo.')), 500);
}

export function handleNotFound(c: Context) {
  return c.json(errorBody(new ApiError(404, 'rota_inexistente', 'Rota inexistente.')), 404);
}

// ---------- Utilidades ----------

/** Tolerância entre o relógio do aparelho e o do servidor para instantes "de agora". */
export const CLOCK_SKEW_MS = 5 * 60_000;

/** Instante informado pelo app não pode estar no futuro (além da tolerância). */
export function assertNotInFuture(value: number | undefined, now: number, field: string): void {
  if (value !== undefined && value > now + CLOCK_SKEW_MS) {
    throw new ApiError(400, 'horario_no_futuro', `${field} está no futuro.`);
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, v]) => [key, canonical(v)]),
    );
  }
  return value;
}

/** Igualdade profunda por valor, ignorando a ordem das chaves e campos `undefined`. */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function requireMatch(pathValue: string, bodyValue: string, code: 'id_divergente' | 'data_divergente'): void {
  if (pathValue !== bodyValue) {
    throw new ApiError(400, code, 'O valor do corpo precisa ser igual ao do caminho.');
  }
}
