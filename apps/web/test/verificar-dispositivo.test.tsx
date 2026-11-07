// RF-34: el dispositivo es obligatorio. Se verifica al entrar y la práctica solo existe con el
// dispositivo listo (ADR-0012). "Producción" es `permitirSimulador={false}`: sin simulador.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import {
  ESPERA,
  NOMBRE_BOTON_CONECTAR,
  NOMBRE_BOTON_RECONECTAR,
  conectarDispositivo,
  puertoFalso,
  registrarAnuncios,
  simularSerial,
} from './ayudas';

const SIN_DISPOSITIVO =
  'No hay un dispositivo conectado. Conecta el cable USB y activa «Conectar dispositivo por USB». Si no funciona, pide ayuda a tu tutor.';
const SIN_WEB_SERIAL =
  'Este navegador no permite usar el dispositivo. Abre el sitio en Chrome o Edge de escritorio, o pide ayuda a tu tutor.';
const DESCONEXION =
  'Se desconectó el dispositivo. Revisa el cable y activa «Reconectar». Tu ejercicio sigue donde lo dejaste.';
const ACTUALIZACION = 'El dispositivo necesita una actualización. Pide ayuda a tu tutor.';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const hayPractica = () =>
  screen.queryByRole('region', { name: 'Lectura' }) !== null ||
  screen.queryByRole('region', { name: 'Escritura' }) !== null;

function entrar(requestPort: () => Promise<unknown>, autorizados: readonly unknown[] = []) {
  const espias = simularSerial(requestPort, autorizados);
  render(<App permitirSimulador={false} />);
  return espias;
}

describe('RF-34: al entrar', () => {
  it('sin dispositivo anuncia qué hacer, no ofrece práctica y no usa el simulador', async () => {
    const { puerto } = puertoFalso();
    entrar(() => Promise.resolve(puerto));

    await screen.findByText(SIN_DISPOSITIVO, {}, ESPERA);

    expect(screen.getByRole('status').textContent).toBe(SIN_DISPOSITIVO);
    expect(hayPractica()).toBe(false);
    expect(screen.queryByText(/simulador/i)).toBeNull();
    expect(screen.getByRole('button', { name: NOMBRE_BOTON_CONECTAR })).toBeTruthy();
  });

  it('no abre el selector ni el puerto sin un clic', async () => {
    const { puerto, abrir } = puertoFalso();
    const { solicitar } = entrar(() => Promise.resolve(puerto), [puerto]);

    await screen.findByText(SIN_DISPOSITIVO, {}, ESPERA);

    expect(solicitar).not.toHaveBeenCalled();
    expect(abrir).not.toHaveBeenCalled();
  });

  it('sin Web Serial lo explica, sin botón de conectar y sin práctica', async () => {
    vi.stubGlobal('navigator', {});
    render(<App permitirSimulador={false} />);

    await screen.findByText(SIN_WEB_SERIAL, {}, ESPERA);

    expect(screen.queryByRole('button', { name: NOMBRE_BOTON_CONECTAR })).toBeNull();
    expect(hayPractica()).toBe(false);
    expect(screen.queryByText(/celda virtual/i)).toBeNull();
  });

  it('con el dispositivo listo aparece la práctica y se anuncia', async () => {
    const usuario = userEvent.setup();
    const { puerto } = puertoFalso();
    entrar(() => Promise.resolve(puerto));

    await conectarDispositivo(usuario);

    expect(screen.getByRole('region', { name: 'Lectura' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Escritura' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/^Dispositivo listo\. Escribe la a\./);
  });

  it('si la conexión falla no cae al simulador y deja volver a intentar', async () => {
    const usuario = userEvent.setup();
    const { puerto } = puertoFalso({ puertoOcupado: true });
    entrar(() => Promise.resolve(puerto));

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON_CONECTAR }));
    const fallo = await screen.findByText(/^No se pudo conectar/, {}, ESPERA);

    expect(fallo.textContent).toContain('El puerto está ocupado');
    expect(hayPractica()).toBe(false);
    expect(screen.queryByRole('button', { name: 'Volver al simulador' })).toBeNull();
    expect(screen.queryByText(/simulador/i)).toBeNull();
    expect(
      screen.queryByRole('button', { name: NOMBRE_BOTON_CONECTAR }) ??
        screen.queryByRole('button', { name: NOMBRE_BOTON_RECONECTAR }),
    ).toBeTruthy();
  });

  it('con un firmware de otra versión pide una actualización y no ofrece práctica', async () => {
    const usuario = userEvent.setup();
    const { puerto } = puertoFalso({ protocolo: 2 });
    entrar(() => Promise.resolve(puerto));

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON_CONECTAR }));

    await screen.findByText(ACTUALIZACION, {}, ESPERA);
    expect(screen.getByRole('status').textContent).toBe(ACTUALIZACION);
    expect(hayPractica()).toBe(false);
  });
});

describe('RF-34: si se pierde el dispositivo', () => {
  async function conectarYPerder() {
    const usuario = userEvent.setup();
    const { falso, puerto } = puertoFalso();
    entrar(() => Promise.resolve(puerto), [puerto]);
    await conectarDispositivo(usuario);
    return { usuario, falso };
  }

  it('pausa la práctica, lo anuncia sin ofrecer la celda virtual y lleva el foco a Reconectar', async () => {
    const { falso } = await conectarYPerder();

    falso.desconectarCable();

    await screen.findByText(DESCONEXION, {}, ESPERA);
    expect(screen.getByRole('status').textContent).toBe(DESCONEXION);
    expect(hayPractica()).toBe(false);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: NOMBRE_BOTON_RECONECTAR }),
    );
  });

  it('escribir con el teclado F D S J K L no evalúa nada', async () => {
    const { usuario, falso } = await conectarYPerder();
    falso.desconectarCable();
    await screen.findByText(DESCONEXION, {}, ESPERA);
    const anuncios = registrarAnuncios(screen.getByRole('status'));

    await usuario.keyboard('fj');
    await new Promise((r) => setTimeout(r, 200));

    expect(anuncios).toEqual([]);
    expect(screen.getByRole('status').textContent).toBe(DESCONEXION);
  });

  it('al reconectar vuelve la práctica con la misma serie y letra y el foco en el área', async () => {
    const { usuario, falso } = await conectarYPerder();
    await usuario.selectOptions(screen.getByLabelText('Letra que se dicta'), 'm');
    falso.desconectarCable();
    await screen.findByText(DESCONEXION, {}, ESPERA);

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON_RECONECTAR }));

    await screen.findByText(/^Dispositivo listo\. Escribe la eme\./, {}, ESPERA);
    expect((screen.getByRole('radio', { name: /Serie 2/ }) as HTMLInputElement).checked).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('application'));
  });
});

describe('RF-34: modo de desarrollo', () => {
  it('con el simulador permitido lo rotula y la práctica sigue disponible', async () => {
    vi.stubGlobal('navigator', {});
    render(<App permitirSimulador />);

    await screen.findByText(/^Simulador listo\./, {}, ESPERA);

    expect(screen.getByText('Modo de desarrollo: simulador')).toBeTruthy();
    expect(hayPractica()).toBe(true);
  });
});

describe('RF-34: accesibilidad de la pantalla sin dispositivo', () => {
  it('no tiene violaciones de axe, anuncia una sola vez y el primer control es Conectar', async () => {
    const usuario = userEvent.setup();
    const { puerto } = puertoFalso();
    simularSerial(() => Promise.resolve(puerto));
    const { container } = render(<App permitirSimulador={false} />);
    const anuncios = registrarAnuncios(screen.getByRole('status'));
    await screen.findByText(SIN_DISPOSITIVO, {}, ESPERA);
    await new Promise((r) => setTimeout(r, 300));

    // jsdom no calcula diseño: el contraste y el tamaño se revisan a mano.
    const resultado = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(anuncios).toEqual([SIN_DISPOSITIVO]);

    await usuario.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: NOMBRE_BOTON_CONECTAR }),
    );
  });
});
