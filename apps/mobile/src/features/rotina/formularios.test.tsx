jest.mock('react-native-reanimated', () => require('../../ui/testing/reanimated-mock'));

import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import { TemaProvider } from '@/theme/useTheme';

import { FormularioDeBloco } from './FormularioDeBloco';
import { FormularioDeHabito } from './FormularioDeHabito';
import { entradaVaziaDeBloco, entradaVaziaDeHabito, type EntradaDeBloco, type ResultadoDoBloco } from './logic';

const abertos: { unmount(): void }[] = [];
afterEach(async () => {
  await act(async () => {
    for (const root of abertos.splice(0)) root.unmount();
  });
});

async function montar(el: React.ReactElement) {
  const root = createRoot();
  abertos.push(root);
  await act(async () => {
    root.render(<TemaProvider carregarFontes={false}>{el}</TemaProvider>);
  });
  return root;
}

const porId = (root: { container: TestInstance }, id: string) => root.container.queryAll((n) => n.props?.testID === id);
const porRotulo = (root: { container: TestInstance }, rotulo: string) => root.container.queryAll((n) => n.props?.accessibilityLabel === rotulo);

function alturaMinima(estilo: unknown): number {
  const lista = Array.isArray(estilo) ? estilo.flat(Infinity) : [estilo];
  return Math.max(0, ...lista.map((e) => (typeof e === 'object' && e !== null && 'minHeight' in e && typeof e.minHeight === 'number' ? e.minHeight : 0)));
}

describe('formulário de bloco', () => {
  test('tem os sete dias como opções acessíveis de no mínimo 44 px e os campos rotulados', async () => {
    const root = await montar(
      <FormularioDeBloco titulo="Novo bloco" inicial={entradaVaziaDeBloco(420)} onSalvar={async () => ({ ok: true, bloco: { id: 'b', weekday: 0, startMinutes: 0, durationMinutes: 5, kind: 'foco' }, desfazer: null })} onCancelar={() => undefined} />,
    );
    for (const dia of ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']) {
      const opcao = porRotulo(root, dia).find((n) => n.props.accessibilityRole === 'radio');
      expect(opcao).toBeDefined();
      expect(alturaMinima(opcao?.props.style)).toBeGreaterThanOrEqual(44);
    }
    for (const campo of ['Começa às', 'Duração em minutos', 'Título (opcional)']) {
      expect(porRotulo(root, campo).length).toBeGreaterThan(0);
    }
    expect(porId(root, 'campo-inicio')[0].props.value).toBe('07:00');
    expect(porRotulo(root, 'Foco').some((n) => n.props.accessibilityState?.selected === true)).toBe(true);
  });

  test('enviar pelo teclado manda o que foi digitado e mostra a mensagem em português como alerta', async () => {
    const enviados: EntradaDeBloco[] = [];
    const root = await montar(
      <FormularioDeBloco
        titulo="Novo bloco"
        inicial={entradaVaziaDeBloco(420)}
        onSalvar={async (e): Promise<ResultadoDoBloco> => {
          enviados.push(e);
          return { ok: false, erro: { campo: 'duracao', mensagem: 'A duração vai de 5 a 120 minutos.' }, sugestaoDeInicio: null };
        }}
        onCancelar={() => undefined}
      />,
    );
    await act(async () => {
      porId(root, 'campo-duracao')[0].props.onChangeText('4');
    });
    await act(async () => {
      porId(root, 'campo-titulo')[0].props.onSubmitEditing();
    });
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ duracao: '4', inicio: '07:00' });
    const alerta = root.container.queryAll((n) => n.props?.accessibilityRole === 'alert');
    expect(alerta.length).toBe(1);
    expect(JSON.stringify(alerta[0].toJSON())).toContain('A duração vai de 5 a 120 minutos.');
  });

  test('falha de rede mantém o formulário aberto sem quebrar', async () => {
    const root = await montar(
      <FormularioDeBloco titulo="Novo bloco" inicial={entradaVaziaDeBloco(420)} onSalvar={() => Promise.reject(new Error('sem sinal'))} onCancelar={() => undefined} />,
    );
    await act(async () => {
      porId(root, 'campo-titulo')[0].props.onSubmitEditing();
    });
    expect(porId(root, 'formulario-de-bloco').length).toBeGreaterThan(0);
    expect(root.container.queryAll((n) => n.props?.accessibilityRole === 'alert')).toHaveLength(0);
  });
});

describe('formulário de hábito', () => {
  test('dias são caixas de marcar com nome completo; o texto do limite aparece', async () => {
    const root = await montar(
      <FormularioDeHabito titulo="Novo hábito" inicial={entradaVaziaDeHabito} podePausar={false} onSalvar={async () => ({ ok: false, erro: { campo: 'titulo', mensagem: 'Dê um nome ao hábito.' } })} onCancelar={() => undefined} />,
    );
    const caixas = root.container.queryAll((n) => n.props?.accessibilityRole === 'checkbox');
    expect(caixas).toHaveLength(7);
    expect(caixas.every((c) => c.props.accessibilityState?.checked === true)).toBe(true);
    expect(JSON.stringify(root.container.toJSON())).toContain('hábitos ativos');
    await act(async () => {
      porId(root, 'campo-habito')[0].props.onSubmitEditing();
    });
    expect(JSON.stringify(root.container.toJSON())).toContain('Dê um nome ao hábito.');
  });

  test('o interruptor "Hábito ativo" só aparece ao editar', async () => {
    const edicao = await montar(
      <FormularioDeHabito titulo="Editar hábito" inicial={entradaVaziaDeHabito} podePausar onSalvar={async () => ({ ok: false, erro: { campo: 'geral', mensagem: 'x' } })} onCancelar={() => undefined} />,
    );
    expect(porRotulo(edicao, 'Hábito ativo').length).toBeGreaterThan(0);
  });
});
