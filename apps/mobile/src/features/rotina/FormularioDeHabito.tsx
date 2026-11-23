import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '@/theme';
import { Botao, Cartao, Texto } from '@/ui';

import { diaCurto } from '../app';
import { CampoDeTexto, Escolha, GrupoDeEscolhas } from './Campos';
import {
  DIAS_DA_SEMANA,
  DIAS_LONGOS,
  DICA_DE_LIMITE,
  LIMITE_DE_TITULO,
  type CampoDeHabito,
  type EntradaDeHabito,
  type ResultadoDoHabito,
} from './logic';

export interface FormularioDeHabitoProps {
  titulo: string;
  inicial: EntradaDeHabito;
  /** Mostra o interruptor "Ativo" (ao editar). */
  podePausar: boolean;
  onSalvar: (entrada: EntradaDeHabito) => Promise<ResultadoDoHabito>;
  onCancelar: () => void;
}

export function FormularioDeHabito({ titulo, inicial, podePausar, onSalvar, onCancelar }: FormularioDeHabitoProps) {
  const t = useTheme();
  const [entrada, setEntrada] = useState(inicial);
  const [erro, setErro] = useState<{ campo: CampoDeHabito | 'geral'; mensagem: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const erroDe = (campo: CampoDeHabito | 'geral') => (erro?.campo === campo ? erro.mensagem : null);

  const alternarDia = (dia: (typeof DIAS_DA_SEMANA)[number]) =>
    setEntrada((e) => ({ ...e, dias: e.dias.includes(dia) ? e.dias.filter((d) => d !== dia) : [...e.dias, dia] }));

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const r = await onSalvar(entrada);
      if (!r.ok) setErro(r.erro);
    } catch {
      // O aviso de rede ou do servidor já foi mostrado; o formulário continua aberto.
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Cartao testID="formulario-de-habito">
      <View style={styles.coluna}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {titulo}
        </Texto>

        <CampoDeTexto
          rotulo="Nome do hábito"
          value={entrada.titulo}
          onChangeText={(v) => setEntrada((e) => ({ ...e, titulo: v }))}
          erro={erroDe('titulo')}
          maxLength={LIMITE_DE_TITULO + 20}
          returnKeyType="done"
          onSubmitEditing={() => void salvar()}
          testID="campo-habito"
        />

        <View style={styles.campo}>
          <Texto variante="subtitulo">Dias</Texto>
          <GrupoDeEscolhas rotulo="Dias da semana do hábito" papel="group">
            {DIAS_DA_SEMANA.map((d) => (
              <Escolha
                key={d}
                papel="checkbox"
                texto={diaCurto(d)}
                rotulo={DIAS_LONGOS[d]}
                selecionado={entrada.dias.includes(d)}
                onPress={() => alternarDia(d)}
                testID={`habito-dia-${d}`}
              />
            ))}
          </GrupoDeEscolhas>
          {erroDe('dias') ? (
            <Texto variante="legenda" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {erroDe('dias')}
            </Texto>
          ) : (
            <Texto variante="legenda" cor="muted">
              {DICA_DE_LIMITE}
            </Texto>
          )}
        </View>

        {podePausar ? (
          <View style={styles.linhaSwitch}>
            <Texto style={styles.expande}>Hábito ativo</Texto>
            <Switch
              value={entrada.ativo}
              onValueChange={(ativo) => setEntrada((e) => ({ ...e, ativo }))}
              accessibilityLabel="Hábito ativo"
              trackColor={{ false: t.cores.line, true: t.cores.agua }}
            />
          </View>
        ) : null}

        {erroDe('geral') ? (
          <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">
            {erroDe('geral')}
          </Texto>
        ) : null}

        <Botao titulo="Salvar hábito" onPress={() => void salvar()} carregando={salvando} testID="salvar-habito" />
        <Botao titulo="Cancelar" variante="fantasma" onPress={onCancelar} desativado={salvando} />
      </View>
    </Cartao>
  );
}

const styles = StyleSheet.create({
  coluna: { gap: 12 },
  campo: { gap: 6 },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  expande: { flex: 1 },
});
