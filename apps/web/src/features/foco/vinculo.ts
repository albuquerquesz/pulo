/** O que chega na Casa pela URL para o timer já abrir preenchido: o bloco da rotina e, no máximo, um alvo (spec 19). */
export interface VinculoDaCasa {
  bloco?: string;
  habito?: string;
  meta?: string;
  tarefa?: string;
}

const CHAVES = ['bloco', 'habito', 'meta', 'tarefa'] as const satisfies readonly (keyof VinculoDaCasa)[];

/** `validateSearch` da rota `/casa`: só ficam os textos conhecidos. */
export function lerVinculoDaCasa(busca: Record<string, unknown>): VinculoDaCasa {
  const vinculo: VinculoDaCasa = {};
  for (const chave of CHAVES) {
    const valor = busca[chave];
    if (typeof valor === 'string' && valor) vinculo[chave] = valor;
  }
  return vinculo;
}
