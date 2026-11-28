import { ACCOUNT, ACHIEVEMENTS, PREFERENCES } from '@pulo/core/config/decisions';
import { verConquistas } from '@pulo/core/domain/achievements';
import { verCasa } from '@pulo/core/domain/casa';
import { verEstatisticas } from '@pulo/core/domain/stats';
import { verSequencia } from '@pulo/core/domain/streak';
import type { Achievement, AchievementId, Clock, MascotState, Preferences, ProfileStats, Repository } from '@pulo/core/domain/types';

import { verPreferencias } from '../app/conta';

/** De quanto em quanto andam as opções de hora e de duração. */
const PASSO_DO_LEMBRETE = 30;
/** O lembrete é da noite: as opções começam no fim da tarde. */
const PRIMEIRO_LEMBRETE = 17 * 60;
const MINUTOS_DO_DIA = 24 * 60;

export const SEM_LEMBRETE = 'desligado';

export interface Opcao {
  valor: string;
  rotulo: string;
}

/** "06h00". */
export function horario(minutos: number): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(Math.floor(minutos / 60))}h${dois(minutos % 60)}`;
}

/** Os valores de `de` a `ate`, mais o atual se ele estiver fora do passo. */
function serie(de: number, ate: number, passo: number, atual: number): number[] {
  const valores = Array.from({ length: Math.floor((ate - de) / passo) + 1 }, (_, i) => de + i * passo);
  return valores.includes(atual) ? valores : [...valores, atual].sort((a, b) => a - b);
}

const comoOpcao = (rotulo: (n: number) => string) => (n: number): Opcao => ({ valor: String(n), rotulo: rotulo(n) });

export const opcoesDeComecoDoDia = (atual: number): Opcao[] => serie(0, MINUTOS_DO_DIA - 120, 60, atual).map(comoOpcao(horario));

export function opcoesDeLembrete(lembrete: Preferences['eveningReminder']): Opcao[] {
  const atual = lembrete.ligado ? lembrete.minutos : PREFERENCES.eveningReminderMinutes;
  const horas = serie(PRIMEIRO_LEMBRETE, MINUTOS_DO_DIA - PASSO_DO_LEMBRETE, PASSO_DO_LEMBRETE, atual);
  return [{ valor: SEM_LEMBRETE, rotulo: 'Desligado' }, ...horas.map(comoOpcao(horario))];
}

export function lembreteEscolhido(valor: string, atual: Preferences['eveningReminder']): Preferences['eveningReminder'] {
  return valor === SEM_LEMBRETE ? { ligado: false, minutos: atual.minutos } : { ligado: true, minutos: Number(valor) };
}

/** "Desde setembro de 2026", no fuso da pessoa. */
export function desdeQuando(desde: number, fuso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, month: 'long', year: 'numeric' }).format(desde);
  return `Desde ${partes}`;
}

/** "02/10", no fuso da pessoa. */
function diaEMes(instante: number, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit' }).format(instante);
}

/** "1.240". */
export const numero = (n: number): string => n.toLocaleString('pt-BR');

export const diasDeCuidado = (dias: number): string => `${dias} ${dias === 1 ? 'dia' : 'dias'} de cuidado`;

interface TextoDaRegra {
  /** O que precisa ser feito. */
  pedido: (meta: number) => string;
  /** Quanto já andou. */
  andamento: (progresso: number, meta: number) => string;
}

const sequencia: TextoDaRegra = {
  pedido: (meta) => `${meta} dias seguidos`,
  andamento: (progresso, meta) => `${progresso} de ${meta} dias seguidos`,
};

/** Regra de contagem: "10 tarefas concluídas" e "3 de 10 tarefas concluídas". */
const contagem = (coisas: string): TextoDaRegra => ({
  pedido: (meta) => `${meta} ${coisas}`,
  andamento: (progresso, meta) => `${progresso} de ${meta} ${coisas}`,
});

const TEXTOS: Record<AchievementId, TextoDaRegra> = {
  'primeira-semana': sequencia,
  'foco-profundo': {
    pedido: (meta) => `1 sessão de ${meta} min`,
    andamento: (progresso, meta) => `${progresso} de ${meta} min numa sessão`,
  },
  'descanso-sabido': {
    pedido: (meta) => `${meta} descansos marcados sem culpa`,
    andamento: (progresso, meta) => `${progresso} de ${meta} descansos marcados`,
  },
  'mes-de-fogo': sequencia,
  'dois-andares': {
    pedido: () => 'o segundo andar da casa',
    andamento: () => 'Construa o segundo andar',
  },
  'cinco-comodos': {
    pedido: (meta) => `${meta} cômodos na casa`,
    andamento: (progresso, meta) => `${progresso} de ${meta} cômodos`,
  },
  'casa-inteira': {
    pedido: (meta) => `${meta} partes da casa`,
    andamento: (progresso, meta) => `${progresso} de ${meta} partes construídas`,
  },
  'gelo-na-hora': {
    pedido: (meta) => (meta === 1 ? 'o primeiro gelo usado' : `${meta} gelos usados`),
    andamento: (progresso, meta) => `${progresso} de ${meta} ${meta === 1 ? 'gelo usado' : 'gelos usados'}`,
  },
  'primeiro-foco': { pedido: () => 'o primeiro foco concluído', andamento: () => 'Conclua seu primeiro foco' },
  'vinte-cinco-focos': contagem('focos concluídos'),
  'dez-horas': contagem('horas de foco'),
  madrugador: contagem('focos de manhã'),
  'habito-firme': contagem('vezes no mesmo hábito'),
  'cem-marcas': contagem('marcações de hábito'),
  'dez-tarefas': contagem('tarefas concluídas'),
  'cinquenta-tarefas': contagem('tarefas concluídas'),
  'primeira-meta': { pedido: () => 'a primeira meta concluída', andamento: () => 'Conclua sua primeira meta' },
  'dez-marcos': contagem('marcos de meta'),
  'quinhentas-joias': contagem('joias ganhas'),
  'quarto-decorado': contagem('itens de decoração'),
  'cem-dias': sequencia,
  segredo: { pedido: () => 'Segredo revelado', andamento: () => 'Continue cuidando do sapo' },
};

export interface Medalha {
  id: AchievementId;
  nome: string;
  detalhe: string;
  /** `secreta`: a que ainda é segredo. */
  estado: 'conquistada' | 'andando' | 'secreta';
  progresso: number;
  meta: number;
}

const comMaiuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);

export function medalha(conquista: Achievement, fuso: string): Medalha {
  const crua = montarMedalha(conquista, fuso);
  return { ...crua, detalhe: comMaiuscula(crua.detalhe) };
}

function montarMedalha(conquista: Achievement, fuso: string): Medalha {
  const { id, progresso, meta, conquistada, conquistadaEm } = conquista;
  const secreta = !conquistada && ACHIEVEMENTS.some((c) => c.id === id && c.secreta);
  const comum = { id, progresso, meta };
  if (secreta) return { ...comum, estado: 'secreta', nome: 'Segredo', detalhe: TEXTOS.segredo.andamento(progresso, meta) };
  const nome = conquista.nome ?? '';
  if (!conquistada) return { ...comum, estado: 'andando', nome, detalhe: TEXTOS[id].andamento(progresso, meta) };
  const quando = conquistadaEm === undefined ? 'conquistada' : `conquistada em ${diaEMes(conquistadaEm, fuso)}`;
  return { ...comum, estado: 'conquistada', nome, detalhe: `${TEXTOS[id].pedido(meta)} · ${quando}` };
}

/** Nome obrigatório e curto; foto só por endereço `https` (regra da API). Devolve o texto do erro ou `null`. */
export function erroDaConta(nome: string, foto: string): string | null {
  const limpo = nome.trim();
  if (!limpo) return 'Escreva seu nome.';
  if (limpo.length > ACCOUNT.nameMaxChars) return `Use até ${ACCOUNT.nameMaxChars} letras no nome.`;
  const endereco = foto.trim();
  if (!endereco) return null;
  if (endereco.length > ACCOUNT.imageUrlMaxChars || !URL.canParse(endereco) || new URL(endereco).protocol !== 'https:') {
    return 'A foto precisa ser um endereço que começa com https.';
  }
  return null;
}

export const podeExcluir = (texto: string): boolean => texto.trim() === ACCOUNT.deleteConfirmation;


export interface DadosDoPerfil {
  sequencia: { atual: number; recorde: number };
  estatisticas: ProfileStats;
  sapo: MascotState | null;
  saldo: number;
  conquistas: Achievement[];
  preferencias: Preferences;
}

export async function carregarPerfil(repo: Repository, clock: Clock): Promise<DadosDoPerfil> {
  const [sequencia, estatisticas, sapo, casa, conquistas, preferencias] = await Promise.all([
    verSequencia(repo, clock),
    verEstatisticas(repo),
    repo.getMascotState(),
    verCasa(repo),
    verConquistas(repo, clock),
    verPreferencias(repo),
  ]);
  if (!estatisticas) throw new Error('sem usuário');
  return { sequencia, estatisticas, sapo, saldo: casa.saldo, conquistas, preferencias };
}
