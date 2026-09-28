import {
  SeparadorLineas,
  TECLAS_CONTROL,
  VERSION_PROTOCOLO,
  codificar,
  decodificarApp,
  type MensajeApp,
  type MensajeDispositivo,
  type TeclaControl,
} from '@braille/protocol';
import type { PuertoSerie } from '../web-serial';

export interface OpcionesFirmwareFalso {
  protocolo?: number;
  version?: string;
  teclas?: readonly TeclaControl[];
  /** Tiempo que "tardan los servos" antes del `ack`. */
  retardoAckMs?: number;
  /** false simula un servo atascado: nunca responde `ack`. */
  responderAck?: boolean;
  responderPing?: boolean;
  /** false simula un dispositivo mudo: no responde `hello`. */
  responderHello?: boolean;
  /**
   * Imita el ESP32 al abrir el puerto: se reinicia, ignora lo que llegue mientras arranca y
   * luego envía el registro del ROM en texto plano + `boot`.
   */
  reiniciarAlAbrir?: boolean;
  retardoArranqueMs?: number;
  /** Entrega cada mensaje en dos fragmentos, como hace un puerto serie real. */
  fragmentar?: boolean;
}

const REGISTRO_ROM = [
  'ets Jun  8 2016 00:22:57',
  'rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)',
  'configsip: 0, SPIWP:0xee',
];

/**
 * Implementación de referencia EJECUTABLE del comportamiento que docs/PROTOCOLO.md exige al
 * firmware. Sirve para probar el adaptador Web Serial sin hardware, y como guía al programar
 * el ESP32: si el firmware real se comporta distinto a esta clase, uno de los dos incumple el
 * contrato.
 */
export class FirmwareFalso {
  /** Mensajes que la app envió, en orden. */
  readonly recibidos: MensajeApp[] = [];
  /** Llamadas a setSignals (para verificar el manejo de DTR/RTS). */
  readonly senales: { dataTerminalReady?: boolean; requestToSend?: boolean }[] = [];
  /** Máscara que "muestra" la celda. */
  celda = 0;
  /** Cuántas veces llegó un comando mientras otro estaba en curso (debe ser 0). */
  solapamientos = 0;

  private controlador: ReadableStreamDefaultController<Uint8Array> | null = null;
  private legible: ReadableStream<Uint8Array> | null = null;
  private escribible: WritableStream<Uint8Array> | null = null;
  private ocupado = false;
  private arrancando = false;
  private readonly separador = new SeparadorLineas();
  private readonly decodificador = new TextDecoder();
  private readonly codificador = new TextEncoder();
  private readonly o: Required<OpcionesFirmwareFalso>;

  constructor(opciones: OpcionesFirmwareFalso = {}) {
    this.o = {
      protocolo: opciones.protocolo ?? VERSION_PROTOCOLO,
      version: opciones.version ?? '0.0.0-falso',
      teclas: opciones.teclas ?? TECLAS_CONTROL,
      retardoAckMs: opciones.retardoAckMs ?? 5,
      responderAck: opciones.responderAck ?? true,
      responderPing: opciones.responderPing ?? true,
      responderHello: opciones.responderHello ?? true,
      reiniciarAlAbrir: opciones.reiniciarAlAbrir ?? true,
      retardoArranqueMs: opciones.retardoArranqueMs ?? 10,
      fragmentar: opciones.fragmentar ?? true,
    };
  }

  /** Puerto serie falso conectado a este firmware. */
  crearPuerto(): PuertoSerie {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const firmware = this;
    return {
      async open() {
        firmware.legible = new ReadableStream<Uint8Array>({
          start: (c) => {
            firmware.controlador = c;
          },
        });
        firmware.escribible = new WritableStream<Uint8Array>({
          write: (fragmento) => firmware.recibirBytes(fragmento),
        });
        if (firmware.o.reiniciarAlAbrir) {
          firmware.arrancando = true;
          setTimeout(() => firmware.reiniciar(), firmware.o.retardoArranqueMs);
        }
      },
      async close() {
        try {
          firmware.controlador?.close();
        } catch {
          // ya estaba cerrado o con error
        }
        firmware.controlador = null;
      },
      get readable() {
        return firmware.legible;
      },
      get writable() {
        return firmware.escribible;
      },
      async setSignals(senales) {
        firmware.senales.push(senales);
      },
    };
  }

  /** Envía un mensaje a la app (p. ej. un acorde que "escribió" la persona). */
  emitir(mensaje: MensajeDispositivo): void {
    this.emitirTexto(codificar(mensaje));
  }

  /** Envía texto crudo (ruido, líneas inválidas). */
  emitirTexto(texto: string): void {
    if (!this.controlador) return;
    const bytes = this.codificador.encode(texto);
    const corte = this.o.fragmentar ? Math.floor(bytes.length / 2) : bytes.length;
    this.controlador.enqueue(bytes.slice(0, corte));
    if (corte < bytes.length) this.controlador.enqueue(bytes.slice(corte));
  }

  /** Simula un reinicio: registro del ROM + `boot`. */
  reiniciar(): void {
    this.ocupado = false;
    this.arrancando = false;
    this.emitirTexto(`${REGISTRO_ROM.join('\r\n')}\r\n`);
    this.emitir({ t: 'boot', fw: this.o.version });
  }

  /** Simula retirar el cable USB. */
  desconectarCable(): void {
    this.controlador?.error(new Error('Dispositivo USB retirado'));
    this.controlador = null;
  }

  private recibirBytes(fragmento: Uint8Array): void {
    const texto = this.decodificador.decode(fragmento, { stream: true });
    for (const linea of this.separador.agregar(texto)) {
      const resultado = decodificarApp(linea);
      if (!resultado.ok) {
        this.emitir({ t: 'err', code: 'BAD_MESSAGE' });
        continue;
      }
      this.atender(resultado.mensaje);
    }
  }

  private atender(mensaje: MensajeApp): void {
    this.recibidos.push(mensaje);
    if (this.arrancando) return; // como el ESP32 real: lo que llega durante el arranque se pierde
    switch (mensaje.t) {
      case 'hello':
        if (this.o.responderHello) {
          this.emitir({
            t: 'info',
            id: mensaje.id,
            proto: this.o.protocolo,
            fw: this.o.version,
            keys: [...this.o.teclas],
          });
        }
        return;
      case 'ping':
        if (this.o.responderPing) this.emitir({ t: 'pong', id: mensaje.id });
        return;
      case 'cell':
      case 'clear': {
        if (this.ocupado) {
          this.solapamientos += 1;
          this.emitir({ t: 'err', id: mensaje.id, code: 'BUSY' });
          return;
        }
        if (!this.o.responderAck) return;
        this.ocupado = true;
        const destino = mensaje.t === 'cell' ? mensaje.m : 0;
        setTimeout(() => {
          this.celda = destino;
          this.ocupado = false;
          this.emitir({ t: 'ack', id: mensaje.id, ms: this.o.retardoAckMs });
        }, this.o.retardoAckMs);
        return;
      }
    }
  }
}
