import { ONBOARDING_PADRAO, NOME_PADRAO_DO_SAPO, type DadosDoOnboarding } from '../app/core';

export const MAXIMO_DE_HABITOS = 3;
/** Como o sapo chama quem não disse o nome. */
export const SEM_NOME = 'você';

/** O momento de vida: base enxuta para conhecer a pessoa (e, no futuro, enriquecer o perfil). */
export const MOMENTOS = [
  { id: 'estudando', icone: '📚', titulo: 'Estudando', comentario: 'Bora fazer os estudos renderem!' },
  { id: 'trabalhando', icone: '💼', titulo: 'Trabalhando', comentario: 'Vou te ajudar a caber tudo no dia.' },
  { id: 'ambos', icone: '🔀', titulo: 'Estudando e trabalhando', comentario: 'Rotina puxada! A gente vai com calma.' },
  { id: 'transicao', icone: '🧭', titulo: 'Em transição', comentario: 'Fase de mudança, conta comigo.' },
  { id: 'outro', icone: '🌱', titulo: 'Outro momento', comentario: 'Cada lagoa tem seu ritmo.' },
] as const;

export const IDADE_MINIMA = 12;
export const IDADE_MAXIMA = 90;
/** Onde a folhinha começa antes de a pessoa mexer. */
export const IDADE_INICIAL = 25;

export const TRAVAS = [
  { id: 'comecar', icone: '🐢', titulo: 'Começar', detalhe: 'Enrolo para dar o primeiro passo', comentario: 'Então vou sugerir focos curtinhos para destravar.' },
  { id: 'distracao', icone: '📱', titulo: 'Distração', detalhe: 'Celular, abas, barulho', comentario: 'Te ajudo a silenciar o mundo durante o foco.' },
  { id: 'cansaco', icone: '🥱', titulo: 'Cansaço', detalhe: 'Fico sem energia no meio', comentario: 'Vou lembrar de umas pausas para respirar.' },
  { id: 'excesso', icone: '🌊', titulo: 'Coisa demais', detalhe: 'Não sei por onde ir', comentario: 'A gente divide em pedacinhos, um pulo de cada vez.' },
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


export type Trava = (typeof TRAVAS)[number]['id'];
export type HabitoSugerido = (typeof HABITOS_SUGERIDOS)[number]['titulo'];

export type Momento = (typeof MOMENTOS)[number]['id'];

export interface RespostasDoOnboarding {
  nome: string;
  sobrenome: string;
  momento: Momento | null;
  idade: number | null;
  travas: readonly Trava[];
  habitos: readonly HabitoSugerido[];
}

/** Respostas em branco; o nome da conta, se houver, já vem separado em nome e sobrenome. */
export function respostasIniciais(nomeDaConta = ''): RespostasDoOnboarding {
  const [nome = '', ...resto] = nomeDaConta.trim().split(/\s+/);
  return {
    nome,
    sobrenome: resto.join(' '),
    momento: null,
    idade: null,
    travas: [],
    habitos: [],
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

/** Nome e sobrenome juntos, como a conta guarda. */
export function nomeCompleto(respostas: RespostasDoOnboarding): string {
  return `${respostas.nome.trim()} ${respostas.sobrenome.trim()}`.trim();
}

/** O sapo reage à idade enquanto a pessoa arrasta. */
export function comentarioDaIdade(idade: number): string {
  if (idade < 18) return 'Um girino cheio de energia!';
  if (idade < 25) return 'Fase de muita novidade, né?';
  if (idade < 35) return 'Idade de malabarista: dá conta de tudo.';
  if (idade < 50) return 'Experiência de sobra na lagoa.';
  return 'Sabedoria de sapo velho! Respeito.';
}

export function contarFolhas(quantas: number): string {
  return `${quantas} ${quantas === 1 ? 'folha' : 'folhas'}`;
}

/** O que o app já sabe guardar. */
export function dadosParaConcluir(): DadosDoOnboarding {
  // As demais respostas ficam só no estado da tela: o envio delas entra na etapa do backend.
  return { frogName: NOME_PADRAO_DO_SAPO, startHour: ONBOARDING_PADRAO.startHour, endHour: ONBOARDING_PADRAO.endHour };
}
