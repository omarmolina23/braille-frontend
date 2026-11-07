// RF-01: conectar el dispositivo por USB solo con una acción explícita de la persona.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { NOMBRE_BOTON_CONECTAR as NOMBRE_BOTON, puertoFalso, simularSerial } from './ayudas';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RF-01: conexión por acción explícita', () => {
  it('al cargar no pide ni abre ningún puerto', () => {
    const { abrir, puerto } = puertoFalso();
    const { solicitar } = simularSerial(() => Promise.resolve(puerto));

    render(<App />);

    expect(solicitar).not.toHaveBeenCalled();
    expect(abrir).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: NOMBRE_BOTON })).toBeTruthy();
  });

  it('el botón se alcanza con el teclado y se activa con Enter', async () => {
    const usuario = userEvent.setup();
    const { puerto } = puertoFalso();
    const { solicitar } = simularSerial(() => Promise.resolve(puerto));
    render(<App />);
    const boton = screen.getByRole('button', { name: NOMBRE_BOTON });

    for (let i = 0; i < 100 && document.activeElement !== boton; i += 1) await usuario.tab();
    expect(document.activeElement).toBe(boton);

    await usuario.keyboard('{Enter}');
    expect(solicitar).toHaveBeenCalledTimes(1);
  });

  it('anuncia en español que el dispositivo quedó listo', async () => {
    const usuario = userEvent.setup();
    const { puerto, abrir } = puertoFalso();
    simularSerial(() => Promise.resolve(puerto));
    render(<App />);

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON }));

    const estado = screen.getByRole('status');
    expect(await screen.findByText(/^Dispositivo listo\./, {}, { timeout: 3000 })).toBe(estado);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('anuncia en español que se cerró la lista sin elegir un puerto', async () => {
    const usuario = userEvent.setup();
    simularSerial(() =>
      Promise.reject(new DOMException('No port selected by the user.', 'NotFoundError')),
    );
    render(<App />);

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON }));

    const anuncio = await screen.findByText(/^No se abrió ningún puerto/);
    expect(screen.getByRole('status')).toBe(anuncio);
    expect(anuncio.textContent).toContain('Se cerró la lista sin elegir un puerto.');
    expect(anuncio.textContent).not.toMatch(/No port selected/);
  });

  it('anuncia en español que el puerto está ocupado y deja reintentar', async () => {
    const usuario = userEvent.setup();
    const { puerto } = puertoFalso({ puertoOcupado: true });
    simularSerial(() => Promise.resolve(puerto));
    render(<App />);

    await usuario.click(screen.getByRole('button', { name: NOMBRE_BOTON }));

    const anuncio = await screen.findByText(/^No se pudo conectar/);
    expect(screen.getByRole('status')).toBe(anuncio);
    expect(anuncio.textContent).toContain('El puerto está ocupado');
    expect(anuncio.textContent).not.toMatch(/Failed to open/);
    expect(await screen.findByRole('button', { name: NOMBRE_BOTON })).toBeTruthy();
  });

  it('sin Web Serial explica por qué no se puede conectar y no ofrece el botón', () => {
    vi.stubGlobal('navigator', {});

    render(<App />);

    expect(screen.queryByRole('button', { name: NOMBRE_BOTON })).toBeNull();
    expect(screen.getByText(/Este navegador no permite conectar el dispositivo/)).toBeTruthy();
  });

  it('la pantalla de conexión no tiene fallas de accesibilidad detectables por axe', async () => {
    const { puerto } = puertoFalso();
    simularSerial(() => Promise.resolve(puerto));
    const { container } = render(<App />);

    // jsdom no calcula diseño: el contraste y el tamaño se revisan a mano (PRUEBAS-NVDA.md).
    const resultado = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
