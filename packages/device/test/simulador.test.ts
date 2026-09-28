import { describe, expect, it } from 'vitest';
import { SimuladorDispositivo, crearLectorSeisTeclas } from '../src';

describe('SimuladorDispositivo', () => {
  it('muestra celdas y avisa a la celda virtual', async () => {
    const sim = new SimuladorDispositivo();
    const vistas: number[] = [];
    sim.onCelda((m) => vistas.push(m));

    await sim.conectar();
    await sim.mostrarCelda(25);
    await sim.limpiar();

    expect(vistas).toEqual([25, 0]);
    expect(sim.celdaActual).toBe(0);
  });

  it('entrega acordes y teclas solo si está conectado', async () => {
    const sim = new SimuladorDispositivo();
    const acordes: number[] = [];
    sim.onAcorde((m) => acordes.push(m));

    sim.pulsarAcorde(9);
    await sim.conectar();
    sim.pulsarAcorde(9);
    sim.pulsarAcorde(0); // un acorde vacío no existe

    expect(acordes).toEqual([9]);
  });

  it('no muestra celdas sin conexión', async () => {
    await expect(new SimuladorDispositivo().mostrarCelda(1)).rejects.toThrow();
  });
});

describe('lector de seis teclas', () => {
  it('emite el acorde al soltar todas las teclas', () => {
    const acordes: number[] = [];
    const lector = crearLectorSeisTeclas((m) => acordes.push(m));

    lector.teclaAbajo('KeyF'); // punto 1
    lector.teclaAbajo('KeyJ'); // punto 4
    lector.teclaArriba('KeyF');
    expect(acordes).toEqual([]); // todavía queda una tecla presionada
    lector.teclaArriba('KeyJ');

    expect(acordes).toEqual([9]); // c
  });

  it('las repeticiones automáticas del teclado no duplican puntos ni acordes', () => {
    const acordes: number[] = [];
    const lector = crearLectorSeisTeclas((m) => acordes.push(m));

    lector.teclaAbajo('KeyD');
    lector.teclaAbajo('KeyD', true);
    lector.teclaArriba('KeyD');

    expect(acordes).toEqual([2]);
  });

  it('ignora teclas que no son de puntos', () => {
    const lector = crearLectorSeisTeclas(() => {});
    expect(lector.teclaAbajo('KeyA')).toBe(false);
    expect(lector.teclaArriba('Space')).toBe(false);
    expect(lector.teclaAbajo('KeyL')).toBe(true);
  });
});
