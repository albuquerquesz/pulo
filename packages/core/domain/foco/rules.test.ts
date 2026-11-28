import { FOCUS } from '../../config/decisions';
import { DAY_MS, MINUTE_MS } from '../clock';
import { endedSession, sp } from '../test-utils';
import { validarRegistroDeFoco } from './rules';
import { MAX_PAUSED_MS, pauseSession, reconcileSession, startSession } from './timer';

const now = sp(2026, 11, 18);
const inicio = now - 60 * MINUTE_MS;
const codigo = (session: Parameters<typeof validarRegistroDeFoco>[0]['session'], outras: Parameters<typeof validarRegistroDeFoco>[0]['outras'] = [], nova = true) => {
  const r = validarRegistroDeFoco({ session, nova, outras, now });
  return r.ok ? 'ok' : r.error.code;
};

describe('registro de foco', () => {
  it('concluída pede o tempo planejado focado, com folga', () => {
    const folga = FOCUS.toleranciaSegundos / 60;
    expect(codigo(endedSession(inicio, 25, 'concluida', 0))).toBe('foco_incompleto');
    expect(codigo(endedSession(inicio, 25, 'concluida', 25 - folga))).toBe('ok');
    expect(codigo(endedSession(inicio, 25, 'concluida', 24))).toBe('foco_incompleto');
    expect(codigo(endedSession(inicio, 25, 'interrompida', 0))).toBe('ok');
  });

  it('sessão nova não pode ser antiga; a já gravada pode ser encerrada', () => {
    const antiga = endedSession(now - FOCUS.inicioMaxDiasAtras * DAY_MS - 1, 25, 'concluida');
    expect(codigo(antiga)).toBe('foco_antigo_demais');
    expect(codigo(antiga, [], false)).toBe('ok');
  });

  it('não cruza com outra, mas pode encostar', () => {
    const primeira = endedSession(inicio, 25, 'concluida');
    expect(codigo(endedSession(inicio + 10 * MINUTE_MS, 25, 'concluida'), [primeira])).toBe('foco_sobreposto');
    expect(codigo(endedSession(inicio + 25 * MINUTE_MS, 25, 'concluida'), [primeira])).toBe('ok');
    expect(codigo(primeira, [primeira])).toBe('ok');
    const rodando = startSession('r', inicio, 25);
    expect(codigo(endedSession(inicio + 30 * MINUTE_MS, 25, 'concluida'), [rodando])).toBe('foco_sobreposto');
  });
});

describe('pausa longa demais', () => {
  it('encerra o foco onde pausou, sem contar o tempo parado', () => {
    const pausada = pauseSession(startSession('s', inicio, 25), inicio + 5 * MINUTE_MS);
    expect(reconcileSession(pausada, inicio + 5 * MINUTE_MS + MAX_PAUSED_MS)).toBe(pausada);
    expect(reconcileSession(pausada, inicio + 6 * MINUTE_MS + MAX_PAUSED_MS)).toEqual({
      id: 's',
      startedAt: inicio,
      plannedMinutes: 25,
      state: 'interrompida',
      pausedMs: 0,
      endedAt: inicio + 5 * MINUTE_MS,
    });
  });
});
