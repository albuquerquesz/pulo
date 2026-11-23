import { Botao, Texto } from '@/ui';

type SinalProps = { mais?: boolean };

/** Menos ou mais, em traço grosso e arredondado como os outros ícones do app. */
function Sinal({ mais }: SinalProps) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
      <path d="M5 12h14" />
      {mais ? <path d="M12 5v14" /> : null}
    </svg>
  );
}

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
      <Botao titulo="Menos" icone={<Sinal />} rotulo={`Uma hora antes, ${rotulo}`} variante="fantasma" largura="auto" desativado={horas <= min} onPress={() => onChange(horas - 1)} />
      <Texto variante="subtitulo" tabular className="min-w-13 text-center">
        {horaTexto(horas * 60)}
      </Texto>
      <Botao titulo="Mais" icone={<Sinal mais />} rotulo={`Uma hora depois, ${rotulo}`} variante="fantasma" largura="auto" desativado={horas >= max} onPress={() => onChange(horas + 1)} />
    </div>
  );
}
