import { describe, expect, it } from 'vitest';
import {
  describirPuntos,
  espejo,
  mascaraACadena,
  mascaraAPuntos,
  mascaraDesdeCadena,
  puntosAMascara,
} from '../src';

describe('celda', () => {
  it('usa la misma convención que docs/PROTOCOLO.md', () => {
    expect(puntosAMascara([1, 4])).toBe(9); // c
    expect(puntosAMascara([1, 4, 5])).toBe(25); // d
    expect(mascaraDesdeCadena('145')).toBe(25);
    expect(mascaraACadena(25)).toBe('145');
  });

  it('máscara ↔ puntos ida y vuelta para las 64 celdas', () => {
    for (let m = 0; m < 64; m++) expect(puntosAMascara(mascaraAPuntos(m))).toBe(m);
  });

  it('rechaza puntos y máscaras fuera de rango', () => {
    expect(() => puntosAMascara([7])).toThrow(RangeError);
    expect(() => puntosAMascara([0])).toThrow(RangeError);
    expect(() => mascaraAPuntos(64)).toThrow(RangeError);
    expect(() => espejo(-1)).toThrow(RangeError);
  });

  it.each([
    [0, 'celda vacía'],
    [1, 'punto 1'],
    [9, 'puntos 1 y 4'],
    [25, 'puntos 1, 4 y 5'],
  ])('describe %i como "%s"', (m, texto) => {
    expect(describirPuntos(m)).toBe(texto);
  });
});
