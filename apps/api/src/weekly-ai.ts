/**
 * Função de servidor da IA semanal (spec 08). Agnóstica de provedor.
 *
 * - O app chama POST com { summary, candidates, tone } (ver src/domain/ia/request.ts).
 * - Este arquivo valida o corpo (schema zod estrito), monta o prompt, chama um
 *   `ProviderAdapter` e valida a saída antes de devolver.
 * - A CHAVE do provedor só existe aqui, lida do ambiente do Worker
 *   (PULO_AI_PROVIDER como var e PULO_AI_API_KEY como secret). Nunca vai para o app nem
 *   para o repositório. Sem chave, `createProviderFromEnv` usa o provedor FALSO.
 * - Provedor, modelo e hospedagem são decisão aberta do Victor. Para ligar um
 *   provedor real, implemente `ProviderAdapter` num arquivo novo e registre em
 *   `createProviderFromEnv`. Nenhum SDK de IA está instalado.
 */
import { WEEKLY_AI } from '@pulo/core/config/decisions';
import { validateAiOutput } from '@pulo/core/domain/ia/validate';
import { AI_TONES } from '@pulo/core/domain/ia/limits';
import type { WeeklyAiClient } from '@pulo/core/domain/ia/client';
import type { WeeklyAiRequest } from '@pulo/core/domain/ia/request';
import { z } from 'zod';

export interface ProviderAdapter {
  /** Recebe o prompt e devolve o texto bruto do modelo (esperado: JSON). */
  complete(prompt: { system: string; user: string }): Promise<string>;
}

export interface ServerRequest {
  method: string;
  body: unknown;
}
export interface ServerResponse {
  status: number;
  body: unknown;
}

export const SYSTEM_PROMPT = [
  'Você ajuda uma pessoa a ajustar a rotina de foco da semana, em português do Brasil, com tom leve e sem cobrança.',
  'Você recebe números agregados e uma lista de candidatas de mudança já válidas.',
  'Escolha UMA candidata pelo índice e escreva duas frases curtas: o padrão notado e o motivo.',
  'Não invente horários e não escreva horários nos textos. Não fale de saúde, diagnóstico, tratamento nem emoções clínicas.',
  'Não use linguagem de culpa ou cobrança.',
  'Responda somente com JSON: {"candidata_escolhida": número, "padrao": texto, "motivo": texto, "tom": "leve"|"neutro"|"acolhedor"}.',
].join('\n');

const count = z.number().finite().nonnegative();
const periodSchema = z.enum(['manha', 'tarde', 'noite']);
const byPeriod = <S extends z.ZodType>(value: S) => z.strictObject({ manha: value, tarde: value, noite: value });
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slot = z.strictObject({
  weekday: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  startMinutes: count,
  durationMinutes: count,
});

/** Exatamente o que `buildAiRequest` monta: campo a mais, texto livre ou tipo errado é recusado. */
const requestSchema = z.strictObject({
  summary: z.strictObject({
    weekStart: dateKey,
    weekEnd: dateKey,
    focusMinutesByPeriod: byPeriod(count),
    sessionsByPeriod: byPeriod(z.strictObject({ completed: count, interrupted: count, completionRate: count.nullable() })),
    totalSessions: count,
    restDays: count,
    careDays: count,
    daysWithRecord: count,
    stable: z.boolean(),
  }),
  candidates: z
    .array(
      z.strictObject({
        index: count,
        kind: z.enum(['mover_foco', 'encurtar_foco']),
        fromPeriod: periodSchema,
        toPeriod: periodSchema,
        from: slot,
        to: slot,
      }),
    )
    .min(1)
    .max(3),
  tone: z.enum(AI_TONES),
}) satisfies z.ZodType<WeeklyAiRequest>;

/** Aceita só o formato esperado; qualquer outra coisa (texto livre, campos extras) é rejeitada. */
export function parseRequestBody(body: unknown): WeeklyAiRequest | null {
  const parsed = requestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Janela em curso de cada endereço. Vive na memória do processo: no Worker, cada instância conta a sua. */
const janelas = new Map<string, { inicio: number; pedidos: number }>();

/** Limite simples da rota aberta: `false` quando o endereço já passou dos pedidos da janela. */
export function dentroDoLimite(endereco: string, now: number): boolean {
  const { maxPedidos, janelaMs } = WEEKLY_AI.rotaAberta;
  for (const [chave, janela] of janelas) if (now - janela.inicio >= janelaMs) janelas.delete(chave);
  const atual = janelas.get(endereco) ?? { inicio: now, pedidos: 0 };
  janelas.set(endereco, { ...atual, pedidos: atual.pedidos + 1 });
  return atual.pedidos < maxPedidos;
}

export function buildPrompt(req: WeeklyAiRequest): { system: string; user: string } {
  // Só dados agregados: o corpo já passou por parseRequestBody.
  const user = JSON.stringify({ resumo: req.summary, candidatas: req.candidates, tom: req.tone });
  return { system: SYSTEM_PROMPT, user };
}

export async function handleWeeklyAi(
  request: ServerRequest,
  deps: { provider: ProviderAdapter | null },
): Promise<ServerResponse> {
  if (request.method !== 'POST') return { status: 405, body: { error: 'metodo' } };
  const req = parseRequestBody(request.body);
  if (!req) return { status: 400, body: { error: 'corpo_invalido' } };
  if (!deps.provider) return { status: 502, body: { error: 'provedor' } };
  let text: string;
  try {
    text = await deps.provider.complete(buildPrompt(req));
  } catch {
    return { status: 502, body: { error: 'provedor' } };
  }
  const v = validateAiOutput(text, req.candidates.length);
  if (!v.ok) return { status: 502, body: { error: 'resposta_invalida', reason: v.reason } };
  return { status: 200, body: v.value };
}

/** Provedor falso: escolhe a primeira candidata, com texto fixo e seguro. Para dev e testes. */
export class FakeProvider implements ProviderAdapter {
  readonly prompts: { system: string; user: string }[] = [];
  constructor(private readonly override?: (prompt: { system: string; user: string }) => string) {}
  async complete(prompt: { system: string; user: string }): Promise<string> {
    this.prompts.push(prompt);
    if (this.override) return this.override(prompt);
    return JSON.stringify({
      candidata_escolhida: 0,
      padrao: 'Alguns períodos renderam menos que outros nesta semana',
      motivo: 'Um pequeno ajuste pode deixar o foco mais leve',
      tom: 'leve',
    });
  }
}

/**
 * Escolhe o provedor pelo ambiente do servidor. Variáveis do Worker, nunca commitadas:
 *   PULO_AI_PROVIDER  nome do provedor (vazio ou "fake" usa o provedor falso)
 *   PULO_AI_API_KEY   chave do provedor (secret: npx wrangler secret put PULO_AI_API_KEY)
 * Provedor real ainda não implementado: decisão aberta do Victor.
 */
export type AiEnv = {
  PULO_AI_PROVIDER?: string;
  PULO_AI_API_KEY?: string;
};

export function createProviderFromEnv(env: AiEnv): ProviderAdapter {
  const name = env.PULO_AI_PROVIDER;
  if (!name || name === 'fake') return new FakeProvider();
  if (!env.PULO_AI_API_KEY) throw new Error('PULO_AI_API_KEY ausente no ambiente do servidor');
  throw new Error(`Provedor "${name}" ainda não implementado`);
}

/**
 * Liga o provedor ao pipeline do core (`generateWeeklyProposal`), no servidor: o cliente recebe SÓ o corpo montado por
 * `buildAiRequest` (resumo agregado e candidatas sem id de bloco nem título) e devolve o texto cru do modelo, que o core valida.
 */
export function providerAsClient(provider: ProviderAdapter): WeeklyAiClient {
  return { suggest: (request) => provider.complete(buildPrompt(request)) };
}

/**
 * A IA só entra na geração de propostas quando o ambiente pede (`PULO_AI_PROVIDER` preenchido, ou um provedor injetado).
 * Sem isso vale só a regra e a proposta é rotulada "Sugestão": o provedor falso nunca se passa por IA em produção.
 */
export function aiClientFromEnv(env: AiEnv, provider: ProviderAdapter | null): WeeklyAiClient | null {
  return env.PULO_AI_PROVIDER && provider ? providerAsClient(provider) : null;
}

/**
 * Como `createProviderFromEnv`, sem derrubar a API: ambiente mal configurado só avisa no log e fica sem IA
 * (vale a regra; o provedor falso nunca se passa por IA).
 */
export function providerFromEnvOrNull(env: AiEnv): ProviderAdapter | null {
  try {
    return createProviderFromEnv(env);
  } catch (error) {
    console.warn('provedor_de_ia_indisponivel', error instanceof Error ? error.message : error);
    return null;
  }
}
