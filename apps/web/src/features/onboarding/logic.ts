import { ONBOARDING_PADRAO, NOME_PADRAO_DO_SAPO, type DadosDoOnboarding } from '../app/core';

export const MAXIMO_DE_HABITOS = 3;
/** Como o sapo chama quem não disse o nome. */
export const SEM_NOME = 'você';

export const PERIODOS = [
  { id: 'manha', icone: '🌅', titulo: 'Manhã', resumo: 'manhã', comentario: 'Madrugador! Vou guardar os focos mais pesados para cedo.' },
  { id: 'tarde', icone: '☀️', titulo: 'Tarde', resumo: 'tarde', comentario: 'Tarde produtiva, anotado.' },
  { id: 'noite', icone: '🌙', titulo: 'Noite', resumo: 'noite', comentario: 'Coruja da lagoa! Respeito.' },
  { id: 'varia', icone: '🎲', titulo: 'Varia', resumo: 'horários variados', comentario: 'Tranquilo, vou aprendendo com você.' },
] as const;

export const TRAVAS = [
  { id: 'comecar', icone: '🐢', titulo: 'Começar', detalhe: 'Enrolo para dar o primeiro passo' },
  { id: 'distracao', icone: '📱', titulo: 'Distração', detalhe: 'Celular, abas, barulho' },
  { id: 'cansaco', icone: '🥱', titulo: 'Cansaço', detalhe: 'Fico sem energia no meio' },
  { id: 'excesso', icone: '🌊', titulo: 'Coisa demais', detalhe: 'Não sei por onde ir' },
] as const;

export const TONS = [
  { id: 'leve', icone: '🌸', titulo: 'Com carinho', detalhe: '"Bora dar um pulinho hoje?"', resumo: 'com carinho' },
  { id: 'direto', icone: '🎯', titulo: 'Direto ao ponto', detalhe: '"Hora do foco: 25 minutos."', resumo: 'direto' },
] as const;

export const DURACOES_DO_FOCO = [
  { minutos: 15, titulo: 'Curtinho' },
  { minutos: 25, titulo: 'Clássico' },
  { minutos: 45, titulo: 'Longo' },
] as const;

export const HABITOS_SUGERIDOS = [
  { icone: '💧', titulo: 'Beber água' },
  { icone: '🧘', titulo: 'Alongar' },
  { icone: '📖', titulo: 'Ler 10 minutos' },
  { icone: '🚶', titulo: 'Caminhar' },
  { icone: '🌙', titulo: 'Dormir no horário' },
  { icone: '📝', titulo: 'Planejar o dia' },
  { icone: '🧠', titulo: 'Estudar' },
  { icone: '🍎', titulo: 'Comer uma fruta' },
] as const;

export const NOMES_DE_SAPO = ['Pulo', 'Bolota', 'Girino', 'Coaxo'] as const;

export type PeriodoDeRendimento = (typeof PERIODOS)[number]['id'];
export type Trava = (typeof TRAVAS)[number]['id'];
export type TomDoLembrete = (typeof TONS)[number]['id'];
export type DuracaoDoFoco = (typeof DURACOES_DO_FOCO)[number]['minutos'];
export type HabitoSugerido = (typeof HABITOS_SUGERIDOS)[number]['titulo'];

export interface RespostasDoOnboarding {
  nome: string;
  sobrenome: string;
  startHour: number;
  endHour: number;
  periodo: PeriodoDeRendimento | null;
  travas: readonly Trava[];
  tom: TomDoLembrete | null;
  focoMinutos: DuracaoDoFoco | null;
  habitos: readonly HabitoSugerido[];
  nomeDoSapo: string;
  /** Consentimento para o Pulo aprender: nasce desligado. */
  aprender: boolean;
}

/** Respostas em branco; o nome da conta, se houver, já vem separado em nome e sobrenome. */
export function respostasIniciais(nomeDaConta = ''): RespostasDoOnboarding {
  const [nome = '', ...resto] = nomeDaConta.trim().split(/\s+/);
  return {
    nome,
    sobrenome: resto.join(' '),
    startHour: ONBOARDING_PADRAO.startHour,
    endHour: ONBOARDING_PADRAO.endHour,
    periodo: null,
    travas: [],
    tom: null,
    focoMinutos: null,
    habitos: [],
    nomeDoSapo: '',
    aprender: false,
  };
}

/** Marca o item, ou desmarca se já estava marcado. Cheio (`maximo`), não entra mais nenhum. */
export function alternar<T>(lista: readonly T[], item: T, maximo = Number.POSITIVE_INFINITY): readonly T[] {
  if (lista.includes(item)) return lista.filter((outro) => outro !== item);
  return lista.length < maximo ? [...lista, item] : lista;
}

export function comoChamar(respostas: RespostasDoOnboarding): string {
  return respostas.nome.trim() || SEM_NOME;
}

export function nomeDoSapoEscolhido(respostas: RespostasDoOnboarding): string {
  return respostas.nomeDoSapo.trim() || NOME_PADRAO_DO_SAPO;
}

export function contarFolhas(quantas: number): string {
  return `${quantas} ${quantas === 1 ? 'folha' : 'folhas'}`;
}

/** O que o app já sabe guardar. */
export function dadosParaConcluir(respostas: RespostasDoOnboarding): DadosDoOnboarding {
  // As demais respostas ficam só no estado da tela: o envio delas entra na etapa do backend.
  return { frogName: nomeDoSapoEscolhido(respostas), startHour: respostas.startHour, endHour: respostas.endHour };
}
