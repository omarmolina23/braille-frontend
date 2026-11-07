// RF-05: levantar en la celda el patrón de un punto o de una letra.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signoPorId } from '@braille/core';
import { App } from '../src/App';
import { ESPERA, conectarDispositivo, puertoFalso, simularSerial } from './ayudas';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Falso = ReturnType<typeof puertoFalso>['falso'];

/** Conecta un dispositivo (firmware falso) y devuelve lo que ordena la app. */
async function montarConDispositivo() {
  const usuario = userEvent.setup();
  const { falso, puerto } = puertoFalso();
  simularSerial(() => Promise.resolve(puerto));
  render(<App />);
  await conectarDispositivo(usuario);
  return { usuario, falso };
}

/** Las órdenes de movimiento que llegaron al dispositivo, en orden. */
const movimientos = (falso: Falso): (number | 'clear')[] =>
  falso.recibidos.flatMap((m): (number | 'clear')[] =>
    m.t === 'cell' ? [m.m] : m.t === 'clear' ? ['clear'] : [],
  );

const puntosDibujados = (contenedor: HTMLElement) =>
  [...contenedor.querySelectorAll('.celda-lectura .punto')].map((p) =>
    p.getAttribute('data-activo'),
  );

describe('RF-05: letra o signo', () => {
  it('cada signo de la lista levanta la máscara que tiene en la tabla', async () => {
    const { usuario, falso } = await montarConDispositivo();
    const lista = screen.getByLabelText('Signo');
    const ids = within(lista)
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value);
    expect(ids.length).toBeGreaterThan(40);

    for (const [i, id] of ids.entries()) {
      await usuario.selectOptions(lista, id);
      await usuario.click(screen.getByRole('button', { name: 'Levantar en la celda' }));
      await vi.waitFor(() => expect(movimientos(falso)).toHaveLength(i + 1), ESPERA);
    }

    expect(movimientos(falso)).toEqual(ids.map((id) => signoPorId(id)!.mascara));
  }, 60_000);

  it('"Mostrar en la celda" levanta la letra que se pide en el ejercicio', async () => {
    const { usuario, falso } = await montarConDispositivo();

    await usuario.click(screen.getByRole('button', { name: 'Mostrar en la celda' }));
    await usuario.selectOptions(screen.getByLabelText('Letra que se dicta'), 'm');
    await usuario.click(screen.getByRole('button', { name: 'Mostrar en la celda' }));

    await vi.waitFor(() => expect(movimientos(falso)).toEqual([1, 13]), ESPERA); // a y m
  });
});

describe('RF-05: punto suelto', () => {
  it.each([1, 2, 3, 4, 5, 6])('"Levantar el punto %i" levanta solo ese punto', async (punto) => {
    const { usuario, falso } = await montarConDispositivo();

    await usuario.click(screen.getByRole('button', { name: `Levantar el punto ${punto}` }));

    await vi.waitFor(() => expect(movimientos(falso)).toEqual([1 << (punto - 1)]), ESPERA);
  });
});

describe('RF-05: bajar y mostrar lo levantado', () => {
  it('"Bajar todos los puntos" ordena bajar y lo anuncia', async () => {
    const { usuario, falso } = await montarConDispositivo();
    await usuario.click(screen.getByRole('button', { name: 'Levantar el punto 2' }));

    await usuario.click(screen.getByRole('button', { name: 'Bajar todos los puntos' }));

    await screen.findByText('Todos los puntos están abajo.', {}, ESPERA);
    expect(falso.recibidos.some((m) => m.t === 'clear')).toBe(true);
    expect(falso.celda).toBe(0);
  });

  it('tras el ack dice qué hay levantado y dibuja solo esos puntos', async () => {
    const { usuario } = await montarConDispositivo();

    await usuario.selectOptions(screen.getByLabelText('Signo'), 'c');
    await usuario.click(screen.getByRole('button', { name: 'Levantar en la celda' }));

    await screen.findByText(/^En la celda: puntos 1 y 4, la ce\./, {}, ESPERA);
    expect(puntosDibujados(document.body)).toEqual([
      'true',
      'false',
      'false',
      'true',
      'false',
      'false',
    ]);
  });

  it('sin conectar el dispositivo, el simulador muestra lo mismo', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal('navigator', {});
    render(<App />);
    await screen.findByText(/^Simulador listo\./, {}, ESPERA);

    await usuario.selectOptions(screen.getByLabelText('Signo'), 'c');
    await usuario.click(screen.getByRole('button', { name: 'Levantar en la celda' }));

    await screen.findByText(/^En la celda: puntos 1 y 4, la ce\./, {}, ESPERA);
    expect(puntosDibujados(document.body)).toEqual([
      'true',
      'false',
      'false',
      'true',
      'false',
      'false',
    ]);
  });
});

describe('RF-05: accesibilidad de la sección Lectura', () => {
  it('no tiene violaciones de axe y se recorre con Tab en orden', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal('navigator', {});
    render(<App />);
    await screen.findByText(/^Simulador listo\./, {}, ESPERA);
    const lectura = screen.getByRole('region', { name: 'Lectura' });

    // jsdom no calcula diseño: el contraste y el tamaño se revisan a mano.
    const resultado = await axe.run(lectura, { rules: { 'color-contrast': { enabled: false } } });
    expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    screen.getByLabelText('Signo').focus();
    const orden = [
      'Levantar en la celda',
      'Bajar todos los puntos',
      ...[1, 2, 3, 4, 5, 6].map((p) => `Levantar el punto ${p}`),
    ];
    for (const nombre of orden) {
      await usuario.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: nombre }));
    }
  });
});
