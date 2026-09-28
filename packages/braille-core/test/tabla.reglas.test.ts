// Capa 2: reglas del sistema que enseñan los tiflólogos. No miran el oráculo.
import { describe, expect, it } from 'vitest';
import {
  TABLA,
  espejo,
  esMascaraValida,
  mascaraAPuntos,
  signoPorId,
  signosDeSerie,
  type Signo,
} from '../src';

const m = (id: string) => {
  const s = signoPorId(id);
  if (!s) throw new Error(`No existe el signo ${id}`);
  return s.mascara;
};
const PUNTO_3 = 0b000100;
const PUNTO_6 = 0b100000;

describe('integridad de la tabla', () => {
  it('toda máscara es válida y no vacía', () => {
    const invalidas = TABLA.filter((s) => !esMascaraValida(s.mascara) || s.mascara === 0);
    expect(invalidas.map((s) => s.id)).toEqual([]);
  });

  it('no hay dos signos con la misma máscara', () => {
    const vistos = new Map<number, string>();
    const repetidos: string[] = [];
    for (const s of TABLA) {
      const previo = vistos.get(s.mascara);
      if (previo) repetidos.push(`${previo} y ${s.id}`);
      vistos.set(s.mascara, s.id);
    }
    expect(repetidos).toEqual([]);
  });

  it('ids y caracteres son únicos', () => {
    const ids = TABLA.map((s) => s.id);
    const caracteres = TABLA.flatMap((s) => s.caracteres);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(caracteres).size).toBe(caracteres.length);
  });
});

describe('series del código generador (Entrevista #1)', () => {
  const serie1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const serie2 = ['k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'];
  const serie3 = ['u', 'v', 'x', 'y', 'z'];

  it('las series contienen exactamente las letras esperadas', () => {
    const ids = (serie: Signo[]) => serie.map((s) => s.id);
    expect(ids(signosDeSerie(1))).toEqual(serie1);
    expect(ids(signosDeSerie(2))).toEqual(serie2);
    expect(ids(signosDeSerie(3))).toEqual(serie3);
  });

  it.each(serie1)('la serie a–j solo usa los puntos 1, 2, 4 y 5: %s', (id) => {
    expect(mascaraAPuntos(m(id)).every((p) => [1, 2, 4, 5].includes(p))).toBe(true);
  });

  it.each(serie1.map((id, i) => [serie2[i]!, id] as const))('%s = %s + punto 3', (id2, id1) => {
    expect(m(id2)).toBe(m(id1) | PUNTO_3);
  });

  it.each(serie3.map((id, i) => [id, serie1[i]!] as const))(
    '%s = %s + puntos 3 y 6',
    (id3, id1) => {
      expect(m(id3)).toBe(m(id1) | PUNTO_3 | PUNTO_6);
    },
  );
});

describe('espejo', () => {
  it.each([
    ['d', 'f'],
    ['e', 'i'],
    ['h', 'j'],
  ])('%s y %s son espejo una de la otra', (x, y) => {
    expect(espejo(m(x))).toBe(m(y));
    expect(espejo(m(y))).toBe(m(x));
  });

  it('aplicar el espejo dos veces devuelve la misma celda (las 64 celdas)', () => {
    for (let mascara = 0; mascara < 64; mascara++) {
      expect(espejo(espejo(mascara))).toBe(mascara);
    }
  });

  it('el espejo conserva la cantidad de puntos', () => {
    for (let mascara = 0; mascara < 64; mascara++) {
      expect(mascaraAPuntos(espejo(mascara))).toHaveLength(mascaraAPuntos(mascara).length);
    }
  });
});
