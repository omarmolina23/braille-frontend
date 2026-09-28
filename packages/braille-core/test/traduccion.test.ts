// Capa 3: ida y vuelta texto → celdas → texto, por signo y en frases.
import { describe, expect, it } from 'vitest';
import {
  CARACTER_DESCONOCIDO,
  MAYUSCULA,
  NUMERO,
  TABLA,
  celdasATexto,
  esLetra,
  signoPorId,
  textoACeldas,
} from '../src';

const m = (id: string) => signoPorId(id)!.mascara;
const idaYVuelta = (texto: string) => celdasATexto(textoACeldas(texto).celdas).texto;

describe.each(TABLA.filter(esLetra))('letra $id', ({ id, mascara }) => {
  it('minúscula → una celda', () => {
    expect(textoACeldas(id)).toEqual({ celdas: [mascara], noSoportados: [] });
  });

  it('mayúscula → signo de mayúscula + letra', () => {
    expect(textoACeldas(id.toLocaleUpperCase('es')).celdas).toEqual([MAYUSCULA, mascara]);
  });

  it('ida y vuelta', () => {
    expect(idaYVuelta(id)).toBe(id);
    expect(idaYVuelta(id.toLocaleUpperCase('es'))).toBe(id.toLocaleUpperCase('es'));
  });
});

describe('números', () => {
  it.each([
    ['1', 'a'],
    ['2', 'b'],
    ['3', 'c'],
    ['4', 'd'],
    ['5', 'e'],
    ['6', 'f'],
    ['7', 'g'],
    ['8', 'h'],
    ['9', 'i'],
    ['0', 'j'],
  ])('%s = signo de número + %s', (digito, letra) => {
    expect(textoACeldas(digito).celdas).toEqual([NUMERO, m(letra)]);
    expect(idaYVuelta(digito)).toBe(digito);
  });

  it('el signo de número se escribe una sola vez por cifra', () => {
    expect(textoACeldas('2026').celdas).toEqual([NUMERO, m('b'), m('j'), m('b'), m('f')]);
  });

  it('el espacio termina el número', () => {
    expect(idaYVuelta('3 casas')).toBe('3 casas');
  });

  it('una letra a–j pegada a un número queda pendiente de definir con los tiflólogos', () => {
    expect(textoACeldas('3a').noSoportados).toEqual([
      { indice: 1, caracter: 'a', motivo: 'letra-tras-numero' },
    ]);
  });
});

describe('puntuación', () => {
  it.each(['.', ',', ';', ':', '-', '"'])('ida y vuelta de "a%s"', (signo) => {
    expect(idaYVuelta(`a${signo}`)).toBe(`a${signo}`);
  });

  it.each(['¿Qué?', '¡Hola!', '(sí)', 'Ana dijo: ¿vienes?'])('ida y vuelta de "%s"', (frase) => {
    expect(idaYVuelta(frase)).toBe(frase);
  });
});

describe('frases', () => {
  it('"Ana" → mayúscula, a, n, a', () => {
    expect(textoACeldas('Ana').celdas).toEqual([MAYUSCULA, m('a'), m('n'), m('a')]);
  });

  it.each(['Ana tiene 3 años.', 'Cúcuta, Norte de Santander', 'El pingüino ñandú'])(
    'ida y vuelta de "%s"',
    (frase) => {
      const { noSoportados } = textoACeldas(frase);
      expect(noSoportados).toEqual([]);
      expect(idaYVuelta(frase)).toBe(frase);
    },
  );

  it('informa caracteres que no están en la tabla', () => {
    expect(textoACeldas('a#b').noSoportados).toEqual([
      { indice: 1, caracter: '#', motivo: 'desconocido' },
    ]);
  });

  it('marca las celdas desconocidas al retrotraducir', () => {
    const resultado = celdasATexto([m('a'), 0b111111, m('b')]);
    expect(resultado.texto).toBe(`a${CARACTER_DESCONOCIDO}b`);
    expect(resultado.desconocidas).toEqual([{ indice: 1, mascara: 0b111111 }]);
  });
});
