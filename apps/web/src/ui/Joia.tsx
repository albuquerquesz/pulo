export type JoiaProps = {
  /** Largura em px; a altura segue a proporção do rascunho. */
  largura?: number;
  altura?: number;
  /** Contorno por fora do hexágono: branco (números do trilho) ou grosso (barra de valor). */
  contorno?: 'branco' | 'grosso';
  className?: string;
};

const CONTORNO = { branco: 'contorno-branco', grosso: 'contorno-grosso' } as const;

/** A moeda do Pulo: joia ametista, um hexágono com recortes de luz. */
export function Joia({ largura = 14, altura = 16, contorno, className = '' }: JoiaProps) {
  // O filtro fica no pai: no mesmo elemento, o `clip-path` cortaria o contorno.
  return (
    <span aria-hidden="true" data-testid="joia" className={`inline-block shrink-0 ${contorno ? CONTORNO[contorno] : ''} ${className}`}>
      <span className="gema block" style={{ width: largura, height: altura }} />
    </span>
  );
}
