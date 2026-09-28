// Pruebas de contrato: el adaptador Web Serial contra el firmware de referencia.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DispositivoWebSerial,
  ErrorIncompatible,
  ErrorProtocolo,
  type EstadoConexion,
  type OpcionesWebSerial,
} from '../src';
import { FirmwareFalso, type OpcionesFirmwareFalso } from '../src/pruebas';

const abiertos: DispositivoWebSerial[] = [];

function montar(firmware: OpcionesFirmwareFalso = {}, adaptador: OpcionesWebSerial = {}) {
  const falso = new FirmwareFalso(firmware);
  const ignoradas: string[] = [];
  const dispositivo = new DispositivoWebSerial(falso.crearPuerto(), {
    timeoutAckMs: 80,
    tiempoMaximoSaludoMs: 400,
    intervaloSaludoMs: 50,
    intervaloPingMs: 0,
    onLineaIgnorada: (_linea, motivo) => ignoradas.push(motivo),
    ...adaptador,
  });
  const estados: EstadoConexion[] = [];
  dispositivo.onEstado((e) => estados.push(e));
  abiertos.push(dispositivo);
  return { falso, dispositivo, estados, ignoradas };
}

afterEach(async () => {
  await Promise.all(abiertos.splice(0).map((d) => d.desconectar()));
});

describe('conexión', () => {
  it('saluda, sobrevive al reinicio del ESP32 y queda listo', async () => {
    const { falso, dispositivo, ignoradas } = montar();

    const info = await dispositivo.conectar();

    expect(info).toEqual({
      protocolo: 1,
      firmware: '0.0.0-falso',
      teclas: ['space', 'back', 'repeat', 'ok'],
    });
    expect(dispositivo.estado).toBe('listo');
    expect(falso.senales).toContainEqual({ dataTerminalReady: false, requestToSend: false });
    expect(ignoradas).toContain('no-json'); // el registro del ROM se descartó
  });

  it('rechaza un firmware con otra versión de protocolo', async () => {
    const { dispositivo } = montar({ protocolo: 2 });
    await expect(dispositivo.conectar()).rejects.toBeInstanceOf(ErrorIncompatible);
    expect(dispositivo.estado).toBe('error');
  });

  it('falla si el dispositivo nunca responde al saludo', async () => {
    const { dispositivo } = montar({ responderHello: false });
    await expect(dispositivo.conectar()).rejects.toBeInstanceOf(ErrorProtocolo);
    expect(dispositivo.estado).toBe('error');
  });
});

describe('lectura: mostrar una celda', () => {
  it('envía la máscara y resuelve tras el ack', async () => {
    const { falso, dispositivo, estados } = montar();
    await dispositivo.conectar();

    await dispositivo.mostrarCelda(25); // d = puntos 1, 4 y 5

    expect(falso.celda).toBe(25);
    expect(falso.recibidos).toContainEqual(expect.objectContaining({ t: 'cell', m: 25 }));
    expect(estados.slice(-2)).toEqual(['moviendo', 'listo']);
  });

  it('reintenta una vez si no llega el ack y luego informa el error', async () => {
    const { falso, dispositivo } = montar({ responderAck: false });
    await dispositivo.conectar();

    await expect(dispositivo.mostrarCelda(9)).rejects.toThrow(/Sin respuesta "ack"/);

    expect(falso.recibidos.filter((m) => m.t === 'cell')).toHaveLength(2);
    expect(dispositivo.estado).toBe('listo');
  });

  it('envía un comando a la vez aunque se pidan varios seguidos', async () => {
    const { falso, dispositivo } = montar({ retardoAckMs: 20 });
    await dispositivo.conectar();

    await Promise.all([
      dispositivo.mostrarCelda(1),
      dispositivo.mostrarCelda(3),
      dispositivo.limpiar(),
    ]);

    expect(falso.solapamientos).toBe(0);
    expect(falso.celda).toBe(0);
  });
});

describe('escritura y teclas', () => {
  it('emite los acordes y las teclas de control', async () => {
    const { falso, dispositivo } = montar();
    await dispositivo.conectar();
    const acordes: number[] = [];
    const teclas: string[] = [];
    dispositivo.onAcorde((m) => acordes.push(m));
    dispositivo.onTecla((k) => teclas.push(k));

    falso.emitir({ t: 'chord', m: 9 });
    falso.emitir({ t: 'key', k: 'ok' });

    await vi.waitFor(() => {
      expect(acordes).toEqual([9]);
      expect(teclas).toEqual(['ok']);
    });
  });
});

describe('fallas del enlace', () => {
  it('detecta que se retiró el cable', async () => {
    const { falso, dispositivo } = montar();
    await dispositivo.conectar();

    falso.desconectarCable();

    await vi.waitFor(() => expect(dispositivo.estado).toBe('desconectado'));
  });

  it('el latido detecta un dispositivo que dejó de responder', async () => {
    const { dispositivo } = montar(
      { responderPing: false },
      { intervaloPingMs: 30, timeoutAckMs: 25 },
    );
    await dispositivo.conectar();

    await vi.waitFor(() => expect(dispositivo.estado).toBe('desconectado'), { timeout: 1_000 });
  });

  it('se resincroniza si el ESP32 se reinicia estando conectado', async () => {
    const { falso, dispositivo, estados } = montar();
    await dispositivo.conectar();
    const desde = estados.length;

    falso.reiniciar();

    await vi.waitFor(() => expect(estados.slice(desde)).toEqual(['conectando', 'listo']));
    await dispositivo.mostrarCelda(1);
    expect(falso.celda).toBe(1);
  });
});
