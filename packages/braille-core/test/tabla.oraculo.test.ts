// Capa 1: cada signo se compara contra el oráculo independiente (test/referencia.ts).
import { describe, expect, it } from 'vitest';
import { TABLA, signoPorId, signoPorMascara } from '../src';
import { referencia } from './referencia';

// Conversión propia, a propósito distinta de la de `src/celda.ts`.
const mascaraEsperada = (puntos: string) =>
  [...puntos].reduce((m, p) => m + 2 ** (Number(p) - 1), 0);

describe.each(referencia)('signo $id', ({ id, puntos, fuente }) => {
  it(`tiene los puntos ${puntos} (${fuente})`, () => {
    expect(signoPorId(id)?.mascara).toBe(mascaraEsperada(puntos));
  });

  it('se reconoce al escribirlo', () => {
    expect(signoPorMascara(mascaraEsperada(puntos))?.id).toBe(id);
  });
});

describe('cobertura del oráculo', () => {
  it('toda entrada del oráculo existe en la tabla', () => {
    const faltan = referencia.filter((r) => !signoPorId(r.id)).map((r) => r.id);
    expect(faltan).toEqual([]);
  });

  // Los signos aún sin fuente independiente se listan como pendientes, sin romper la suite.
  const conReferencia = new Set(referencia.map((r) => r.id));
  for (const s of TABLA.filter((s) => !conReferencia.has(s.id))) {
    it.todo(`${s.id}: transcribir de la signografía oficial y validar con tiflólogos`);
  }
});
