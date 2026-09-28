/**
 * ORÁCULO DE LA TABLA DE SIGNOS.
 *
 * Reglas:
 * 1. Nunca importes nada de `src/`: este archivo es la referencia independiente.
 * 2. Cada entrada indica su fuente. Hoy solo hay lo que los tiflólogos dictaron en la
 *    Entrevista #1 (marca de tiempo de la transcripción).
 * 3. El resto se transcribe de la signografía oficial usada en Colombia, idealmente por el
 *    integrante que NO escribió `src/tabla.ts`, y se valida con los tiflólogos (sesión táctil).
 * 4. Los puntos van como cadena ("145"), no como máscara, para no compartir la lógica de
 *    conversión con la tabla.
 */
export interface EntradaReferencia {
  id: string;
  puntos: string;
  fuente: string;
}

export const referencia: readonly EntradaReferencia[] = [
  { id: 'a', puntos: '1', fuente: 'Entrevista #1 [17:35], [33:30]' },
  { id: 'b', puntos: '12', fuente: 'Entrevista #1 [17:35], [33:30]' },
  { id: 'c', puntos: '14', fuente: 'Entrevista #1 [17:35], [33:30]' },
  { id: 'd', puntos: '145', fuente: 'Entrevista #1 [17:35], [33:30]' },
  { id: 'e', puntos: '15', fuente: 'Entrevista #1 [17:35], [33:30]' },
  { id: 'f', puntos: '124', fuente: 'Entrevista #1 [17:35], [33:30]' },
  { id: 'g', puntos: '1245', fuente: 'Entrevista #1 [17:35]' },
  { id: 'h', puntos: '125', fuente: 'Entrevista #1 [17:35], [33:30]' },
  { id: 'i', puntos: '24', fuente: 'Entrevista #1 [17:35]' },
  { id: 'j', puntos: '245', fuente: 'Entrevista #1 [17:35], [33:30]' },
  { id: 'k', puntos: '13', fuente: 'Entrevista #1 [33:30]' },
  { id: 'l', puntos: '123', fuente: 'Entrevista #1 [33:30]' },
  { id: 'm', puntos: '134', fuente: 'Entrevista #1 [33:30]' },
  { id: 'n', puntos: '1345', fuente: 'Entrevista #1 [33:30]' },
  { id: 'v', puntos: '1236', fuente: 'Entrevista #1 [61:38]' },
  { id: 'x', puntos: '1346', fuente: 'Entrevista #1 [60:44]–[61:38]' },
  { id: 'mayuscula', puntos: '46', fuente: 'Entrevista #1 [29:04]' },
];
