// RF-04: nada que suponga la letra levantada se narra antes del `ack` del dispositivo a `cell`.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import {
  ESPERA,
  conectarDispositivo,
  puertoFalso,
  registrarAnuncios,
  simularSerial,
  type Usuario,
} from './ayudas';

/** Tiempo que tarda el firmware falso en confirmar con `ack` (menor que el timeout de la app). */
const RETARDO_ACK_MS = 300;
/** Lo que no debe oírse antes del `ack`: cualquier invitación a tocar la celda. */
const INVITA_A_TOCAR = /t[oó]c/i;

/** Las tres órdenes de la sección Lectura que narran algo sobre la celda levantada. */
const ORDENES = [
  {
    nombre: 'Levantar en la celda',
    boton: 'Levantar en la celda',
    aviso: /Ya puedes tocar la celda\.$/,
  },
  {
    nombre: 'Mostrar en la celda',
    boton: 'Mostrar en la celda',
    aviso: /Tócala y luego escríbela\.$/,
  },
  {
    nombre: 'Levantar el punto 4',
    boton: 'Levantar el punto 4',
    aviso: /^Punto 4\. Ya puedes tocar la celda\./,
  },
] as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function montarYConectar(opciones: Parameters<typeof puertoFalso>[0], usuario: Usuario) {
  const { falso, puerto } = puertoFalso(opciones);
  simularSerial(() => Promise.resolve(puerto));
  render(<App />);
  await conectarDispositivo(usuario);
  return { falso, anuncios: registrarAnuncios(screen.getByRole('status')) };
}

const esperarMs = (ms: number) => new Promise((r) => setTimeout(r, ms));
const celdaEsperada = () =>
  screen.getByText(/^Todavía no se ha levantado nada con este dispositivo\./);

describe.each(ORDENES)('RF-04: $nombre', ({ boton, aviso }) => {
  it('no invita a tocar antes del ack y sí después', async () => {
    const usuario = userEvent.setup();
    const { anuncios } = await montarYConectar({ retardoAckMs: RETARDO_ACK_MS }, usuario);

    await usuario.click(screen.getByRole('button', { name: boton }));
    await esperarMs(RETARDO_ACK_MS / 2);
    expect(anuncios.filter((a) => INVITA_A_TOCAR.test(a))).toEqual([]);

    await screen.findByText(aviso, {}, ESPERA);
  });

  it('si el firmware nunca confirma, no invita a tocar y explica el fallo', async () => {
    const usuario = userEvent.setup();
    const { anuncios } = await montarYConectar({ responderAck: false }, usuario);

    await usuario.click(screen.getByRole('button', { name: boton }));

    // Timeout de 1,5 s + un reintento de 1,5 s.
    const fallo = await screen.findByText(/^La celda no respondió:/, {}, { timeout: 6_000 });
    expect(fallo.textContent).toContain('no confirmó a tiempo');
    expect(anuncios.filter((a) => INVITA_A_TOCAR.test(a))).toEqual([]);
  }, 10_000);

  it('si el firmware responde con un error, no invita a tocar y lo explica', async () => {
    const usuario = userEvent.setup();
    const { falso, anuncios } = await montarYConectar({ responderAck: false }, usuario);

    await usuario.click(screen.getByRole('button', { name: boton }));
    const orden = await vi.waitFor(() => {
      const cell = falso.recibidos.find((m) => m.t === 'cell');
      if (!cell) throw new Error('Todavía no llega el cell.');
      return cell;
    });
    falso.emitir({ t: 'err', id: orden.id, code: 'SERVO_TIMEOUT' });

    const fallo = await screen.findByText(/^La celda no respondió:/, {}, ESPERA);
    expect(fallo.textContent).toContain('Los servos no llegaron a su posición a tiempo.');
    expect(anuncios.filter((a) => INVITA_A_TOCAR.test(a))).toEqual([]);
  });
});

describe('RF-04: texto de la celda', () => {
  it('dice que no hay nada levantado hasta el ack y luego qué hay', async () => {
    const usuario = userEvent.setup();
    await montarYConectar({ retardoAckMs: RETARDO_ACK_MS }, usuario);

    await usuario.click(screen.getByRole('button', { name: 'Levantar en la celda' }));
    await esperarMs(RETARDO_ACK_MS / 2);
    expect(celdaEsperada()).toBeTruthy();

    await screen.findByText(/^En la celda: /, {}, ESPERA);
    expect(screen.queryByText(/^Todavía no se ha levantado nada/)).toBeNull();
  });
});

describe('RF-04: retroalimentación al escribir', () => {
  it('no espera al ack de la celda y no invita a tocar', async () => {
    const usuario = userEvent.setup();
    const { falso, anuncios } = await montarYConectar({ retardoAckMs: RETARDO_ACK_MS }, usuario);

    falso.emitir({ t: 'chord', m: 2 }); // la letra pedida es la a (punto 1): se escribe mal
    const retroalimentacion = await screen.findByText(/Intenta de nuevo/, {}, ESPERA);

    expect(retroalimentacion).toBeTruthy();
    expect(falso.celda).toBe(0); // todavía no llegó el ack del eco
    await vi.waitFor(() => expect(falso.celda).toBe(2), ESPERA);
    expect(anuncios.filter((a) => INVITA_A_TOCAR.test(a))).toEqual([]);
  });
});

describe('RF-04: accesibilidad mientras se espera el ack', () => {
  it('el botón conserva el foco y sigue habilitado antes y después del ack', async () => {
    const usuario = userEvent.setup();
    await montarYConectar({ retardoAckMs: RETARDO_ACK_MS }, usuario);
    const boton = screen.getByRole('button', { name: 'Levantar en la celda' });

    await usuario.click(boton);
    await esperarMs(RETARDO_ACK_MS / 2);
    expect(document.activeElement).toBe(boton);
    expect((boton as HTMLButtonElement).disabled).toBe(false);

    await screen.findByText(/Ya puedes tocar la celda\.$/, {}, ESPERA);
    expect(document.activeElement).toBe(boton);
    expect((boton as HTMLButtonElement).disabled).toBe(false);
  });
});
