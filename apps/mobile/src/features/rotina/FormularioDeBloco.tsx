import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BLOCK_MAX_MINUTES, BLOCK_MIN_MINUTES } from '@pulo/core/config/decisions';
import { Botao, Cartao, Texto } from '@/ui';

import { diaCurto } from '../app';
import { CampoDeTexto, Escolha, GrupoDeEscolhas, type CampoRef } from './Campos';
import { DIAS_DA_SEMANA, DIAS_LONGOS, LIMITE_DE_TITULO, type CampoDeBloco, type EntradaDeBloco, type ResultadoDoBloco } from './logic';

export interface FormularioDeBlocoProps {
  titulo: string;
  inicial: EntradaDeBloco;
  /** Salva e devolve o resultado das regras do core. Falha de rede sobe como erro (o aviso já foi mostrado). */
  onSalvar: (entrada: EntradaDeBloco) => Promise<ResultadoDoBloco>;
  onCancelar: () => void;
}

export function FormularioDeBloco({ titulo, inicial, onSalvar, onCancelar }: FormularioDeBlocoProps) {
  const [entrada, setEntrada] = useState(inicial);
  const [erro, setErro] = useState<{ campo: CampoDeBloco; mensagem: string; sugestao: string | null } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const duracaoRef = useRef<CampoRef>(null);
  const tituloRef = useRef<CampoRef>(null);
  const mudar = (patch: Partial<EntradaDeBloco>) => setEntrada((e) => ({ ...e, ...patch }));
  const erroDe = (campo: CampoDeBloco) => (erro?.campo === campo ? erro.mensagem : null);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const r = await onSalvar(entrada);
      if (!r.ok) setErro({ ...r.erro, sugestao: r.sugestaoDeInicio });
    } catch {
      // Sem rede ou recusado pelo servidor: o aviso já foi mostrado e o formulário continua aberto.
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Cartao testID="formulario-de-bloco">
      <View style={styles.coluna}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {titulo}
        </Texto>

        <View style={styles.campo}>
          <Texto variante="subtitulo">Dia da semana</Texto>
          <GrupoDeEscolhas rotulo="Dia da semana">
            {DIAS_DA_SEMANA.map((d) => (
              <Escolha key={d} texto={diaCurto(d)} rotulo={DIAS_LONGOS[d]} selecionado={entrada.weekday === d} onPress={() => mudar({ weekday: d })} testID={`dia-${d}`} />
            ))}
          </GrupoDeEscolhas>
        </View>

        <CampoDeTexto
          rotulo="Começa às"
          dica="Formato 09:30"
          value={entrada.inicio}
          onChangeText={(inicio) => mudar({ inicio })}
          erro={erroDe('inicio')}
          keyboardType="numbers-and-punctuation"
          returnKeyType="next"
          onSubmitEditing={() => duracaoRef.current?.focus()}
          blurOnSubmit={false}
          maxLength={5}
          testID="campo-inicio"
        />
        {erro?.campo === 'inicio' && erro.sugestao ? (
          <Botao titulo={`Usar ${erro.sugestao}`} variante="agua" largura="auto" onPress={() => { mudar({ inicio: erro.sugestao ?? entrada.inicio }); setErro(null); }} />
        ) : null}

        <CampoDeTexto
          ref={duracaoRef}
          rotulo="Duração em minutos"
          dica={`De ${BLOCK_MIN_MINUTES} a ${BLOCK_MAX_MINUTES}`}
          value={entrada.duracao}
          onChangeText={(duracao) => mudar({ duracao })}
          erro={erroDe('duracao')}
          keyboardType="number-pad"
          returnKeyType="next"
          onSubmitEditing={() => tituloRef.current?.focus()}
          blurOnSubmit={false}
          maxLength={3}
          testID="campo-duracao"
        />

        <View style={styles.campo}>
          <Texto variante="subtitulo">Tipo</Texto>
          <GrupoDeEscolhas rotulo="Tipo do bloco">
            <Escolha texto="Foco" rotulo="Foco" selecionado={entrada.kind === 'foco'} onPress={() => mudar({ kind: 'foco' })} testID="tipo-foco" />
            <Escolha texto="Descanso" rotulo="Descanso" selecionado={entrada.kind === 'descanso'} onPress={() => mudar({ kind: 'descanso' })} testID="tipo-descanso" />
          </GrupoDeEscolhas>
        </View>

        <CampoDeTexto
          ref={tituloRef}
          rotulo="Título (opcional)"
          value={entrada.titulo}
          onChangeText={(t) => mudar({ titulo: t })}
          erro={erroDe('titulo')}
          maxLength={LIMITE_DE_TITULO + 20}
          returnKeyType="done"
          onSubmitEditing={() => void salvar()}
          testID="campo-titulo"
        />

        {erroDe('geral') ? (
          <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">
            {erroDe('geral')}
          </Texto>
        ) : null}

        <Botao titulo="Salvar bloco" onPress={() => void salvar()} carregando={salvando} testID="salvar-bloco" />
        <Botao titulo="Cancelar" variante="fantasma" onPress={onCancelar} desativado={salvando} />
      </View>
    </Cartao>
  );
}

const styles = StyleSheet.create({
  coluna: { gap: 12 },
  campo: { gap: 6 },
});
