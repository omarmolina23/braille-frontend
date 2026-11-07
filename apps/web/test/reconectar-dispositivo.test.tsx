// RF-02: detectar la desconexión, avisar y reconectar sin perder el ejercicio en curso.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import {
  ESPERA,
  NOMBRE_BOTON_RECONECTAR,
  conectarDispositivo,
  puertoFalso,
  registrarAnuncios,
  simularSerial,
  type Usuario,
} from './ayudas';

const AVISO_DESCONEXION = /^Se desconectó el dispositivo\./;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Conecta y retira el cable; espera el aviso. */
async function conectarYDesconectar(usuario: Usuario, retirarCable: () => void) {
  await conectarDispositivo(usuario);
  retirarCable();
  await screen.findByText(AVISO_DESCONEXION, {}, ESPERA);
}

describe('RF-02: aviso de desconexión', () => {
  it('anuncia en español qué pasó y ofrece reconectar', async () => {
    const usuario = userEvent.setup();
    const { falso, puerto } = puertoFalso();
    simularSerial(() => Promise.resolve(puerto));
    render(<App />);

    await conectarYDesconectar(usuario, () => falso.desconectarCable());

    const aviso = screen.getByRole('status');
    expect(aviso.textContent).toBe(
      'Se desconectó el dispositivo. Puedes reconectarlo o seguir con la celda virtual.',
    );
    expect(screen.getByRole('button', { name: NOMBRE_BOTON_RECONECTAR })).toBeTruthy();
  });

  it('si la orden en curso falla por la desconexión, solo anuncia la desconexión', async () => {
    const usuario = userEvent.setup();
    const { falso, puerto } = puertoFalso({ responderAck: false });
    // Un cierre lento separa la falla de la orden del aviso de desconexión (más de 60 ms): sin
    // esto React junta los dos anuncios en uno y la prueba no vería el sobrante.
    const cerrarPuerto = puerto.close.bind(puerto);
    puerto.close = async () => {
      await new Promise((r) => setTimeout(r, 150));
      await cerrarPuerto();
    };
    simularSerial(() => Promise.resolve(puerto));
    render(<App />);
    await conectarDispositivo(usuario);
    const anuncios = registrarAnuncios(screen.getByRole('status'));

    await usuario.click(screen.getByRole('button', { name: 'Levantar en la celda' }));
    await vi.waitFor(() => expect(falso.recibidos.some((m) => m.t === 'cell')).toBe(true));
    falso.desconectarCable();
    await screen.findByText(AVISO_DESCONEXION, {}, ESPERA);
    await new Promise((r) => setTimeout(r, 300));

    expect(anuncios.filter((a) => a.startsWith('La celda no respondió'))).toEqual([]);
    expect(anuncios.at(-1)).toMatch(AVISO_DESCONEXION);
  });

  it('no deja un acorde a medias en el visor', async () => {
    const usuario = userEvent.setup();
    const { falso, puerto } = puertoFalso();
    simularSerial(() => Promise.resolve(puerto));
    render(<App />);
    await conectarDispositivo(usuario);
    falso.presionarPunto(1);
    await screen.findByText(/^Escribiendo con el dispositivo/);

    falso.desconectarCable();
    await screen.findByText(AVISO_DESCONEXION, {}, ESPERA);

    expect(screen.queryByText(/^Escribiendo con el dispositivo/)).toBeNull();
  });
});

describe('RF-02: reconectar', () => {
  it('conserva la serie y la letra del ejercicio', async () => {
    const usuario = userEvent.setup();
    const { falso, puerto } = puertoFalso();
    simularSerial(() => Promise.resolve(puerto), [puerto]);
    render(<App />);
    await conectarDispositivo(usuario);
    await usuario.selectOptions(screen.getByLabelText('Letra que se dicta'), 'm');
    falso.desconectarCable();
    await screen.findByText(AVISO_DESCONEXION, {}, ESPERA);

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON_RECONECTAR }));

    await screen.findByText(/^Dispositivo listo\. Escribe la eme\./, {}, ESPERA);
    expect((screen.getByRole('radio', { name: /Serie 2/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('con un solo puerto autorizado no abre el selector', async () => {
    const usuario = userEvent.setup();
    const { falso, puerto } = puertoFalso();
    const { solicitar } = simularSerial(() => Promise.resolve(puerto), [puerto]);
    render(<App />);
    await conectarYDesconectar(usuario, () => falso.desconectarCable());
    solicitar.mockClear();

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON_RECONECTAR }));
    await screen.findByText(/^Dispositivo listo\./, {}, ESPERA);

    expect(solicitar).not.toHaveBeenCalled();
  });

  it.each([
    ['ningún puerto autorizado', 0],
    ['varios puertos autorizados', 2],
  ])('con %s abre el selector', async (_caso, cantidad) => {
    const usuario = userEvent.setup();
    const { falso, puerto } = puertoFalso();
    const otros = Array.from({ length: cantidad }, () => puertoFalso().puerto);
    const { solicitar } = simularSerial(() => Promise.resolve(puerto), otros);
    render(<App />);
    await conectarYDesconectar(usuario, () => falso.desconectarCable());
    solicitar.mockClear();

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON_RECONECTAR }));
    await screen.findByText(/^Dispositivo listo\./, {}, ESPERA);

    expect(solicitar).toHaveBeenCalledTimes(1);
  });

  it('si el puerto está ocupado lo explica y deja reintentar', async () => {
    const usuario = userEvent.setup();
    const { falso, puerto } = puertoFalso();
    const ocupado = puertoFalso({ puertoOcupado: true });
    simularSerial(() => Promise.resolve(puerto), [ocupado.puerto]);
    render(<App />);
    await conectarYDesconectar(usuario, () => falso.desconectarCable());

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON_RECONECTAR }));

    const anuncio = await screen.findByText(/^No se pudo conectar/, {}, ESPERA);
    expect(anuncio.textContent).toContain('El puerto está ocupado');
    expect(await screen.findByRole('button', { name: NOMBRE_BOTON_RECONECTAR })).toBeTruthy();
  });

  it('deja el foco en el área de escritura cuando el botón desaparece', async () => {
    const usuario = userEvent.setup();
    const { falso, puerto } = puertoFalso();
    simularSerial(() => Promise.resolve(puerto), [puerto]);
    render(<App />);
    await conectarYDesconectar(usuario, () => falso.desconectarCable());

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON_RECONECTAR }));
    await screen.findByText(/^Dispositivo listo\./, {}, ESPERA);

    expect(screen.queryByRole('button', { name: NOMBRE_BOTON_RECONECTAR })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('application'));
  });
});
