// RF-07: repetir la presentación de la letra actual cuantas veces se pida, desde la pantalla o con
// la tecla Repetir del dispositivo. La tecla repite lo último: la presentación o la instrucción de
// escritura.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import {
  ESPERA,
  NOMBRE_BOTON_RECONECTAR,
  conectarDispositivo,
  puertoFalso,
  simularSerial,
} from './ayudas';

const PRESENTAR = 'Presentar la letra';
const SIGUIENTE = 'Siguiente letra';
const PRESENTACION_A = 'Letra 1 de 10. Toque la celda. Esta es la a.';
const INVITA_A_TOCAR = /toque/i;
const AVISO_DESCONEXION = /^Se desconectó el dispositivo\./;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Falso = ReturnType<typeof puertoFalso>['falso'];

/**
 * Cada anuncio, aunque repita el texto del anterior. `registrarAnuncios` junta los iguales
 * seguidos; aquí se cuentan porque repetir es justamente decir lo mismo otra vez.
 */
function registrarCadaAnuncio(region: HTMLElement): string[] {
  const textos: string[] = [];
  let anterior = region.textContent ?? '';
  new MutationObserver(() => {
    const texto = region.textContent ?? '';
    if (texto !== '' && texto !== anterior) textos.push(texto);
    anterior = texto;
  }).observe(region, { childList: true, characterData: true, subtree: true });
  return textos;
}

async function montar(opciones: Parameters<typeof puertoFalso>[0] = {}) {
  const usuario = userEvent.setup();
  const { falso, puerto } = puertoFalso(opciones);
  simularSerial(() => Promise.resolve(puerto));
  render(<App />);
  await conectarDispositivo(usuario);
  const anuncios = registrarCadaAnuncio(screen.getByRole('status'));
  return { usuario, falso, anuncios };
}

const mascaras = (falso: Falso) => falso.recibidos.flatMap((m) => (m.t === 'cell' ? [m.m] : []));
const ordenesCell = (falso: Falso) => falso.recibidos.filter((m) => m.t === 'cell');
const boton = (nombre: string) => screen.getByRole('button', { name: nombre });
const pulsarRepetir = (falso: Falso) => falso.emitir({ t: 'key', k: 'repeat' });

/** Espera a que el firmware reciba la orden `cell` número `n` (desde 1) y la devuelve. */
async function esperarCell(falso: Falso, n: number) {
  return vi.waitFor(() => {
    const orden = ordenesCell(falso)[n - 1];
    if (!orden) throw new Error(`Todavía no llega el cell ${n}.`);
    return orden;
  }, ESPERA);
}

/** Presenta la letra actual y espera su anuncio. */
async function presentar(usuario: ReturnType<typeof userEvent.setup>, anuncios: string[]) {
  const antes = anuncios.length;
  await usuario.click(boton(PRESENTAR));
  await vi.waitFor(() => expect(anuncios.length).toBe(antes + 1), ESPERA);
}

/** Escribe un acorde con los pulsadores del dispositivo. */
function escribirConPulsadores(falso: Falso, puntos: number[]) {
  puntos.forEach((p) => falso.presionarPunto(p));
  puntos.forEach((p) => falso.soltarPunto(p));
}

describe('RF-07: repetir desde la pantalla', () => {
  it('presentar tres veces levanta y narra la misma letra tres veces, cada una tras su ack', async () => {
    const { usuario, falso, anuncios } = await montar();

    for (let i = 0; i < 3; i += 1) await presentar(usuario, anuncios);

    expect(mascaras(falso)).toEqual([1, 1, 1]);
    expect(anuncios).toEqual([PRESENTACION_A, PRESENTACION_A, PRESENTACION_A]);
  });

  it('el foco se queda en "Presentar la letra" y el botón sigue habilitado', async () => {
    const { usuario, anuncios } = await montar();

    await presentar(usuario, anuncios);
    await presentar(usuario, anuncios);

    expect(document.activeElement).toBe(boton(PRESENTAR));
    expect((boton(PRESENTAR) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('RF-07: tecla Repetir del dispositivo', () => {
  it('tras presentar, vuelve a levantar la letra y la narra de nuevo', async () => {
    const { usuario, falso, anuncios } = await montar();
    await presentar(usuario, anuncios);

    pulsarRepetir(falso);

    await vi.waitFor(() => expect(anuncios).toEqual([PRESENTACION_A, PRESENTACION_A]), ESPERA);
    expect(mascaras(falso)).toEqual([1, 1]);
  });

  it('no invita a tocar antes del ack', async () => {
    const { usuario, falso, anuncios } = await montar({ retardoAckMs: 1_000 });
    await presentar(usuario, anuncios);

    pulsarRepetir(falso);
    await esperarCell(falso, 2);
    await new Promise((r) => setTimeout(r, 500));
    expect(anuncios.filter((a) => INVITA_A_TOCAR.test(a))).toHaveLength(1);

    await vi.waitFor(() => expect(anuncios).toEqual([PRESENTACION_A, PRESENTACION_A]), ESPERA);
  });

  it('tras "Siguiente letra" presenta la letra actual', async () => {
    const { usuario, falso, anuncios } = await montar();
    await presentar(usuario, anuncios);
    await usuario.click(boton(SIGUIENTE));
    await screen.findByText('Letra 2 de 10.', {}, ESPERA);

    pulsarRepetir(falso);

    await screen.findByText(/^Letra 2 de 10\. Toque la celda\. Esta es la be\./, {}, ESPERA);
    expect(mascaras(falso)).toEqual([1, 3]); // b = puntos 1 y 2
  });

  it('tras escribir, repite la instrucción de escritura y no mueve la celda', async () => {
    const { usuario, falso, anuncios } = await montar();
    await presentar(usuario, anuncios);
    escribirConPulsadores(falso, [1]); // la a: acierto
    await screen.findByText(/Ahora escribe la be\.$/, {}, ESPERA);
    await esperarCell(falso, 2); // el eco de lo escrito

    pulsarRepetir(falso);

    await screen.findByText('Escribe la be.', {}, ESPERA);
    await new Promise((r) => setTimeout(r, 100));
    expect(mascaras(falso)).toEqual([1, 1]);
  });

  it('sin haber presentado nada, repite la instrucción de escritura', async () => {
    const { falso } = await montar();

    pulsarRepetir(falso);

    await screen.findByText('Escribe la a.', {}, ESPERA);
    await new Promise((r) => setTimeout(r, 100));
    expect(mascaras(falso)).toEqual([]);
  });

  it('tras reconectar, repite lo último narrado: la instrucción de escritura', async () => {
    const { usuario, falso, anuncios } = await montar();
    await presentar(usuario, anuncios);
    falso.desconectarCable();
    await screen.findByText(AVISO_DESCONEXION, {}, ESPERA);
    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON_RECONECTAR }));
    await screen.findByText('Dispositivo listo. Escribe la a.', {}, ESPERA);

    pulsarRepetir(falso);

    await screen.findByText('Escribe la a.', {}, ESPERA);
    await new Promise((r) => setTimeout(r, 100));
    expect(mascaras(falso)).toEqual([1]);
  });

  it('tras cambiar de serie, repite la instrucción de escritura de la serie nueva', async () => {
    const { usuario, falso, anuncios } = await montar();
    await presentar(usuario, anuncios);
    await usuario.click(screen.getByRole('radio', { name: /Serie 2/ }));
    await screen.findByText(/^Serie 2:/, {}, ESPERA);

    pulsarRepetir(falso);

    await screen.findByText('Escribe la ka.', {}, ESPERA);
    expect(mascaras(falso)).toEqual([1]);
  });
});

describe('RF-07: errores al repetir', () => {
  it('si el firmware responde con un error, no invita a tocar y lo explica', async () => {
    const { usuario, falso, anuncios } = await montar({ responderAck: false });
    await usuario.click(boton(PRESENTAR));
    falso.emitir({ t: 'ack', id: (await esperarCell(falso, 1)).id, ms: 5 });
    await screen.findByText(PRESENTACION_A, {}, ESPERA);

    pulsarRepetir(falso);
    falso.emitir({ t: 'err', id: (await esperarCell(falso, 2)).id, code: 'SERVO_TIMEOUT' });

    const fallo = await screen.findByText(/^La celda no respondió:/, {}, ESPERA);
    expect(fallo.textContent).toContain('Los servos no llegaron a su posición a tiempo.');
    expect(anuncios.filter((a) => INVITA_A_TOCAR.test(a))).toHaveLength(1);
  });

  it('si se desconecta antes del ack, solo avisa la desconexión', async () => {
    const { usuario, falso, anuncios } = await montar({ responderAck: false });
    await usuario.click(boton(PRESENTAR));
    falso.emitir({ t: 'ack', id: (await esperarCell(falso, 1)).id, ms: 5 });
    await screen.findByText(PRESENTACION_A, {}, ESPERA);

    pulsarRepetir(falso);
    await esperarCell(falso, 2);
    falso.desconectarCable();

    await screen.findByText(AVISO_DESCONEXION, {}, ESPERA);
    await new Promise((r) => setTimeout(r, 200));
    expect(anuncios.slice(1)).toHaveLength(1);
    expect(anuncios[1]).toMatch(AVISO_DESCONEXION);
  });
});

describe('RF-07: accesibilidad', () => {
  it('la sección dice que se puede repetir y no tiene violaciones de axe', async () => {
    await montar();
    const seccion = screen.getByRole('region', { name: 'Presentación de letras' });

    expect(seccion.textContent).toContain('Puedes presentarla cuantas veces quieras.');
    // jsdom no calcula diseño: el contraste y el tamaño se revisan a mano.
    const resultado = await axe.run(seccion, { rules: { 'color-contrast': { enabled: false } } });
    expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
