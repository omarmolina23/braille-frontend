import { TECLAS_CONTROL } from '@braille/protocol';
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
 */
export class SimuladorDispositivo implements DispositivoBraille {
  private estadoActual: EstadoConexion = 'desconectado';
  private celda: Mascara = 0;
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
    this.cambiarEstado('listo');
    return { protocolo: 1, firmware: 'simulador', teclas: TECLAS_CONTROL };
  }

  async desconectar(): Promise<void> {
    this.cambiarEstado('desconectado');
  }

  async mostrarCelda(mascara: Mascara): Promise<void> {
    this.exigirConexion();
    this.cambiarEstado('moviendo');
    const retardo = this.opciones.retardoCeldaMs ?? 0;
    if (retardo > 0) await new Promise((r) => setTimeout(r, retardo));
    this.celda = mascara;
    this.celdas.emitir(mascara);
    this.cambiarEstado('listo');
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

  private exigirConexion(): void {
    if (this.estadoActual === 'desconectado') throw new Error('El simulador no está conectado.');
  }

  private cambiarEstado(estado: EstadoConexion): void {
    this.estadoActual = estado;
    this.estados.emitir(estado);
  }
}
