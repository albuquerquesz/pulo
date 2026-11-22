/**
 * Termos que a IA não pode usar: diagnóstico e saúde clínica, linguagem de culpa.
 * Comparação sem acento e sem diferença de maiúsculas, por início de palavra.
 */
export const FORBIDDEN_TERMS = [
  // saúde clínica
  'diagnostic', 'tratamento', 'tratar', 'doenca', 'doente', 'depressao', 'depressiv', 'ansiedade',
  'ansios', 'medicamento', 'remedio', 'terapia', 'terapeut', 'transtorno', 'sintoma', 'patolog',
  'tdah', 'burnout', 'insonia', 'psiquiatr', 'psicolog', 'clinic', 'cura', 'curar', 'receita medica',
  // culpa e cobrança
  'culpa', 'preguica', 'preguicos', 'fracasso', 'fracassou', 'falhou', 'vergonha', 'desleix',
  'incapaz', 'disciplina', 'sem desculpa', 'voce deveria', 'voce precisa', 'voce tem que',
] as const;

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Devolve os termos proibidos encontrados (vazio se o texto é seguro). */
export function findForbiddenTerms(text: string): string[] {
  const n = normalizeText(text);
  return FORBIDDEN_TERMS.filter((term) => new RegExp(`(^|[^a-z0-9])${term}`).test(n));
}

export function containsForbiddenTerm(text: string): boolean {
  return findForbiddenTerms(text).length > 0;
}
