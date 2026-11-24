import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DEFAULT_DAY_END_HOUR, DEFAULT_DAY_START_HOUR, DEFAULT_TIMEZONE, FOCUS } from '@pulo/core/config/decisions';
import { dateKeyOf, weekdayOf, weekStartOf } from '@pulo/core/domain/day';
import { concluirFoco, iniciarFoco, interromperFoco, pausarFoco, retomarFoco } from '@pulo/core/domain/foco';
import {
  adicionarMarco,
  alternarMarco,
  apagarMeta,
  concluirMeta,
  criarMeta,
  daysUntilTarget,
  editarMeta,
  goalProgress,
  reabrirMeta,
  removerMarco,
  sortGoals,
} from '@pulo/core/domain/goals';
import { type EstadoDaIlha, comprarNaIlha, verIlha } from '@pulo/core/domain/ilha';
import { criarHabito, desmarcarHabito, editarHabito, habitsForDate, marcarHabito, removerHabito } from '@pulo/core/domain/habits';
import {
  blocksForWeekday,
  concluirBloco,
  criarBloco,
  criarPlanoInicial,
  editarBloco,
  registrarDescanso,
  removerBloco,
} from '@pulo/core/domain/routine';
import type { Clock, DateKey, Goal, Habit, Repository, RoutineBlock, User, Weekday } from '@pulo/core/domain/types';
import { type ProposalDecisionBody, generateProposalResponseSchema } from '@pulo/core/api/schemas';
import { z } from 'zod';
import { ErroDaApi, type ClienteInterno, lerJson } from './repositorio';

/** O que cada ferramenta recebe: a pessoa do token já resolvida em repositório e cliente da API. */
export interface ContextoMcp {
  repo: Repository;
  api: ClienteInterno;
  clock: Clock;
}

// ---------- Formatos legíveis para a IA ----------

const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const;
type NomeDoDia = (typeof DIAS)[number];
const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const diaSchema = z.enum(DIAS).describe('Dia da semana');
const horaSchema = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'use HH:MM, por exemplo 09:30')
  .describe('Horário no formato HH:MM, 24 horas');
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD').describe('Data no formato AAAA-MM-DD');
const idSchema = z.string().min(1).describe('Identificador devolvido pelas ferramentas de leitura');

const nomeDoDia = (weekday: Weekday): NomeDoDia => DIAS[weekday];
const weekdayDe = (nome: NomeDoDia): Weekday => WEEKDAYS[DIAS.indexOf(nome)];
const paraMinutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};
const paraHora = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

const bloco = (b: RoutineBlock) => ({
  id: b.id,
  dia: nomeDoDia(b.weekday),
  inicio: paraHora(b.startMinutes),
  fim: paraHora(b.startMinutes + b.durationMinutes),
  minutos: b.durationMinutes,
  tipo: b.kind,
  ...(b.title ? { titulo: b.title } : {}),
});

const habito = (h: Habit) => ({ id: h.id, titulo: h.title, dias: h.weekdays.map(nomeDoDia), ativo: h.active });

const meta = (g: Goal, hoje: DateKey) => ({
  id: g.id,
  titulo: g.title,
  ...(g.why ? { porque: g.why } : {}),
  ...(g.targetDate ? { prazo: g.targetDate, diasAtePrazo: daysUntilTarget(g, hoje) } : {}),
  estado: g.state,
  progresso: goalProgress(g),
  marcos: g.milestones.map((m) => ({ id: m.id, titulo: m.title, feito: m.doneAt !== undefined })),
});

const ilha = (e: EstadoDaIlha) => ({
  saldo: e.saldo,
  ganhas: e.ganhas,
  gastas: e.gastas,
  nivel: e.nivel,
  areas: e.areas.map((a) => ({
    id: a.id,
    nome: a.nome,
    custo: a.custo,
    estado: a.estado,
    enfeites: a.enfeitesNoMapa.map((en) => ({ id: en.id, nome: en.nome, custo: en.custo, comprado: en.comprado })),
  })),
});

// ---------- Respostas ----------

const resposta = (dados: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(dados, null, 2) }] });
const falha = (mensagem: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text: mensagem }] });

type ResultadoDeCaso = { ok: true } | { ok: false; error: { message: string } };
const deCaso = (r: ResultadoDeCaso, dados: () => unknown): CallToolResult => (r.ok ? resposta(dados()) : falha(r.error.message));

/** Erro de regra vira resposta de erro legível; o resto sobe (vira erro do protocolo). */
async function protegido(acao: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await acao();
  } catch (erro) {
    if (erro instanceof ErroDaApi) return falha(erro.message);
    if (erro instanceof SemPerfil) return falha(erro.message);
    throw erro;
  }
}

class SemPerfil extends Error {
  constructor() {
    super('Esta conta ainda não tem sapo. Use concluir_onboarding primeiro.');
  }
}

async function pessoa(repo: Repository): Promise<User> {
  const user = await repo.getUser();
  if (!user) throw new SemPerfil();
  return user;
}

const hojeDe = (user: User, clock: Clock) => dateKeyOf(clock.now(), user.timezone);

const DECISOES_SIMPLES = {
  aceitar: { action: 'aceitar' },
  negar: { action: 'negar' },
  desfazer: { action: 'desfazer' },
} as const satisfies Record<string, ProposalDecisionBody>;

const LEITURA = { readOnlyHint: true, openWorldHint: false } as const;
const ESCRITA = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DESTRUTIVA = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

/** Registra no servidor MCP as mesmas operações que as telas do app oferecem. */
export function registrarFerramentas(server: McpServer, { repo, api, clock }: ContextoMcp): void {
  // ---------- Leitura ----------

  server.registerTool(
    'ver_hoje',
    {
      title: 'Ver o dia de hoje',
      description: 'O dia de hoje: hábitos (feitos ou não), blocos da rotina, foco em andamento, descanso e o sapo.',
      annotations: LEITURA,
    },
    () =>
      protegido(async () => {
        const user = await pessoa(repo);
        const hoje = hojeDe(user, clock);
        const [habits, logs, blocks, sessions, restDays, mascot] = await Promise.all([
          repo.listHabits(),
          repo.listHabitLogs({ from: hoje, to: hoje }),
          repo.listBlocks(),
          repo.listSessions(),
          repo.listRestDays(),
          repo.getMascotState(),
        ]);
        const feitos = new Set(logs.map((l) => l.habitId));
        const ativa = sessions.find((s) => s.state === 'em_andamento');
        return resposta({
          data: hoje,
          dia: nomeDoDia(weekdayOf(hoje)),
          habitos: habitsForDate(habits, hoje).map((h) => ({ id: h.id, titulo: h.title, feito: feitos.has(h.id) })),
          blocos: blocksForWeekday(blocks, weekdayOf(hoje)).map(bloco),
          focoEmAndamento: ativa
            ? { id: ativa.id, minutosPlanejados: ativa.plannedMinutes, pausado: ativa.pausedSince !== undefined, inicio: new Date(ativa.startedAt).toISOString() }
            : null,
          diaDeDescanso: restDays.some((r) => r.date === hoje),
          sapo: { nome: user.frogName, fase: mascot?.phase ?? 1, diasDeCuidado: mascot?.careDays ?? 0 },
        });
      }),
  );

  server.registerTool(
    'ver_rotina',
    { title: 'Ver a rotina', description: 'Todos os blocos da semana (foco e descanso) e todos os hábitos, com ids.', annotations: LEITURA },
    () =>
      protegido(async () => {
        await pessoa(repo);
        const [blocks, habits] = await Promise.all([repo.listBlocks(), repo.listHabits()]);
        return resposta({ blocos: blocks.map(bloco), habitos: habits.map(habito) });
      }),
  );

  server.registerTool(
    'ver_semana',
    {
      title: 'Ver a semana',
      description: 'Resumo da semana (minutos de foco, sessões, descansos, dias de cuidado) e as propostas de ajuste da rotina.',
      inputSchema: { data: dataSchema.optional().describe('Qualquer dia da semana desejada. Padrão: hoje.') },
      annotations: LEITURA,
    },
    ({ data }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const dia = data ?? hojeDe(user, clock);
        const { summary } = await lerJson(await api.api['week-summary'].$get({ query: { date: dia } }));
        const semana = weekStartOf(dia);
        const propostas = (await repo.listProposals()).filter((p) => p.weekStart === semana);
        return resposta({ resumo: summary, propostas });
      }),
  );

  server.registerTool(
    'ver_metas',
    { title: 'Ver as metas', description: 'Metas de longo prazo: ativas e concluídas, com marcos, progresso e prazo.', annotations: LEITURA },
    () =>
      protegido(async () => {
        const user = await pessoa(repo);
        const hoje = hojeDe(user, clock);
        return resposta({ metas: sortGoals(await repo.listGoals()).map((g) => meta(g, hoje)) });
      }),
  );

  server.registerTool(
    'ver_perfil',
    { title: 'Ver o perfil', description: 'Nome do sapo, início e fim do dia, tema e fuso.', annotations: LEITURA },
    () =>
      protegido(async () => {
        const user = await pessoa(repo);
        return resposta({
          nomeDoSapo: user.frogName,
          inicioDoDia: paraHora(user.dayStartMinutes),
          fimDoDia: paraHora(user.dayEndMinutes % (24 * 60)),
          tema: user.theme,
          reduzirMovimento: user.reduceMotion,
          fuso: user.timezone,
        });
      }),
  );

  // ---------- Onboarding e perfil ----------

  server.registerTool(
    'concluir_onboarding',
    {
      title: 'Criar o sapo',
      description: 'Primeiro passo de uma conta nova: dá nome ao sapo, define o dia e cria o plano de exemplo (blocos e 2 hábitos).',
      inputSchema: {
        nomeDoSapo: z.string().max(24).optional(),
        inicioDoDia: z.number().int().min(0).max(22).optional().describe(`Hora cheia. Padrão ${DEFAULT_DAY_START_HOUR}.`),
        fimDoDia: z.number().int().min(1).max(24).optional().describe(`Hora cheia. Padrão ${DEFAULT_DAY_END_HOUR}.`),
      },
      annotations: ESCRITA,
    },
    ({ nomeDoSapo, inicioDoDia, fimDoDia }) =>
      protegido(async () => {
        if (await repo.getUser()) return falha('Esta conta já tem sapo.');
        const now = clock.now();
        const inicio = inicioDoDia ?? DEFAULT_DAY_START_HOUR;
        const fim = Math.max(inicio + 1, fimDoDia ?? DEFAULT_DAY_END_HOUR);
        await repo.saveUser({
          id: '',
          frogName: nomeDoSapo?.trim() || 'Pulo',
          timezone: DEFAULT_TIMEZONE,
          dayStartMinutes: inicio * 60,
          dayEndMinutes: fim * 60,
          theme: 'sistema',
          reduceMotion: false,
          createdAt: now,
        });
        const plano = await criarPlanoInicial(repo, now);
        return resposta({ criado: true, blocos: plano.blocks.length, habitos: plano.habits.length });
      }),
  );

  server.registerTool(
    'atualizar_perfil',
    {
      title: 'Atualizar o perfil',
      description: 'Muda o nome do sapo, o início ou fim do dia, o tema ou o reduzir movimento.',
      inputSchema: {
        nomeDoSapo: z.string().min(1).max(24).optional(),
        inicioDoDia: z.number().int().min(0).max(22).optional().describe('Hora cheia'),
        fimDoDia: z.number().int().min(1).max(24).optional().describe('Hora cheia'),
        tema: z.enum(['claro', 'escuro', 'sistema']).optional(),
        reduzirMovimento: z.boolean().optional(),
      },
      annotations: ESCRITA,
    },
    (entrada) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const next: User = {
          ...user,
          ...(entrada.nomeDoSapo ? { frogName: entrada.nomeDoSapo.trim() } : {}),
          ...(entrada.inicioDoDia === undefined ? {} : { dayStartMinutes: entrada.inicioDoDia * 60 }),
          ...(entrada.fimDoDia === undefined ? {} : { dayEndMinutes: entrada.fimDoDia * 60 }),
          ...(entrada.tema ? { theme: entrada.tema } : {}),
          ...(entrada.reduzirMovimento === undefined ? {} : { reduceMotion: entrada.reduzirMovimento }),
        };
        if (next.dayEndMinutes <= next.dayStartMinutes) return falha('O fim do dia precisa ser depois do início.');
        await repo.saveUser(next);
        return resposta({ atualizado: true });
      }),
  );

  // ---------- Hábitos ----------

  server.registerTool(
    'criar_habito',
    {
      title: 'Criar hábito',
      description: 'Cria um hábito em alguns dias da semana. Cada dia comporta até 5 hábitos ativos.',
      inputSchema: { titulo: z.string().min(1).max(80), dias: z.array(diaSchema).min(1) },
      annotations: ESCRITA,
    },
    ({ titulo, dias }) =>
      protegido(async () => {
        await pessoa(repo);
        const r = await criarHabito(repo, { title: titulo, weekdays: dias.map(weekdayDe) }, clock.now());
        return deCaso(r, () => r.ok && habito(r.value));
      }),
  );

  server.registerTool(
    'editar_habito',
    {
      title: 'Editar hábito',
      description: 'Muda título, dias ou pausa (ativo = false) um hábito.',
      inputSchema: { id: idSchema, titulo: z.string().min(1).max(80).optional(), dias: z.array(diaSchema).min(1).optional(), ativo: z.boolean().optional() },
      annotations: ESCRITA,
    },
    ({ id, titulo, dias, ativo }) =>
      protegido(async () => {
        await pessoa(repo);
        const r = await editarHabito(repo, id, {
          ...(titulo ? { title: titulo } : {}),
          ...(dias ? { weekdays: dias.map(weekdayDe) } : {}),
          ...(ativo === undefined ? {} : { active: ativo }),
        });
        return deCaso(r, () => r.ok && habito(r.value));
      }),
  );

  server.registerTool(
    'remover_habito',
    { title: 'Remover hábito', description: 'Apaga o hábito e as marcações dele.', inputSchema: { id: idSchema }, annotations: DESTRUTIVA },
    ({ id }) =>
      protegido(async () => {
        await pessoa(repo);
        await removerHabito(repo, id);
        return resposta({ removido: id });
      }),
  );

  server.registerTool(
    'marcar_habito',
    {
      title: 'Marcar hábito como feito',
      description: 'Marca (ou desmarca, com feito = false) um hábito num dia. Padrão: hoje.',
      inputSchema: { id: idSchema, feito: z.boolean().default(true), data: dataSchema.optional() },
      annotations: ESCRITA,
    },
    ({ id, feito, data }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const dia = data ?? hojeDe(user, clock);
        if (!feito) {
          await desmarcarHabito(repo, id, dia);
          return resposta({ habito: id, data: dia, feito: false });
        }
        const r = await marcarHabito(repo, id, dia, clock.now());
        return deCaso(r, () => ({ habito: id, data: dia, feito: true }));
      }),
  );

  // ---------- Rotina (blocos) ----------

  const blocoEntrada = {
    dia: diaSchema,
    inicio: horaSchema,
    minutos: z.number().int().min(5).max(120).describe('Duração, de 5 a 120 minutos'),
    tipo: z.enum(['foco', 'descanso']),
    titulo: z.string().min(1).max(80).optional(),
  };

  server.registerTool(
    'criar_bloco',
    { title: 'Criar bloco', description: 'Cria um bloco de foco ou descanso na rotina semanal (sem sobrepor outro).', inputSchema: blocoEntrada, annotations: ESCRITA },
    ({ dia, inicio, minutos, tipo, titulo }) =>
      protegido(async () => {
        await pessoa(repo);
        const r = await criarBloco(
          repo,
          { weekday: weekdayDe(dia), startMinutes: paraMinutos(inicio), durationMinutes: minutos, kind: tipo, ...(titulo ? { title: titulo } : {}) },
          clock.now(),
        );
        return deCaso(r, () => r.ok && bloco(r.value));
      }),
  );

  server.registerTool(
    'editar_bloco',
    {
      title: 'Editar ou mover bloco',
      description: 'Muda dia, horário, duração, tipo ou título de um bloco.',
      inputSchema: {
        id: idSchema,
        dia: diaSchema.optional(),
        inicio: horaSchema.optional(),
        minutos: blocoEntrada.minutos.optional(),
        tipo: blocoEntrada.tipo.optional(),
        titulo: blocoEntrada.titulo,
      },
      annotations: ESCRITA,
    },
    ({ id, dia, inicio, minutos, tipo, titulo }) =>
      protegido(async () => {
        await pessoa(repo);
        const r = await editarBloco(repo, id, {
          ...(dia ? { weekday: weekdayDe(dia) } : {}),
          ...(inicio ? { startMinutes: paraMinutos(inicio) } : {}),
          ...(minutos ? { durationMinutes: minutos } : {}),
          ...(tipo ? { kind: tipo } : {}),
          ...(titulo ? { title: titulo } : {}),
        });
        return deCaso(r, () => r.ok && bloco(r.value));
      }),
  );

  server.registerTool(
    'remover_bloco',
    { title: 'Remover bloco', description: 'Tira o bloco da rotina (sessões de foco já feitas ficam).', inputSchema: { id: idSchema }, annotations: DESTRUTIVA },
    ({ id }) =>
      protegido(async () => {
        await pessoa(repo);
        await removerBloco(repo, id);
        return resposta({ removido: id });
      }),
  );

  server.registerTool(
    'criar_plano_de_exemplo',
    { title: 'Criar plano de exemplo', description: 'Cria blocos de foco nos dias úteis e 2 hábitos, como o app faz numa rotina vazia.', annotations: ESCRITA },
    () =>
      protegido(async () => {
        await pessoa(repo);
        const plano = await criarPlanoInicial(repo, clock.now());
        return resposta({ blocos: plano.blocks.map(bloco), habitos: plano.habits.map(habito) });
      }),
  );

  // ---------- Foco ----------

  server.registerTool(
    'comecar_foco',
    {
      title: 'Começar um foco',
      description: `Começa uma sessão de foco (Pomodoro), livre ou de um bloco. De ${FOCUS.minMinutes} a ${FOCUS.maxMinutes} minutos, padrão ${FOCUS.defaultMinutes}.`,
      inputSchema: {
        minutos: z.number().int().min(FOCUS.minMinutes).max(FOCUS.maxMinutes).optional(),
        blocoId: idSchema.optional().describe('Bloco de foco da rotina, se for o foco de um bloco'),
      },
      annotations: ESCRITA,
    },
    ({ minutos, blocoId }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const r = await iniciarFoco(repo, clock, user.timezone, { ...(minutos ? { plannedMinutes: minutos } : {}), ...(blocoId ? { blockId: blocoId } : {}) });
        return deCaso(r, () => r.ok && { sessao: r.value.session.id, minutos: r.value.session.plannedMinutes });
      }),
  );

  const acoesDeFoco = { pausar: pausarFoco, retomar: retomarFoco, interromper: interromperFoco, concluir: concluirFoco } as const;
  server.registerTool(
    'controlar_foco',
    {
      title: 'Pausar, retomar ou encerrar o foco',
      description: 'Age sobre o foco em andamento. "concluir" só fecha se o tempo já acabou; "interromper" para agora.',
      inputSchema: { acao: z.enum(['pausar', 'retomar', 'interromper', 'concluir']) },
      annotations: ESCRITA,
    },
    ({ acao }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const r = await acoesDeFoco[acao](repo, clock, user.timezone);
        return deCaso(r, () => r.ok && { estado: r.value.session.state, encerrou: r.value.ended, contaComoCuidado: r.value.countsAsCare });
      }),
  );

  // ---------- Descanso ----------

  server.registerTool(
    'dia_de_descanso',
    {
      title: 'Dia de descanso',
      description: 'Marca (ou desfaz, com descanso = false) um dia de descanso. Padrão: hoje. Descanso também conta como cuidado.',
      inputSchema: { descanso: z.boolean().default(true), data: dataSchema.optional() },
      annotations: ESCRITA,
    },
    ({ descanso, data }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const dia = data ?? hojeDe(user, clock);
        if (descanso) await registrarDescanso(repo, dia);
        else await repo.deleteRestDay(dia);
        return resposta({ data: dia, descanso });
      }),
  );

  server.registerTool(
    'concluir_bloco_de_descanso',
    { title: 'Concluir bloco de descanso', description: 'Marca um bloco de descanso de hoje como feito.', inputSchema: { id: idSchema }, annotations: ESCRITA },
    ({ id }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const r = await concluirBloco(repo, id, hojeDe(user, clock));
        return deCaso(r, () => r.ok && { descansoRegistrado: r.value.restDayCreated });
      }),
  );

  // ---------- Propostas da semana ----------

  server.registerTool(
    'gerar_proposta_da_semana',
    {
      title: 'Gerar proposta da semana',
      description: 'Analisa a semana e propõe mover ou encurtar focos que não renderam. Nada muda na rotina até a proposta ser aceita.',
      inputSchema: { data: dataSchema.optional().describe('Qualquer dia da semana. Padrão: hoje.') },
      annotations: ESCRITA,
    },
    ({ data }) =>
      protegido(async () => {
        await pessoa(repo);
        const gerada = await api.api.proposals.generate.$post({ json: data ? { date: data } : {} });
        return resposta(generateProposalResponseSchema.parse(await lerJson<unknown>(gerada)));
      }),
  );

  server.registerTool(
    'decidir_proposta',
    {
      title: 'Decidir proposta',
      description: 'Aceita, nega ou desfaz uma proposta da semana; "editar" troca o horário de destino de uma mudança.',
      inputSchema: {
        id: idSchema,
        acao: z.enum(['aceitar', 'negar', 'desfazer', 'editar']),
        mudanca: z
          .object({ indice: z.number().int().min(0), dia: diaSchema, inicio: horaSchema, minutos: z.number().int().min(5).max(120) })
          .optional()
          .describe('Só para "editar": qual mudança e o novo horário'),
      },
      annotations: ESCRITA,
    },
    ({ id, acao, mudanca }) =>
      protegido(async () => {
        await pessoa(repo);
        const decidir = async (decisao: ProposalDecisionBody) => {
          const r = await lerJson(await api.api.proposals[':id'].decision.$post({ param: { id }, json: decisao }));
          return resposta({ proposta: r.proposal, blocos: r.blocks.map(bloco) });
        };
        if (acao !== 'editar') return decidir(DECISOES_SIMPLES[acao]);
        if (!mudanca) return falha('Para editar, diga qual mudança e o novo horário.');
        const to = { weekday: weekdayDe(mudanca.dia), startMinutes: paraMinutos(mudanca.inicio), durationMinutes: mudanca.minutos };
        return decidir({ action: 'editar', change: { index: mudanca.indice, to } });
      }),
  );

  // ---------- Metas ----------

  server.registerTool(
    'criar_meta',
    {
      title: 'Criar meta',
      description: 'Cria uma meta de longo prazo (meses ou anos), com porquê, prazo e marcos opcionais. Até 3 ativas.',
      inputSchema: {
        titulo: z.string().min(1).max(80),
        porque: z.string().max(200).optional(),
        prazo: dataSchema.optional(),
        marcos: z.array(z.string().min(1).max(80)).max(12).optional(),
      },
      annotations: ESCRITA,
    },
    ({ titulo, porque, prazo, marcos }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const hoje = hojeDe(user, clock);
        const r = await criarMeta(repo, { title: titulo, why: porque, targetDate: prazo, milestones: marcos }, clock.now(), hoje);
        return deCaso(r, () => r.ok && meta(r.value, hoje));
      }),
  );

  server.registerTool(
    'editar_meta',
    {
      title: 'Editar meta',
      description: 'Muda título, porquê ou prazo de uma meta. Campos omitidos ficam como estão; porque ou prazo vazios ("") apagam.',
      inputSchema: { id: idSchema, titulo: z.string().min(1).max(80).optional(), porque: z.string().max(200).optional(), prazo: z.union([dataSchema, z.literal('')]).optional() },
      annotations: ESCRITA,
    },
    ({ id, titulo, porque, prazo }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const hoje = hojeDe(user, clock);
        const atual = (await repo.listGoals()).find((g) => g.id === id);
        if (!atual) return falha('Essa meta não existe mais.');
        const r = await editarMeta(
          repo,
          id,
          { title: titulo ?? atual.title, why: porque ?? atual.why, targetDate: prazo === undefined ? atual.targetDate : prazo || undefined },
          hoje,
        );
        return deCaso(r, () => r.ok && meta(r.value, hoje));
      }),
  );

  server.registerTool(
    'mexer_em_marco',
    {
      title: 'Adicionar, riscar ou remover marco',
      description: 'Adiciona um marco a uma meta, risca/desrisca um marco ou remove um marco.',
      inputSchema: {
        metaId: idSchema,
        acao: z.enum(['adicionar', 'alternar', 'remover']),
        titulo: z.string().min(1).max(80).optional().describe('Só para adicionar'),
        marcoId: idSchema.optional().describe('Para alternar ou remover'),
      },
      annotations: ESCRITA,
    },
    ({ metaId, acao, titulo, marcoId }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const hoje = hojeDe(user, clock);
        if (acao === 'adicionar' && !titulo) return falha('Diga o título do marco.');
        if (acao !== 'adicionar' && !marcoId) return falha('Diga qual marco (marcoId).');
        const r =
          acao === 'adicionar'
            ? await adicionarMarco(repo, metaId, titulo ?? '', clock.now())
            : acao === 'alternar'
              ? await alternarMarco(repo, metaId, marcoId ?? '', clock.now())
              : await removerMarco(repo, metaId, marcoId ?? '');
        return deCaso(r, () => r.ok && meta(r.value, hoje));
      }),
  );

  server.registerTool(
    'concluir_ou_reabrir_meta',
    {
      title: 'Concluir ou reabrir meta',
      description: 'Conclui uma meta (vai para Conquistas) ou reabre uma concluída.',
      inputSchema: { id: idSchema, acao: z.enum(['concluir', 'reabrir']) },
      annotations: ESCRITA,
    },
    ({ id, acao }) =>
      protegido(async () => {
        const user = await pessoa(repo);
        const r = acao === 'concluir' ? await concluirMeta(repo, id, clock.now()) : await reabrirMeta(repo, id);
        return deCaso(r, () => r.ok && meta(r.value, hojeDe(user, clock)));
      }),
  );

  server.registerTool(
    'apagar_meta',
    { title: 'Apagar meta', description: 'Apaga uma meta e os marcos dela. Não dá para desfazer.', inputSchema: { id: idSchema }, annotations: DESTRUTIVA },
    ({ id }) =>
      protegido(async () => {
        await pessoa(repo);
        await apagarMeta(repo, id);
        return resposta({ apagada: id });
      }),
  );

  // ---------- Ilha ----------

  server.registerTool(
    'ver_ilha',
    {
      title: 'Ver a ilha',
      description:
        'A ilha do sapo: saldo de moscas (e de onde vieram), áreas na ordem do mapa (aberta, próxima ou fechada) e enfeites com preço e se já foram comprados.',
      annotations: LEITURA,
    },
    () =>
      protegido(async () => {
        await pessoa(repo);
        return resposta(ilha(await verIlha(repo)));
      }),
  );

  server.registerTool(
    'comprar_na_ilha',
    {
      title: 'Comprar na ilha',
      description:
        'Gasta moscas para abrir a próxima área ou comprar um enfeite de uma área aberta. Use os ids de ver_ilha. Compras não podem ser desfeitas.',
      inputSchema: { item: idSchema.describe('Id da área ou do enfeite, como aparece em ver_ilha') },
      annotations: ESCRITA,
    },
    ({ item }) =>
      protegido(async () => {
        await pessoa(repo);
        const r = await comprarNaIlha(repo, clock, item);
        return deCaso(r, () => r.ok && ilha(r.value));
      }),
  );

  // ---------- Dados ----------

  server.registerTool(
    'apagar_todos_os_dados',
    {
      title: 'Apagar todos os dados',
      description:
        'Apaga sapo, rotina, hábitos, focos, descansos, propostas, metas e compras da ilha da conta, em todos os aparelhos. Não dá para desfazer. Só use se a pessoa pediu explicitamente.',
      inputSchema: { confirmacao: z.literal('APAGAR TUDO').describe('Escreva exatamente APAGAR TUDO') },
      annotations: DESTRUTIVA,
    },
    () =>
      protegido(async () => {
        await repo.clearAll();
        return resposta({ apagado: true });
      }),
  );
}

