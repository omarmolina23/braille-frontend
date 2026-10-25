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

  it('soltar las teclas de un acorde una por una no las quita', () => {
    const acordes: number[] = [];
    const lector = crearLectorSeisTeclas((m) => acordes.push(m));

    lector.teclaAbajo('KeyF'); // punto 1
    lector.teclaAbajo('KeyD'); // punto 2
    lector.teclaAbajo('KeyJ'); // punto 4
    lector.teclaArriba('KeyD');
    lector.teclaArriba('KeyF');
    lector.teclaArriba('KeyJ');

    expect(acordes).toEqual([11]); // f
  });

  it('una tecla soltada antes de presionar otra ya no cuenta en el acorde', () => {
    const acordes: number[] = [];
    const lector = crearLectorSeisTeclas((m) => acordes.push(m));

    lector.teclaAbajo('KeyF'); // punto 1, se mantiene
    lector.teclaAbajo('KeyD'); // punto 2, equivocado
    lector.teclaArriba('KeyD'); // se corrige soltándolo
    lector.teclaAbajo('KeyK'); // punto 5
    lector.teclaArriba('KeyF');
    lector.teclaArriba('KeyK');

    expect(acordes).toEqual([17]); // e: puntos 1 y 5, sin el 2
  });

  it('ignora teclas que no son de puntos', () => {
    const lector = crearLectorSeisTeclas(() => {});
    expect(lector.teclaAbajo('KeyA')).toBe(false);
    expect(lector.teclaArriba('Space')).toBe(false);
    expect(lector.teclaAbajo('KeyL')).toBe(true);
  });

  it('informa los puntos presionados y el acorde en curso mientras se escribe', () => {
    const estados: { presionados: number; acorde: number }[] = [];
    const lector = crearLectorSeisTeclas(
      () => {},
      (e) => estados.push(e),
    );

    lector.teclaAbajo('KeyF'); // punto 1
    lector.teclaAbajo('KeyF', true); // repetición: no cambia nada
    lector.teclaAbajo('KeyK'); // punto 5
    lector.teclaArriba('KeyF');
    lector.teclaArriba('KeyK');
    lector.teclaAbajo('KeyS'); // punto 3
    lector.reiniciar();

    expect(estados).toEqual([
      { presionados: 1, acorde: 1 },
      { presionados: 17, acorde: 17 },
      { presionados: 16, acorde: 17 },
      { presionados: 0, acorde: 0 }, // se emitió el acorde
      { presionados: 4, acorde: 4 },
      { presionados: 0, acorde: 0 },
    ]);
  });
});
