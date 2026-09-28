import { mascaraDesdeCadena, type Mascara } from './celda';

/**
 * TABLA DE SIGNOS DEL BRAILLE INTEGRAL EN ESPAÑOL (versión inicial).
 *
 * ⚠️ Estado de validación: solo los signos que aparecen en `test/referencia.ts` están verificados
 * contra una fuente independiente (la Entrevista #1 con tiflólogos). Los demás son valores de
 * partida y deben transcribirse de la signografía oficial usada en Colombia y validarse con los
 * tiflólogos. Cada signo sin referencia aparece como "todo" al correr las pruebas.
 *
 * Esta tabla es un DATO: corregir un signo es cambiar una línea aquí y su línea en el oráculo.
 */

export type Categoria = 'letra' | 'letra-especial' | 'prefijo' | 'puntuacion';
export type Serie = 1 | 2 | 3;

export interface Signo {
  /** Identificador estable: 'a', 'ñ', 'mayuscula', 'interrogacion'… */
  readonly id: string;
  readonly mascara: Mascara;
  /** Cómo se nombra en voz: 'de', 'eñe', 'signo de mayúscula'. */
  readonly nombre: string;
  readonly categoria: Categoria;
  /** Caracteres en tinta que representa. Vacío en los prefijos. */
  readonly caracteres: readonly string[];
  /** Para signos que se escriben igual al abrir y al cerrar (¿?, ¡!). */
  readonly par?: { readonly apertura: string; readonly cierre: string };
  /** Serie del código generador según el orden de enseñanza (a–j, k–t, u–z). */
  readonly serie?: Serie;
  /** Descripción táctil de la forma, tal como la enseñan los tiflólogos. */
  readonly figura?: string;
}

type Extras = Partial<Pick<Signo, 'par' | 'serie' | 'figura'>>;

function signo(
  id: string,
  puntos: string,
  nombre: string,
  categoria: Categoria,
  caracteres: readonly string[],
  extras: Extras = {},
): Signo {
  return { id, mascara: mascaraDesdeCadena(puntos), nombre, categoria, caracteres, ...extras };
}

const letra = (id: string, puntos: string, nombre: string, extras: Extras = {}) =>
  signo(id, puntos, nombre, 'letra', [id], extras);

const especial = (id: string, puntos: string, nombre: string) =>
  signo(id, puntos, nombre, 'letra-especial', [id]);

export const TABLA: readonly Signo[] = [
  // Serie 1: a–j. Solo usa los puntos 1, 2, 4 y 5.
  letra('a', '1', 'a', { serie: 1 }),
  letra('b', '12', 'be', { serie: 1 }),
  letra('c', '14', 'ce', { serie: 1 }),
  letra('d', '145', 'de', { serie: 1, figura: 'codo a la derecha' }),
  letra('e', '15', 'e', { serie: 1 }),
  letra('f', '124', 'efe', { serie: 1, figura: 'codo a la izquierda' }),
  letra('g', '1245', 'ge', { serie: 1 }),
  letra('h', '125', 'hache', { serie: 1, figura: 'codo hacia abajo' }),
  letra('i', '24', 'i', { serie: 1 }),
  letra('j', '245', 'jota', { serie: 1, figura: 'codo hacia abajo, a la derecha' }),

  // Serie 2: k–t = serie 1 + punto 3 (la ñ no entra en la serie).
  letra('k', '13', 'ka', { serie: 2 }),
  letra('l', '123', 'ele', { serie: 2 }),
  letra('m', '134', 'eme', { serie: 2 }),
  letra('n', '1345', 'ene', { serie: 2 }),
  letra('o', '135', 'o', { serie: 2, figura: 'triángulo de lado, como punta de flecha' }),
  letra('p', '1234', 'pe', { serie: 2 }),
  letra('q', '12345', 'cu', { serie: 2 }),
  letra('r', '1235', 'erre', { serie: 2 }),
  letra('s', '234', 'ese', { serie: 2 }),
  letra('t', '2345', 'te', { serie: 2 }),

  // Serie 3: u, v, x, y, z = a–e + puntos 3 y 6 (la w no entra en la serie).
  letra('u', '136', 'u', { serie: 3 }),
  letra('v', '1236', 'uve', { serie: 3 }),
  letra('x', '1346', 'equis', { serie: 3, figura: 'las cuatro esquinas' }),
  letra('y', '13456', 'ye', { serie: 3 }),
  letra('z', '1356', 'zeta', { serie: 3 }),

  // Letras con código propio.
  especial('ñ', '12456', 'eñe'),
  especial('w', '2456', 'uve doble'),
  especial('á', '12356', 'a con tilde'),
  especial('é', '2346', 'e con tilde'),
  especial('í', '34', 'i con tilde'),
  especial('ó', '346', 'o con tilde'),
  especial('ú', '23456', 'u con tilde'),
  especial('ü', '1256', 'u con diéresis'),

  // Prefijos: modifican el signo siguiente.
  signo('mayuscula', '46', 'signo de mayúscula', 'prefijo', []),
  signo('numero', '3456', 'signo de número', 'prefijo', []),

  // Puntuación básica (RF-04).
  signo('punto', '3', 'punto', 'puntuacion', ['.']),
  signo('coma', '2', 'coma', 'puntuacion', [',']),
  signo('punto-y-coma', '23', 'punto y coma', 'puntuacion', [';']),
  signo('dos-puntos', '25', 'dos puntos', 'puntuacion', [':']),
  signo('interrogacion', '26', 'signo de interrogación', 'puntuacion', ['¿', '?'], {
    par: { apertura: '¿', cierre: '?' },
  }),
  signo('exclamacion', '235', 'signo de exclamación', 'puntuacion', ['¡', '!'], {
    par: { apertura: '¡', cierre: '!' },
  }),
  signo('comillas', '236', 'comillas', 'puntuacion', ['"', '«', '»', '“', '”']),
  signo('abre-parentesis', '126', 'abre paréntesis', 'puntuacion', ['(']),
  signo('cierra-parentesis', '345', 'cierra paréntesis', 'puntuacion', [')']),
  signo('guion', '36', 'guion', 'puntuacion', ['-']),
];

const porId = new Map(TABLA.map((s) => [s.id, s]));
const porMascara = new Map(TABLA.map((s) => [s.mascara, s]));
const porCaracter = new Map(TABLA.flatMap((s) => s.caracteres.map((c) => [c, s] as const)));

export const MAYUSCULA = porId.get('mayuscula')!.mascara;
export const NUMERO = porId.get('numero')!.mascara;

/** Los dígitos se escriben con el signo de número + las letras a–j (1 = a … 9 = i, 0 = j). */
export const DIGITO_A_LETRA: Readonly<Record<string, string>> = {
  '1': 'a',
  '2': 'b',
  '3': 'c',
  '4': 'd',
  '5': 'e',
  '6': 'f',
  '7': 'g',
  '8': 'h',
  '9': 'i',
  '0': 'j',
};
export const LETRA_A_DIGITO: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DIGITO_A_LETRA).map(([d, l]) => [l, d]),
);

export function signoPorId(id: string): Signo | undefined {
  return porId.get(id);
}

export function signoPorMascara(mascara: Mascara): Signo | undefined {
  return porMascara.get(mascara);
}

export function signoPorCaracter(caracter: string): Signo | undefined {
  return porCaracter.get(caracter);
}

export function signosDeSerie(serie: Serie): Signo[] {
  return TABLA.filter((s) => s.serie === serie);
}

export function esLetra(s: Signo): boolean {
  return s.categoria === 'letra' || s.categoria === 'letra-especial';
}

/** "la de", "la eñe", "el signo de mayúscula". */
export function nombreConArticulo(s: Signo): string {
  return `${esLetra(s) ? 'la' : 'el'} ${s.nombre}`;
}
