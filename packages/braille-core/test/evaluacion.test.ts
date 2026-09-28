// Capa 4: clasificación de errores generada automáticamente para cada signo.
import { describe, expect, it } from 'vitest';
import {
  PUNTOS,
  TABLA,
  describirEvaluacion,
  espejo,
  evaluar,
  mascaraAPuntos,
  signoPorId,
} from '../src';

const bit = (p: number) => 1 << (p - 1);

describe.each(TABLA)('signo $id', ({ mascara }) => {
  const presentes = mascaraAPuntos(mascara);
  const ausentes = PUNTOS.filter((p) => !presentes.includes(p));

  it('escribirlo igual es acierto', () => {
    expect(evaluar(mascara, mascara).tipo).toBe('acierto');
  });

  it.each(presentes)('quitar el punto %i es faltante', (p) => {
    const e = evaluar(mascara, mascara & ~bit(p));
    expect(e.tipo).toBe('faltante');
    expect(e.faltantes).toEqual([p]);
    expect(e.sobrantes).toEqual([]);
  });

  it.each(ausentes)('agregar el punto %i es sobrante', (p) => {
    const e = evaluar(mascara, mascara | bit(p));
    expect(e.tipo).toBe('sobrante');
    expect(e.sobrantes).toEqual([p]);
    expect(e.faltantes).toEqual([]);
  });

  it.runIf(espejo(mascara) !== mascara)('su espejo es error de espejo', () => {
    expect(evaluar(mascara, espejo(mascara)).tipo).toBe('espejo');
  });
});

describe('mensajes de retroalimentación', () => {
  const s = (id: string) => signoPorId(id)!;
  const mensaje = (esperado: string, recibida: number) =>
    describirEvaluacion(evaluar(s(esperado).mascara, recibida), s(esperado));

  it('acierto', () => {
    expect(mensaje('d', s('d').mascara)).toBe('Correcto: la de.');
  });

  it('espejo nombra la letra que escribió', () => {
    expect(mensaje('d', s('f').mascara)).toBe('Escribiste la efe. Es la de en espejo.');
  });

  it('faltante', () => {
    expect(mensaje('d', s('c').mascara)).toBe('Escribiste la ce. Falta el punto 5.');
  });

  it('sobrante con varios puntos', () => {
    expect(mensaje('a', s('m').mascara)).toBe('Escribiste la eme. Sobran los puntos 3 y 4.');
  });

  it('mixto', () => {
    expect(mensaje('c', s('b').mascara)).toBe(
      'Escribiste la be. Falta el punto 4 y sobra el punto 2.',
    );
  });

  it('sin signo reconocido no inventa una letra', () => {
    expect(mensaje('a', 0b111111)).toBe('Sobran los puntos 2, 3, 4, 5 y 6.');
  });
});
