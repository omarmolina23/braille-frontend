// RF-03: el simulador se comporta como el dispositivo real. Cada escenario corre contra los dos:
// `DispositivoWebSerial` + `FirmwareFalso` (la especificación ejecutable del real) y el simulador.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DispositivoWebSerial,
  ErrorConexionCerrada,
  ErrorProtocolo,
  SimuladorDispositivo,
  type DispositivoBraille,
  type EstadoConexion,
  type Mascara,
  type TeclaControl,
} from '../src';
import { FirmwareFalso } from '../src/pruebas';

const RETARDO_MS = 40;

interface Banco {
  dispositivo: DispositivoBraille;
  estados: EstadoConexion[];
  /** Lo que la celda muestra ahora. */
  celda(): Mascara;
  /** Cuántas órdenes de movimiento llegaron al dispositivo (o movieron el simulador). */
  movimientos(): number;
  /** La persona escribe un acorde con el dispositivo. */
  escribirAcorde(mascara: Mascara): void;
  /** La persona pulsa una tecla de control. */
  pulsarTecla(tecla: TeclaControl): void;
}

const abiertos: DispositivoBraille[] = [];

function armar(dispositivo: DispositivoBraille, resto: Omit<Banco, 'dispositivo' | 'estados'>) {
  const estados: EstadoConexion[] = [];
  dispositivo.onEstado((e) => estados.push(e));
  abiertos.push(dispositivo);
  return { dispositivo, estados, ...resto };
}

const BANCOS: readonly { nombre: string; crear: () => Banco }[] = [
  {
    nombre: 'dispositivo real (firmware falso)',
    crear: () => {
      const falso = new FirmwareFalso({ retardoAckMs: RETARDO_MS });
      const dispositivo = new DispositivoWebSerial(falso.crearPuerto(), {
        timeoutAckMs: 1_000,
        tiempoMaximoSaludoMs: 1_000,
        intervaloSaludoMs: 50,
        intervaloPingMs: 0,
      });
      return armar(dispositivo, {
        celda: () => falso.celda,
        movimientos: () => falso.recibidos.filter((m) => m.t === 'cell' || m.t === 'clear').length,
        escribirAcorde: (m) => falso.emitir({ t: 'chord', m }),
        pulsarTecla: (k) => falso.emitir({ t: 'key', k }),
      });
    },
  },
  {
    nombre: 'simulador',
    crear: () => {
      const simulador = new SimuladorDispositivo({ retardoCeldaMs: RETARDO_MS });
      let movimientos = 0;
      simulador.onCelda(() => (movimientos += 1));
      return armar(simulador, {
        celda: () => simulador.celdaActual,
        movimientos: () => movimientos,
        escribirAcorde: (m) => simulador.pulsarAcorde(m),
        pulsarTecla: (k) => simulador.pulsarTecla(k),
      });
    },
  },
];

afterEach(async () => {
  await Promise.all(abiertos.splice(0).map((d) => d.desconectar()));
});

/** Espera lo suficiente para que un evento que no debe llegar tuviera tiempo de llegar. */
const esperarSinEventos = () => new Promise((r) => setTimeout(r, 60));

describe.each(BANCOS)('contrato del dispositivo: $nombre', ({ crear }) => {
  it('conecta pasando por conectando y avisa del protocolo y las teclas', async () => {
    const { dispositivo, estados } = crear();

    const info = await dispositivo.conectar();

    expect(estados).toEqual(['conectando', 'listo']);
    expect(info.protocolo).toBe(1);
    expect(info.teclas).toEqual(['space', 'back', 'repeat', 'ok']);
  });

  it('rechaza conectar de nuevo si ya está conectado', async () => {
    const { dispositivo } = crear();
    await dispositivo.conectar();

    const rechazo = dispositivo.conectar();

    await expect(rechazo).rejects.toBeInstanceOf(ErrorProtocolo);
    await expect(rechazo).rejects.toThrow('Ya hay una conexión.');
    expect(dispositivo.estado).toBe('listo');
  });

  it.each(['mostrarCelda', 'limpiar'] as const)(
    '%s sin conexión se rechaza con el mismo error',
    async (orden) => {
      const { dispositivo } = crear();

      const rechazo = orden === 'limpiar' ? dispositivo.limpiar() : dispositivo.mostrarCelda(1);

      await expect(rechazo).rejects.toBeInstanceOf(ErrorProtocolo);
      await expect(rechazo).rejects.toThrow('El dispositivo no está listo.');
    },
  );

  it('mueve la celda pasando por moviendo y resuelve cuando quedó quieta', async () => {
    const { dispositivo, estados, celda } = crear();
    await dispositivo.conectar();
    estados.length = 0;

    await dispositivo.mostrarCelda(25);

    expect(estados).toEqual(['moviendo', 'listo']);
    expect(celda()).toBe(25);
  });

  it('ejecuta las órdenes en el orden en que llegan, una a la vez', async () => {
    const { dispositivo, estados, celda } = crear();
    await dispositivo.conectar();
    estados.length = 0;

    await Promise.all([
      dispositivo.mostrarCelda(1),
      dispositivo.mostrarCelda(3),
      dispositivo.limpiar(),
    ]);

    expect(estados).toEqual(['moviendo', 'listo', 'moviendo', 'listo', 'moviendo', 'listo']);
    expect(celda()).toBe(0);
  });

  it('si se desconecta durante un movimiento, rechaza la orden y no vuelve a listo', async () => {
    const { dispositivo, estados } = crear();
    await dispositivo.conectar();
    estados.length = 0;

    const rechazo = expect(dispositivo.mostrarCelda(9)).rejects.toBeInstanceOf(
      ErrorConexionCerrada,
    );
    await new Promise((r) => setTimeout(r, 10));
    await dispositivo.desconectar();

    await rechazo;
    expect(dispositivo.estado).toBe('desconectado');
    expect(estados).toEqual(['moviendo', 'desconectado']);
  });

  it('entrega los acordes y las teclas, y deja de hacerlo al cancelar la suscripción', async () => {
    const { dispositivo, escribirAcorde, pulsarTecla } = crear();
    await dispositivo.conectar();
    const acordes: Mascara[] = [];
    const teclas: TeclaControl[] = [];
    const cancelarAcorde = dispositivo.onAcorde((m) => acordes.push(m));
    const cancelarTecla = dispositivo.onTecla((k) => teclas.push(k));

    escribirAcorde(9);
    pulsarTecla('ok');
    await vi.waitFor(() => {
      expect(acordes).toEqual([9]);
      expect(teclas).toEqual(['ok']);
    });

    cancelarAcorde();
    cancelarTecla();
    escribirAcorde(3);
    pulsarTecla('repeat');
    await esperarSinEventos();
    expect(acordes).toEqual([9]);
    expect(teclas).toEqual(['ok']);
  });

  it('no entrega acordes ni teclas si está desconectado', async () => {
    const { dispositivo, escribirAcorde, pulsarTecla } = crear();
    const acordes: Mascara[] = [];
    const teclas: TeclaControl[] = [];
    dispositivo.onAcorde((m) => acordes.push(m));
    dispositivo.onTecla((k) => teclas.push(k));

    escribirAcorde(9);
    pulsarTecla('ok');
    await esperarSinEventos();

    expect(acordes).toEqual([]);
    expect(teclas).toEqual([]);
  });

  it.each([64, -1, 1.5, Number.NaN])(
    'rechaza al instante la máscara %s sin mover la celda',
    async (mascara) => {
      const { dispositivo, celda, movimientos } = crear();
      await dispositivo.conectar();

      const rechazo = dispositivo.mostrarCelda(mascara);

      await expect(rechazo).rejects.toBeInstanceOf(ErrorProtocolo);
      await expect(rechazo).rejects.toThrow('La máscara debe ser un número entero entre 0 y 63.');
      expect(dispositivo.estado).toBe('listo');
      expect(celda()).toBe(0);
      expect(movimientos()).toBe(0);
    },
  );

  it('acepta los extremos 0 y 63', async () => {
    const { dispositivo, celda } = crear();
    await dispositivo.conectar();

    await dispositivo.mostrarCelda(63);
    expect(celda()).toBe(63);
    await dispositivo.mostrarCelda(0);
    expect(celda()).toBe(0);
  });

  it('vuelve a conectar la misma instancia después de desconectar', async () => {
    const { dispositivo, celda } = crear();
    await dispositivo.conectar();
    await dispositivo.desconectar();

    await dispositivo.conectar();

    expect(dispositivo.estado).toBe('listo');
    await dispositivo.mostrarCelda(1);
    expect(celda()).toBe(1);
  });
});
