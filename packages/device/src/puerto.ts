import type { TeclaControl } from '@braille/protocol';

export type { TeclaControl };

/** Máscara de 6 bits: el bit (i − 1) es el punto i (docs/PROTOCOLO.md § 2). */
export type Mascara = number;

export type EstadoConexion = 'desconectado' | 'conectando' | 'listo' | 'moviendo' | 'error';

export interface InfoDispositivo {
  /** Versión del protocolo que habla el firmware. */
  protocolo: number;
  /** Versión del firmware (o 'simulador'). */
  firmware: string;
  /** Teclas de control que existen físicamente. */
  teclas: readonly TeclaControl[];
}

/** Acorde que se está escribiendo, para dibujarlo antes de que se suelten todas las teclas. */
export interface AcordeEnCurso {
  /** Puntos cuyas teclas siguen presionadas ahora mismo. */
  presionados: Mascara;
  /** Puntos del acorde que se emitiría si se soltaran todas las teclas ahora. */
  acorde: Mascara;
}

/** Ninguna tecla de puntos presionada. */
export const SIN_ACORDE: AcordeEnCurso = { presionados: 0, acorde: 0 };

/** Función que cancela una suscripción. */
export type Cancelar = () => void;

/**
 * Puerto del dispositivo Braille (arquitectura de puertos y adaptadores).
 *
 * El motor de aprendizaje solo conoce esta interfaz. La implementan:
 * - `SimuladorDispositivo`: celda virtual + teclado de seis teclas, para desarrollo, pruebas y
 *   personas sin dispositivo.
 * - `DispositivoWebSerial`: el ESP32 real por USB.
 * - (futuro) un adaptador Bluetooth LE.
 */
export interface DispositivoBraille {
  /** Abre la conexión y hace el saludo; resuelve con la información del dispositivo. */
  conectar(): Promise<InfoDispositivo>;
  desconectar(): Promise<void>;
  /** Muestra una celda; resuelve cuando la celda está quieta y se puede tocar. */
  mostrarCelda(mascara: Mascara): Promise<void>;
  /** Baja todos los puntos. */
  limpiar(): Promise<void>;
  /** Acorde completo escrito por la persona (se emite al soltar todas las teclas). */
  onAcorde(cb: (mascara: Mascara) => void): Cancelar;
  /**
   * Teclas de puntos del dispositivo mientras se escribe un acorde. Al terminar (con el acorde
   * completo o al perder la conexión) se emite `SIN_ACORDE`.
   */
  onAcordeEnCurso(cb: (estado: AcordeEnCurso) => void): Cancelar;
  onTecla(cb: (tecla: TeclaControl) => void): Cancelar;
  onEstado(cb: (estado: EstadoConexion) => void): Cancelar;
  readonly estado: EstadoConexion;
}

/** Pequeño emisor de eventos tipado, compartido por los adaptadores. */
export class Emisor<T> {
  private readonly oyentes = new Set<(valor: T) => void>();

  suscribir(cb: (valor: T) => void): Cancelar {
    this.oyentes.add(cb);
    return () => this.oyentes.delete(cb);
  }

  emitir(valor: T): void {
    for (const cb of this.oyentes) cb(valor);
  }
}
