/**
 * Função de servidor da IA semanal (spec 08). Agnóstica de provedor.
 *
 * - O app chama POST com { summary, candidates, tone } (ver src/domain/ia/request.ts).
 * - Este arquivo valida o corpo (lista de permissão), monta o prompt, chama um
 *   `ProviderAdapter` e valida a saída antes de devolver.
 * - A CHAVE do provedor só existe aqui, lida do ambiente do Worker
 *   (PULO_AI_PROVIDER como var e PULO_AI_API_KEY como secret). Nunca vai para o app nem
 *   para o repositório. Sem chave, `createProviderFromEnv` usa o provedor FALSO.
 * - Provedor, modelo e hospedagem são decisão aberta do Victor. Para ligar um
 *   provedor real, implemente `ProviderAdapter` num arquivo novo e registre em
 *   `createProviderFromEnv`. Nenhum SDK de IA está instalado.
 */
import { validateAiOutput } from '@pulo/core/domain/ia/validate';
import { AI_TONES } from '@pulo/core/domain/ia/limits';
import type { WeeklyAiRequest } from '@pulo/core/domain/ia/request';

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

const PERIODS = ['manha', 'tarde', 'noite'];
const KINDS = ['mover_foco', 'encurtar_foco'];

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isSlot(v: unknown): boolean {
  const s = v as Record<string, unknown>;
  return !!s && isNum(s.weekday) && isNum(s.startMinutes) && isNum(s.durationMinutes);
}

/** Aceita só o formato esperado; qualquer outra coisa (texto livre, campos extras) é rejeitada. */
export function parseRequestBody(body: unknown): WeeklyAiRequest | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return null;
  const s = b.summary as Record<string, unknown> | undefined;
  if (!s || typeof s !== 'object') return null;
  for (const key of ['focusMinutesByPeriod', 'sessionsByPeriod']) {
    const rec = s[key] as Record<string, unknown> | undefined;
    if (!rec || !PERIODS.every((p) => p in rec)) return null;
  }
  if (!Array.isArray(b.candidates) || b.candidates.length === 0 || b.candidates.length > 3) return null;
  for (const c of b.candidates as Record<string, unknown>[]) {
    if (!c || !KINDS.includes(c.kind as string) || !isSlot(c.from) || !isSlot(c.to)) return null;
    if (!PERIODS.includes(c.fromPeriod as string) || !PERIODS.includes(c.toPeriod as string)) return null;
  }
  if (!(AI_TONES as readonly string[]).includes(b.tone as string)) return null;
  return body as WeeklyAiRequest;
}

export function buildPrompt(req: WeeklyAiRequest): { system: string; user: string } {
  // Só dados agregados: o corpo já passou por parseRequestBody.
  const user = JSON.stringify({ resumo: req.summary, candidatas: req.candidates, tom: req.tone });
  return { system: SYSTEM_PROMPT, user };
}

export async function handleWeeklyAi(
  request: ServerRequest,
  deps: { provider: ProviderAdapter },
): Promise<ServerResponse> {
  if (request.method !== 'POST') return { status: 405, body: { error: 'metodo' } };
  const req = parseRequestBody(request.body);
  if (!req) return { status: 400, body: { error: 'corpo_invalido' } };
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

/** Provedor falso: escolhe a primeira candidata, com texto fixo e seguro. Para dev, testes e demo. */
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
