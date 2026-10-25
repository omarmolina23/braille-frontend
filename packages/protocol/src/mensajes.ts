import { z } from 'zod';

/**
 * Máscara de 6 bits: el bit (i − 1) representa el punto i.
 * Ejemplo: la c (puntos 1 y 4) es 0b001001 = 9.
 */
export const esquemaMascara = z.number().int().min(0).max(63);

/** Identificador asignado por la app para correlacionar comando y respuesta. */
export const esquemaId = z.number().int().min(0).max(65_535);

export const TECLAS_CONTROL = ['space', 'back', 'repeat', 'ok'] as const;
export const esquemaTecla = z.enum(TECLAS_CONTROL);
export type TeclaControl = z.infer<typeof esquemaTecla>;

export const CODIGOS_ERROR = ['SERVO_TIMEOUT', 'BUSY', 'BAD_MESSAGE', 'UNKNOWN_TYPE'] as const;

// ───────────────────────── App → dispositivo ─────────────────────────

export const esquemaHello = z.object({ t: z.literal('hello'), id: esquemaId });
export const esquemaCell = z.object({ t: z.literal('cell'), id: esquemaId, m: esquemaMascara });
export const esquemaClear = z.object({ t: z.literal('clear'), id: esquemaId });
export const esquemaPing = z.object({ t: z.literal('ping'), id: esquemaId });

export const esquemaMensajeApp = z.discriminatedUnion('t', [
  esquemaHello,
  esquemaCell,
  esquemaClear,
  esquemaPing,
]);
export type MensajeApp = z.infer<typeof esquemaMensajeApp>;

// ───────────────────────── Dispositivo → app ─────────────────────────

export const esquemaBoot = z.object({ t: z.literal('boot'), fw: z.string().min(1) });

export const esquemaInfo = z.object({
  t: z.literal('info'),
  id: esquemaId,
  proto: z.number().int().positive(),
  fw: z.string().min(1),
  keys: z.array(esquemaTecla),
});

export const esquemaAck = z.object({
  t: z.literal('ack'),
  id: esquemaId,
  /** Duración real de la actuación en ms (opcional, útil para medir RNF-03). */
  ms: z.number().int().nonnegative().optional(),
});

/** Acorde completo: se emite cuando se sueltan todas las teclas. Nunca vacío. */
export const esquemaChord = z.object({ t: z.literal('chord'), m: esquemaMascara.min(1) });

/**
 * Acorde en curso: se emite cada vez que cambian las teclas de puntos presionadas, salvo al
 * soltar la última (entonces se emite `chord`). Sirve para dibujarlo mientras se escribe.
 */
export const esquemaPress = z.object({
  t: z.literal('press'),
  /** Puntos cuyas teclas siguen presionadas. */
  p: esquemaMascara.min(1),
  /** Acorde que se enviaría en `chord` si se soltaran todas ahora. */
  m: esquemaMascara.min(1),
});

export const esquemaKey = z.object({ t: z.literal('key'), k: esquemaTecla });

export const esquemaPong = z.object({ t: z.literal('pong'), id: esquemaId });

export const esquemaErr = z.object({
  t: z.literal('err'),
  /** Id del comando que falló; ausente si el error no corresponde a un comando. */
  id: esquemaId.optional(),
  code: z.string().min(1),
});

export const esquemaMensajeDispositivo = z.discriminatedUnion('t', [
  esquemaBoot,
  esquemaInfo,
  esquemaAck,
  esquemaChord,
  esquemaPress,
  esquemaKey,
  esquemaPong,
  esquemaErr,
]);
export type MensajeDispositivo = z.infer<typeof esquemaMensajeDispositivo>;
