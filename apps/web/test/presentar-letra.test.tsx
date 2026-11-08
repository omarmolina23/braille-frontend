// RF-06: presentar una letra: se levanta, se espera el ack y se describe por su forma.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import {
  ESPERA,
  conectarDispositivo,
  puertoFalso,
  registrarAnuncios,
  simularSerial,
} from './ayudas';

const PRESENTAR = 'Presentar la letra';
const SIGUIENTE = 'Siguiente letra';
const INVITA_A_TOCAR = /toque/i;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Falso = ReturnType<typeof puertoFalso>['falso'];

async function montar(opciones: Parameters<typeof puertoFalso>[0] = {}) {
  const usuario = userEvent.setup();
  const { falso, puerto } = puertoFalso(opciones);
  simularSerial(() => Promise.resolve(puerto));
  render(<App />);
  await conectarDispositivo(usuario);
  const anuncios = registrarAnuncios(screen.getByRole('status'));
  return { usuario, falso, anuncios };
}

const mascaras = (falso: Falso) => falso.recibidos.flatMap((m) => (m.t === 'cell' ? [m.m] : []));
const boton = (nombre: string) => screen.getByRole('button', { name: nombre });

describe('RF-06: presentar la letra', () => {
  it('levanta la letra actual y, tras el ack, la presenta sin evaluar', async () => {
    const { usuario, falso } = await montar();

    await usuario.click(boton(PRESENTAR));

    await screen.findByText('Letra 1 de 10. Toque la celda. Esta es la a.', {}, ESPERA);
    expect(mascaras(falso)).toEqual([1]);
    expect(screen.queryByText(/Correcto|Escribiste|Intenta/)).toBeNull();
    expect(screen.getByText('la a').tagName).toBe('STRONG'); // el ejercicio de escritura no cambia
  });

  it('con figura describe la forma y no menciona puntos', async () => {
    const { usuario, falso } = await montar();
    for (let i = 0; i < 3; i += 1) await usuario.click(boton(SIGUIENTE));

    await usuario.click(boton(PRESENTAR));

    const texto = await screen.findByText(/^Letra 4 de 10\. Toque la celda/, {}, ESPERA);
    expect(texto.textContent).toBe(
      'Letra 4 de 10. Toque la celda. Esta es la de. Su forma: codo a la derecha.',
    );
    expect(texto.textContent).not.toMatch(/punto/i);
    expect(mascaras(falso)).toEqual([25]); // d = puntos 1, 4 y 5
  });

  it('no invita a tocar antes del ack', async () => {
    const { usuario, anuncios } = await montar({ retardoAckMs: 1_000 });

    await usuario.click(boton(PRESENTAR));
    await new Promise((r) => setTimeout(r, 500));
    expect(anuncios.filter((a) => INVITA_A_TOCAR.test(a))).toEqual([]);

    await screen.findByText(/Toque la celda/, {}, ESPERA);
  });

  it('si el firmware responde con un error, no invita a tocar y lo explica', async () => {
    const { usuario, falso, anuncios } = await montar({ responderAck: false });

    await usuario.click(boton(PRESENTAR));
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

  it('si el firmware nunca confirma, no invita a tocar y lo explica', async () => {
    const { usuario, anuncios } = await montar({ responderAck: false });

    await usuario.click(boton(PRESENTAR));

    const fallo = await screen.findByText(/^La celda no respondió:/, {}, { timeout: 6_000 });
    expect(fallo.textContent).toContain('no confirmó a tiempo');
    expect(anuncios.filter((a) => INVITA_A_TOCAR.test(a))).toEqual([]);
  }, 10_000);
});

describe('RF-06: siguiente letra', () => {
  it('avanza, lo dice y presenta la letra siguiente', async () => {
    const { usuario, falso } = await montar();

    await usuario.click(boton(SIGUIENTE));
    await screen.findByText('Letra 2 de 10.', {}, ESPERA);
    await usuario.click(boton(PRESENTAR));

    await screen.findByText(/^Letra 2 de 10\. Toque la celda\. Esta es la be\./, {}, ESPERA);
    expect(mascaras(falso)).toEqual([3]); // b = puntos 1 y 2
  });

  it('tras la última letra de la serie vuelve a la primera y lo dice', async () => {
    const { usuario, falso } = await montar();
    for (let i = 0; i < 9; i += 1) await usuario.click(boton(SIGUIENTE)); // llega a la j

    await usuario.click(boton(SIGUIENTE));
    await screen.findByText('Volviste a la primera letra de la serie. Letra 1 de 10.', {}, ESPERA);
    await usuario.click(boton(PRESENTAR));

    await vi.waitFor(() => expect(mascaras(falso)).toEqual([1]), ESPERA);
  });
});

describe('RF-06: sin dispositivo y accesibilidad', () => {
  it('sin dispositivo la sección no existe (RF-34)', async () => {
    vi.stubGlobal('navigator', {});
    render(<App permitirSimulador={false} />);

    expect(screen.queryByRole('region', { name: 'Presentación de letras' })).toBeNull();
    expect(screen.queryByRole('button', { name: PRESENTAR })).toBeNull();
  });

  it('no tiene violaciones de axe, se recorre con Tab y el foco se queda en el botón', async () => {
    const { usuario, anuncios } = await montar();
    const seccion = screen.getByRole('region', { name: 'Presentación de letras' });

    // jsdom no calcula diseño: el contraste y el tamaño se revisan a mano.
    const resultado = await axe.run(seccion, { rules: { 'color-contrast': { enabled: false } } });
    expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    boton(PRESENTAR).focus();
    await usuario.tab();
    expect(document.activeElement).toBe(boton(SIGUIENTE));

    await usuario.click(boton(PRESENTAR));
    await screen.findByText(/Toque la celda/, {}, ESPERA);
    expect(document.activeElement).toBe(boton(PRESENTAR));
    expect((boton(PRESENTAR) as HTMLButtonElement).disabled).toBe(false);
    expect(anuncios).toEqual(['Letra 1 de 10. Toque la celda. Esta es la a.']);
  });
});
