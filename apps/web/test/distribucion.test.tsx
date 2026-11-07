// Distribución de la pantalla (RF-06): dos zonas para el estudiante, Aprender y Practicar, y las
// herramientas técnicas aparte y solo en desarrollo.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { ESPERA, conectarDispositivo, puertoFalso, simularSerial } from './ayudas';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function esperarPantallaLista(permitirSimulador: boolean) {
  const usuario = userEvent.setup();
  if (permitirSimulador) {
    vi.stubGlobal('navigator', {});
    render(<App permitirSimulador />);
    await screen.findByText(/^Simulador listo\./, {}, ESPERA);
  } else {
    const { puerto } = puertoFalso();
    simularSerial(() => Promise.resolve(puerto));
    render(<App permitirSimulador={false} />);
    await conectarDispositivo(usuario);
  }
}

const encabezados = () =>
  screen.getAllByRole('heading').map((h) => ({
    nivel: Number(h.tagName.slice(1)),
    texto: h.textContent ?? '',
  }));

describe('distribución de la pantalla', () => {
  it('en desarrollo hay tres zonas en este orden: Aprender, Practicar y Herramientas de prueba', async () => {
    await esperarPantallaLista(true);

    const zonas = encabezados()
      .filter((h) => h.nivel === 2)
      .map((h) => h.texto);

    expect(zonas).toEqual([
      'Dispositivo',
      'Aprender: lectura',
      'Practicar: escritura',
      'Herramientas de prueba',
    ]);
  });

  it('cada sección está dentro de su zona', async () => {
    await esperarPantallaLista(true);

    const dentro = (zona: string, seccion: string) =>
      screen
        .getByRole('region', { name: zona })
        .contains(screen.getByRole('region', { name: seccion }));

    expect(dentro('Aprender: lectura', 'Presentación de letras')).toBe(true);
    expect(dentro('Practicar: escritura', 'Escritura')).toBe(true);
    expect(dentro('Herramientas de prueba', 'Lectura')).toBe(true);
  });

  it('la jerarquía de encabezados no salta niveles', async () => {
    await esperarPantallaLista(true);

    const niveles = encabezados().map((h) => h.nivel);

    expect(niveles[0]).toBe(1);
    niveles.slice(1).forEach((nivel, i) => {
      expect(nivel, `tras el nivel ${niveles[i]}`).toBeLessThanOrEqual(niveles[i]! + 1);
    });
  });

  it('en producción no hay herramientas de prueba ni la lectura técnica', async () => {
    await esperarPantallaLista(false);

    expect(screen.queryByRole('region', { name: 'Herramientas de prueba' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Lectura' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Presentación de letras' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Escritura' })).toBeTruthy();
  });

  it('la pantalla completa no tiene violaciones de axe, ni de orden de encabezados', async () => {
    await esperarPantallaLista(true);

    // jsdom no calcula diseño: el contraste y el tamaño se revisan a mano.
    const resultado = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
