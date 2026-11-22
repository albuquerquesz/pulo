import { StyleSheet, View } from 'react-native';

import { Botao, Texto } from '@/ui';

import { horaTexto } from '../app';

/** Escolhe uma hora cheia com dois botões grandes (mais claro que digitar). */
export function EscolhaDeHora({
  rotulo,
  horas,
  min,
  max,
  onChange,
}: {
  rotulo: string;
  horas: number;
  min: number;
  max: number;
  onChange: (h: number) => void;
}) {
  return (
    <View style={styles.linha} accessibilityRole="adjustable" accessibilityLabel={`${rotulo}: ${horaTexto(horas * 60)}`}>
      <Texto style={styles.rotulo}>{rotulo}</Texto>
      <Botao titulo="Menos" rotulo={`Uma hora antes, ${rotulo}`} variante="fantasma" largura="auto" desativado={horas <= min} onPress={() => onChange(horas - 1)} />
      <Texto variante="subtitulo" tabular style={styles.valor}>
        {horaTexto(horas * 60)}
      </Texto>
      <Botao titulo="Mais" rotulo={`Uma hora depois, ${rotulo}`} variante="fantasma" largura="auto" desativado={horas >= max} onPress={() => onChange(horas + 1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rotulo: { flexGrow: 1, minWidth: 110 },
  valor: { minWidth: 52, textAlign: 'center' },
});
