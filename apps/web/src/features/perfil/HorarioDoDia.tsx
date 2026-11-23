import { Botao, Texto } from '@/ui';

import { horaTexto } from '../app';

type EscolhaDeHoraProps = {
  rotulo: string;
  horas: number;
  min: number;
  max: number;
  onChange: (h: number) => void;
};

/** Escolhe uma hora cheia com dois botões grandes (mais claro que digitar). */
export function EscolhaDeHora({ rotulo, horas, min, max, onChange }: EscolhaDeHoraProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${rotulo}: ${horaTexto(horas * 60)}`}>
      <Texto className="min-w-28 grow">{rotulo}</Texto>
      <Botao titulo="Menos" rotulo={`Uma hora antes, ${rotulo}`} variante="fantasma" largura="auto" desativado={horas <= min} onPress={() => onChange(horas - 1)} />
      <Texto variante="subtitulo" tabular className="min-w-13 text-center">
        {horaTexto(horas * 60)}
      </Texto>
      <Botao titulo="Mais" rotulo={`Uma hora depois, ${rotulo}`} variante="fantasma" largura="auto" desativado={horas >= max} onPress={() => onChange(horas + 1)} />
    </div>
  );
}
