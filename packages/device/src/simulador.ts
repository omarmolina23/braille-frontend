import { TECLAS_CONTROL } from '@braille/protocol';
import { ErrorConexionCerrada, ErrorProtocolo } from './errores';
import { exigirMascaraValida } from './mascara';
import {
  Emisor,
  type AcordeEnCurso,
  type Cancelar,
  type DispositivoBraille,
  type EstadoConexion,
  type InfoDispositivo,
  type Mascara,
  type TeclaControl,
} from './puerto';

export interface OpcionesSimulador {
  /** Retardo artificial de `mostrarCelda`, para imitar los servos (por defecto 0). */
  retardoCeldaMs?: number;
}

/**
 * Dispositivo simulado. La interfaz lo usa para dibujar la celda virtual y recibir la escritura
 * con el teclado de seis teclas; las pruebas lo usan para no depender del hardware.
 *
 * Solo sirve para desarrollo y pruebas (ADR-0012). Se comporta como `DispositivoWebSerial`: mismos
 * estados, mismos errores y órdenes en cola. `test/contrato-dispositivo.test.ts` lo comprueba
 * contra el firmware falso.
 */
export class SimuladorDispositivo implements DispositivoBraille {
  private estadoActual: EstadoConexion = 'desconectado';
  private celda: Mascara = 0;
  private cola: Promise<unknown> = Promise.resolve();
  /** Cancela el movimiento en curso, si lo hay (lo usa `desconectar`). */
  private cancelarMovimiento: (() => void) | null = null;
  private readonly acordes = new Emisor<Mascara>();
  private readonly teclas = new Emisor<TeclaControl>();
  private readonly estados = new Emisor<EstadoConexion>();
  private readonly celdas = new Emisor<Mascara>();

  constructor(private readonly opciones: OpcionesSimulador = {}) {}

  get estado(): EstadoConexion {
    return this.estadoActual;
  }

  /** Celda que se muestra ahora (para dibujarla en pantalla). */
  get celdaActual(): Mascara {
    return this.celda;
  }

  async conectar(): Promise<InfoDispositivo> {
    if (this.estadoActual !== 'desconectado') throw new ErrorProtocolo('Ya hay una conexión.');
    this.cambiarEstado('conectando');
    this.cambiarEstado('listo');
    return { protocolo: 1, firmware: 'simulador', teclas: TECLAS_CONTROL };
  }

  async desconectar(): Promise<void> {
    this.cancelarMovimiento?.();
    this.cambiarEstado('desconectado');
  }

  mostrarCelda(mascara: Mascara): Promise<void> {
    try {
      exigirMascaraValida(mascara);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.enCola(() => this.mover(mascara));
  }

  limpiar(): Promise<void> {
    return this.mostrarCelda(0);
  }

  onAcorde(cb: (mascara: Mascara) => void): Cancelar {
    return this.acordes.suscribir(cb);
  }

  /**
   * El simulador no tiene teclas propias: la escritura de pantalla dibuja su acorde en curso
   * directamente (el lector de seis teclas se lo entrega a la interfaz).
   */
  onAcordeEnCurso(_cb: (estado: AcordeEnCurso) => void): Cancelar {
    return () => undefined;
  }

  onTecla(cb: (tecla: TeclaControl) => void): Cancelar {
    return this.teclas.suscribir(cb);
  }

  onEstado(cb: (estado: EstadoConexion) => void): Cancelar {
    return this.estados.suscribir(cb);
  }

  /** Suscripción exclusiva del simulador: cambios de la celda mostrada. */
  onCelda(cb: (mascara: Mascara) => void): Cancelar {
    return this.celdas.suscribir(cb);
  }

  /** Lo llama la interfaz (celda virtual o teclado de seis teclas). */
  pulsarAcorde(mascara: Mascara): void {
    if (mascara > 0 && this.estadoActual !== 'desconectado') this.acordes.emitir(mascara);
  }

  pulsarTecla(tecla: TeclaControl): void {
    if (this.estadoActual !== 'desconectado') this.teclas.emitir(tecla);
  }

  /** Un movimiento a la vez, en el orden en que llegan las órdenes. */
  private enCola<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = this.cola.then(tarea, tarea);
    this.cola = resultado.catch(() => undefined);
    return resultado;
  }

  private async mover(mascara: Mascara): Promise<void> {
    if (this.estadoActual !== 'listo') throw new ErrorProtocolo('El dispositivo no está listo.');
    this.cambiarEstado('moviendo');
    try {
      await this.esperarServos();
      this.celda = mascara;
      this.celdas.emitir(mascara);
    } finally {
      // Si se desconectó mientras se movía, el estado ya es 'desconectado' y no se toca. Se lee con
      // el getter: TypeScript no sabe que el estado cambió durante la espera.
      if (this.estado === 'moviendo') this.cambiarEstado('listo');
    }
  }

  private esperarServos(): Promise<void> {
    const retardo = this.opciones.retardoCeldaMs ?? 0;
    if (retardo <= 0) return Promise.resolve();
    return new Promise((resolver, rechazar) => {
      const temporizador = setTimeout(() => {
        this.cancelarMovimiento = null;
        resolver();
      }, retardo);
      this.cancelarMovimiento = () => {
        clearTimeout(temporizador);
        this.cancelarMovimiento = null;
        rechazar(new ErrorConexionCerrada('Conexión cerrada.'));
      };
    });
  }

  private cambiarEstado(estado: EstadoConexion): void {
    this.estadoActual = estado;
    this.estados.emitir(estado);
  }
}
