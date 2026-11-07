import {
  BAUDIOS,
  INTERVALO_PING_MS,
  INTERVALO_SALUDO_MS,
  PONGS_PERDIDOS_MAXIMOS,
  SeparadorLineas,
  TIEMPO_MAXIMO_SALUDO_MS,
  TIMEOUT_ACK_MS,
  VERSION_PROTOCOLO,
  codificar,
  decodificarDispositivo,
  type CODIGOS_ERROR,
  type MensajeApp,
  type MensajeDispositivo,
} from '@braille/protocol';
import {
  Emisor,
  SIN_ACORDE,
  type AcordeEnCurso,
  type Cancelar,
  type DispositivoBraille,
  type EstadoConexion,
  type InfoDispositivo,
  type Mascara,
  type TeclaControl,
} from './puerto';

/**
 * Subconjunto de `SerialPort` (Web Serial API) que usa el adaptador.
 * El `SerialPort` real del navegador cumple esta interfaz; las pruebas inyectan uno falso.
 */
export interface PuertoSerie {
  open(opciones: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  setSignals?(senales: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}

export interface OpcionesWebSerial {
  timeoutAckMs?: number;
  tiempoMaximoSaludoMs?: number;
  intervaloSaludoMs?: number;
  /** 0 desactiva el latido (útil en pruebas). */
  intervaloPingMs?: number;
  /** Líneas descartadas (registro de arranque del ESP32, mensajes inválidos). */
  onLineaIgnorada?: (linea: string, motivo: string) => void;
}

export class ErrorProtocolo extends Error {
  override name = 'ErrorProtocolo';
}
export class ErrorTiempoAgotado extends ErrorProtocolo {
  override name = 'ErrorTiempoAgotado';
}
export class ErrorIncompatible extends ErrorProtocolo {
  override name = 'ErrorIncompatible';
}
class ErrorReinicio extends ErrorProtocolo {}

/**
 * La Web Serial API rechaza con una DOMException cuyo mensaje está en inglés ("Failed to open
 * serial port."). Lo que se anuncia sale de aquí, según la acción y el `name` de la excepción.
 */
const MENSAJES_NAVEGADOR = {
  elegir: {
    NotFoundError: 'Se cerró la lista sin elegir un puerto.',
    SecurityError: 'El navegador no dio permiso para usar los puertos USB.',
    otro: 'El navegador no pudo mostrar la lista de puertos.',
  },
  abrir: {
    InvalidStateError: 'El puerto ya estaba abierto.',
    NetworkError:
      'El puerto está ocupado o no responde. Cierra el monitor serie o la otra pestaña que lo use y vuelve a intentarlo.',
    otro: 'El navegador no pudo abrir el puerto.',
  },
  escribir: { otro: 'Se perdió la conexión con el dispositivo.' },
};

function traducirErrorNavegador(
  error: unknown,
  accion: keyof typeof MENSAJES_NAVEGADOR,
): ErrorProtocolo {
  if (error instanceof ErrorProtocolo) return error;
  const mensajes: Partial<Record<string, string>> = MENSAJES_NAVEGADOR[accion];
  // Sin `instanceof Error`: una DOMException de otro contexto (iframe, jsdom) no lo cumple.
  const nombre =
    typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  return new ErrorProtocolo(mensajes[nombre] ?? MENSAJES_NAVEGADOR[accion].otro, { cause: error });
}

/** Lo que se anuncia ante cada código de `err` del firmware (PROTOCOLO § 3). */
const MENSAJES_CODIGO: Record<(typeof CODIGOS_ERROR)[number], string> = {
  SERVO_TIMEOUT: 'Los servos no llegaron a su posición a tiempo.',
  BUSY: 'El dispositivo todavía estaba moviendo la celda.',
  BAD_MESSAGE: 'El dispositivo no entendió la orden.',
  UNKNOWN_TYPE: 'El dispositivo no reconoce esa orden.',
};

function mensajeDeCodigo(codigo: string): string {
  return (
    (MENSAJES_CODIGO as Partial<Record<string, string>>)[codigo] ??
    'El dispositivo informó un error que la app no conoce.'
  );
}

type TipoRespuesta = 'info' | 'ack' | 'pong';

const SIN_RESPUESTA: Record<TipoRespuesta, string> = {
  info: 'El dispositivo no respondió al saludo.',
  ack: 'El dispositivo no confirmó a tiempo que terminó de mover la celda.',
  pong: 'El dispositivo dejó de responder.',
};
type RespuestaDe<T extends TipoRespuesta> = Extract<MensajeDispositivo, { t: T }>;

interface Pendiente {
  tipo: TipoRespuesta;
  resolver: (m: MensajeDispositivo) => void;
  rechazar: (e: Error) => void;
  temporizador: ReturnType<typeof setTimeout>;
}

type SinId<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Adaptador del ESP32 real por USB, según docs/PROTOCOLO.md. */
export class DispositivoWebSerial implements DispositivoBraille {
  private estadoActual: EstadoConexion = 'desconectado';
  private escritor: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private lector: ReadableStreamDefaultReader<string> | null = null;
  private tuberia: Promise<void> | null = null;
  private bucle: Promise<void> | null = null;
  private siguienteId = 1;
  private readonly pendientes = new Map<number, Pendiente>();
  private cola: Promise<unknown> = Promise.resolve();
  private latido: ReturnType<typeof setInterval> | null = null;
  private pongsPerdidos = 0;
  private cerrando = false;
  private readonly codificador = new TextEncoder();
  private readonly acordes = new Emisor<Mascara>();
  private enCurso: AcordeEnCurso = SIN_ACORDE;
  private readonly acordesEnCurso = new Emisor<AcordeEnCurso>();
  private readonly teclas = new Emisor<TeclaControl>();
  private readonly estados = new Emisor<EstadoConexion>();
  private readonly o: Required<Omit<OpcionesWebSerial, 'onLineaIgnorada'>> &
    Pick<OpcionesWebSerial, 'onLineaIgnorada'>;

  constructor(
    private readonly puerto: PuertoSerie,
    opciones: OpcionesWebSerial = {},
  ) {
    this.o = {
      timeoutAckMs: opciones.timeoutAckMs ?? TIMEOUT_ACK_MS,
      tiempoMaximoSaludoMs: opciones.tiempoMaximoSaludoMs ?? TIEMPO_MAXIMO_SALUDO_MS,
      intervaloSaludoMs: opciones.intervaloSaludoMs ?? INTERVALO_SALUDO_MS,
      intervaloPingMs: opciones.intervaloPingMs ?? INTERVALO_PING_MS,
      onLineaIgnorada: opciones.onLineaIgnorada,
    };
  }

  get estado(): EstadoConexion {
    return this.estadoActual;
  }

  async conectar(): Promise<InfoDispositivo> {
    if (this.estadoActual !== 'desconectado' && this.estadoActual !== 'error') {
      throw new ErrorProtocolo('Ya hay una conexión.');
    }
    this.cambiarEstado('conectando');
    try {
      await this.puerto.open({ baudRate: BAUDIOS }).catch((error: unknown) => {
        throw traducirErrorNavegador(error, 'abrir');
      });
      // Evita (si la placa lo permite) que abrir el puerto reinicie el ESP32.
      await this.puerto
        .setSignals?.({ dataTerminalReady: false, requestToSend: false })
        .catch(() => {});
      if (!this.puerto.readable || !this.puerto.writable) {
        throw new ErrorProtocolo('El puerto no tiene flujos de lectura y escritura.');
      }
      this.escritor = this.puerto.writable.getWriter();
      this.bucle = this.leer(this.puerto.readable);

      const info = await this.saludar();
      if (info.proto !== VERSION_PROTOCOLO) {
        throw new ErrorIncompatible(
          `El firmware habla el protocolo ${info.proto} y la app el ${VERSION_PROTOCOLO}.`,
        );
      }
      this.cambiarEstado('listo');
      this.iniciarLatido();
      return { protocolo: info.proto, firmware: info.fw, teclas: info.keys };
    } catch (error) {
      await this.cerrarRecursos();
      this.cambiarEstado('error'); // desde 'error' se puede volver a llamar conectar()
      throw error;
    }
  }

  async desconectar(): Promise<void> {
    await this.cerrarRecursos();
    this.cambiarEstado('desconectado');
  }

  mostrarCelda(mascara: Mascara): Promise<void> {
    return this.enCola(() => this.actuar({ t: 'cell', m: mascara }));
  }

  limpiar(): Promise<void> {
    return this.enCola(() => this.actuar({ t: 'clear' }));
  }

  onAcorde(cb: (mascara: Mascara) => void): Cancelar {
    return this.acordes.suscribir(cb);
  }

  onAcordeEnCurso(cb: (estado: AcordeEnCurso) => void): Cancelar {
    return this.acordesEnCurso.suscribir(cb);
  }

  onTecla(cb: (tecla: TeclaControl) => void): Cancelar {
    return this.teclas.suscribir(cb);
  }

  onEstado(cb: (estado: EstadoConexion) => void): Cancelar {
    return this.estados.suscribir(cb);
  }

  // ───────────────────────── internos ─────────────────────────

  /** Envía `hello` hasta recibir `info`, dentro de la ventana de saludo (PROTOCOLO § 4). */
  private async saludar(): Promise<RespuestaDe<'info'>> {
    const limite = Date.now() + this.o.tiempoMaximoSaludoMs;
    for (;;) {
      const restante = limite - Date.now();
      if (restante <= 0) throw new ErrorTiempoAgotado('El dispositivo no respondió al saludo.');
      try {
        return await this.pedir(
          { t: 'hello' },
          'info',
          Math.min(this.o.intervaloSaludoMs, restante),
        );
      } catch (error) {
        if (!(error instanceof ErrorTiempoAgotado) && !(error instanceof ErrorReinicio))
          throw error;
      }
    }
  }

  /** `cell`/`clear` con un reintento si no llega el `ack` a tiempo (PROTOCOLO § 5). */
  private async actuar(mensaje: SinId<Extract<MensajeApp, { t: 'cell' | 'clear' }>>) {
    if (this.estadoActual !== 'listo') throw new ErrorProtocolo('El dispositivo no está listo.');
    this.cambiarEstado('moviendo');
    try {
      try {
        await this.pedir(mensaje, 'ack', this.o.timeoutAckMs);
      } catch (error) {
        if (!(error instanceof ErrorTiempoAgotado)) throw error;
        await this.pedir(mensaje, 'ack', this.o.timeoutAckMs);
      }
    } finally {
      // Se lee con el getter: el estado pudo cambiar (p. ej. desconexión) mientras se esperaba.
      if (this.estado === 'moviendo') this.cambiarEstado('listo');
    }
  }

  /** Un comando a la vez: los siguientes esperan su turno. */
  private enCola<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = this.cola.then(tarea, tarea);
    this.cola = resultado.catch(() => undefined);
    return resultado;
  }

  private pedir<T extends TipoRespuesta>(
    mensaje: SinId<MensajeApp>,
    tipo: T,
    timeoutMs: number,
  ): Promise<RespuestaDe<T>> {
    const id = this.siguienteId;
    this.siguienteId = (this.siguienteId % 65_535) + 1;
    return new Promise<RespuestaDe<T>>((resolver, rechazar) => {
      const temporizador = setTimeout(() => {
        this.pendientes.delete(id);
        rechazar(new ErrorTiempoAgotado(SIN_RESPUESTA[tipo]));
      }, timeoutMs);
      this.pendientes.set(id, {
        tipo,
        resolver: (m) => resolver(m as RespuestaDe<T>),
        rechazar,
        temporizador,
      });
      this.escribir({ ...mensaje, id } as MensajeApp).catch((error: unknown) => {
        clearTimeout(temporizador);
        this.pendientes.delete(id);
        rechazar(error instanceof Error ? error : new ErrorProtocolo(String(error)));
      });
    });
  }

  private async escribir(mensaje: MensajeApp): Promise<void> {
    if (!this.escritor) throw new ErrorProtocolo('El puerto no está abierto.');
    await this.escritor
      .write(this.codificador.encode(codificar(mensaje)))
      .catch((error: unknown) => {
        throw traducirErrorNavegador(error, 'escribir');
      });
  }

  private async leer(flujo: ReadableStream<Uint8Array>): Promise<void> {
    const decodificador = new TextDecoderStream();
    this.tuberia = flujo
      .pipeTo(decodificador.writable as unknown as WritableStream<Uint8Array>)
      .catch(() => undefined);
    this.lector = decodificador.readable.getReader();
    const separador = new SeparadorLineas();
    try {
      for (;;) {
        const { value, done } = await this.lector.read();
        if (done) break;
        for (const linea of separador.agregar(value)) this.procesar(linea);
      }
    } catch {
      // El flujo falla cuando se retira el cable: se trata abajo como desconexión.
    }
    if (!this.cerrando) void this.perderConexion();
  }

  private procesar(linea: string): void {
    const resultado = decodificarDispositivo(linea);
    if (!resultado.ok) {
      this.o.onLineaIgnorada?.(linea, resultado.motivo);
      return;
    }
    const mensaje = resultado.mensaje;
    switch (mensaje.t) {
      case 'boot':
        this.alReiniciarse();
        return;
      case 'info':
      case 'ack':
      case 'pong': {
        const pendiente = this.pendientes.get(mensaje.id);
        if (pendiente?.tipo !== mensaje.t) return;
        clearTimeout(pendiente.temporizador);
        this.pendientes.delete(mensaje.id);
        pendiente.resolver(mensaje);
        return;
      }
      case 'err': {
        const pendiente = mensaje.id === undefined ? undefined : this.pendientes.get(mensaje.id);
        if (!pendiente || mensaje.id === undefined) {
          this.o.onLineaIgnorada?.(linea, `err sin comando: ${mensaje.code}`);
          return;
        }
        clearTimeout(pendiente.temporizador);
        this.pendientes.delete(mensaje.id);
        pendiente.rechazar(new ErrorProtocolo(mensajeDeCodigo(mensaje.code)));
        return;
      }
      case 'press':
        this.cambiarAcordeEnCurso({ presionados: mensaje.p, acorde: mensaje.m });
        return;
      case 'chord':
        this.cambiarAcordeEnCurso(SIN_ACORDE);
        this.acordes.emitir(mensaje.m);
        return;
      case 'key':
        this.teclas.emitir(mensaje.k);
        return;
    }
  }

  /** `boot` inesperado: el ESP32 se reinició. Durante el saludo, se reenvía `hello` de inmediato. */
  private alReiniciarse(): void {
    this.cambiarAcordeEnCurso(SIN_ACORDE);
    for (const [id, p] of this.pendientes) {
      clearTimeout(p.temporizador);
      this.pendientes.delete(id);
      p.rechazar(new ErrorReinicio('El dispositivo se reinició.'));
    }
    if (this.estadoActual === 'listo' || this.estadoActual === 'moviendo') {
      this.cambiarEstado('conectando');
      this.saludar()
        .then(() => this.cambiarEstado('listo'))
        .catch(() => this.perderConexion());
    }
  }

  private iniciarLatido(): void {
    if (this.o.intervaloPingMs <= 0) return;
    this.latido = setInterval(() => {
      if (this.estadoActual !== 'listo' && this.estadoActual !== 'moviendo') return;
      this.pedir({ t: 'ping' }, 'pong', Math.min(this.o.timeoutAckMs, this.o.intervaloPingMs))
        .then(() => {
          this.pongsPerdidos = 0;
        })
        .catch(() => {
          this.pongsPerdidos += 1;
          if (this.pongsPerdidos >= PONGS_PERDIDOS_MAXIMOS) void this.perderConexion();
        });
    }, this.o.intervaloPingMs);
  }

  private async perderConexion(): Promise<void> {
    if (this.estadoActual === 'desconectado') return;
    await this.cerrarRecursos();
    this.cambiarEstado('desconectado');
  }

  private rechazarPendientes(motivo: string): void {
    for (const [id, p] of this.pendientes) {
      clearTimeout(p.temporizador);
      this.pendientes.delete(id);
      p.rechazar(new ErrorProtocolo(motivo));
    }
  }

  private async cerrarRecursos(): Promise<void> {
    this.cerrando = true;
    if (this.latido) clearInterval(this.latido);
    this.latido = null;
    this.pongsPerdidos = 0;
    this.cambiarAcordeEnCurso(SIN_ACORDE);
    this.rechazarPendientes('Conexión cerrada.');
    await this.lector?.cancel().catch(() => undefined);
    await this.bucle;
    await this.tuberia;
    this.lector = null;
    this.bucle = null;
    this.tuberia = null;
    if (this.escritor) {
      await this.escritor.close().catch(() => undefined);
      this.escritor.releaseLock();
      this.escritor = null;
    }
    await this.puerto.close().catch(() => undefined);
    this.cerrando = false;
  }

  private cambiarAcordeEnCurso(estado: AcordeEnCurso): void {
    if (estado.presionados === this.enCurso.presionados && estado.acorde === this.enCurso.acorde)
      return;
    this.enCurso = estado;
    this.acordesEnCurso.emitir(estado);
  }

  private cambiarEstado(estado: EstadoConexion): void {
    if (this.estadoActual === estado) return;
    this.estadoActual = estado;
    this.estados.emitir(estado);
  }
}

// ───────────────────────── ayudas para el navegador ─────────────────────────

interface SerialNavegador {
  requestPort(): Promise<PuertoSerie>;
  getPorts(): Promise<PuertoSerie[]>;
}

function serialDelNavegador(): SerialNavegador | undefined {
  return (globalThis.navigator as { serial?: SerialNavegador } | undefined)?.serial;
}

/** true en Chrome, Edge y Firefox 151+ de escritorio (contexto HTTPS o localhost). */
export function webSerialDisponible(): boolean {
  return serialDelNavegador() !== undefined;
}

/** Abre el selector de puertos del navegador. Debe llamarse desde un gesto del usuario. */
export async function solicitarPuertoSerie(): Promise<PuertoSerie> {
  const serial = serialDelNavegador();
  if (!serial)
    throw new ErrorProtocolo('Este navegador no permite conectar el dispositivo por USB.');
  try {
    return await serial.requestPort();
  } catch (error) {
    throw traducirErrorNavegador(error, 'elegir');
  }
}

/** Puertos que la persona ya autorizó: permiten reconectar sin volver a abrir el selector. */
export async function puertosSerieAutorizados(): Promise<PuertoSerie[]> {
  try {
    return (await serialDelNavegador()?.getPorts()) ?? [];
  } catch (error) {
    throw traducirErrorNavegador(error, 'elegir');
  }
}
