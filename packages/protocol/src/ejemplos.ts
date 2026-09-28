import type { MensajeApp, MensajeDispositivo } from './mensajes';

/**
 * Un ejemplo válido por mensaje. Son los mismos de docs/PROTOCOLO.md:
 * sirven de referencia para programar el firmware y los valida la suite de pruebas.
 */
export const ejemplosApp = {
  hello: { t: 'hello', id: 1 },
  cell: { t: 'cell', id: 7, m: 9 },
  clear: { t: 'clear', id: 8 },
  ping: { t: 'ping', id: 9 },
} satisfies Record<MensajeApp['t'], MensajeApp>;

export const ejemplosDispositivo = {
  boot: { t: 'boot', fw: '0.1.0' },
  info: { t: 'info', id: 1, proto: 1, fw: '0.1.0', keys: ['space', 'back', 'repeat', 'ok'] },
  ack: { t: 'ack', id: 7, ms: 420 },
  chord: { t: 'chord', m: 9 },
  key: { t: 'key', k: 'space' },
  pong: { t: 'pong', id: 9 },
  err: { t: 'err', id: 7, code: 'SERVO_TIMEOUT' },
} satisfies Record<MensajeDispositivo['t'], MensajeDispositivo>;
