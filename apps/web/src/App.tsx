/**
 * VERSIÓN DE PRUEBA (no es la interfaz final).
 * Comprueba que braille-core, el simulador y el adaptador Web Serial encajan en lecciones de las
 * series a–j, k–t y u–z. El diseño visual llega después de la sesión de ideación; aquí solo
 * importan la semántica y la accesibilidad.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PUNTOS,
  TABLA,
  describirEvaluacion,
  describirPuntos,
  esLetra,
  evaluar,
  mascaraAPuntos,
  nombreConArticulo,
  signoPorId,
  signoPorMascara,
  signosDeSerie,
  type Mascara,
  type Serie,
  type Signo,
} from '@braille/core';
import {
  DispositivoWebSerial,
  ErrorConexionCerrada,
  ErrorIncompatible,
  SIN_ACORDE,
  SimuladorDispositivo,
  crearLectorSeisTeclas,
  puertosSerieAutorizados,
  solicitarPuertoSerie,
  webSerialDisponible,
  type AcordeEnCurso,
  type DispositivoBraille,
  type EstadoConexion,
  type LectorSeisTeclas,
  type PuertoSerie,
} from '@braille/device';

/** Series del código generador, en el orden en que se enseñan. */
const SERIES: readonly { serie: Serie; rango: string }[] = [
  { serie: 1, rango: 'a–j' },
  { serie: 2, rango: 'k–t' },
  { serie: 3, rango: 'u–z' },
];

/** Lo que se anuncia al verificar el dispositivo (RF-34). Están escritos para ser escuchados. */
const MENSAJE_SIN_DISPOSITIVO =
  'No hay un dispositivo conectado. Conecta el cable USB y activa «Conectar dispositivo por USB». Si no funciona, pide ayuda a tu tutor.';
const MENSAJE_SIN_WEB_SERIAL =
  'Este navegador no permite usar el dispositivo. Abre el sitio en Chrome o Edge de escritorio, o pide ayuda a tu tutor.';
const MENSAJE_DESCONEXION =
  'Se desconectó el dispositivo. Revisa el cable y activa «Reconectar». Tu ejercicio sigue donde lo dejaste.';
const MENSAJE_ACTUALIZACION = 'El dispositivo necesita una actualización. Pide ayuda a tu tutor.';

/**
 * Al cargar la página NVDA está leyendo el título y descarta un aviso de la región en vivo que
 * llega enseguida (N-24). El aviso inicial espera a que termine esa lectura.
 */
const RETARDO_AVISO_INICIAL_MS = 1_500;

const TEXTO_ESTADO: Record<EstadoConexion, string> = {
  desconectado: 'desconectado',
  conectando: 'conectando…',
  listo: 'listo',
  moviendo: 'moviendo la celda…',
  error: 'error de conexión',
};

/**
 * La celda de lectura acepta órdenes. Mientras se mueve también: el adaptador Web Serial pone la
 * siguiente en cola, y así los botones no se deshabilitan (un botón con foco que se deshabilita
 * deja al lector de pantalla sin foco).
 */
const puedeMoverCelda = (estado: EstadoConexion) => estado === 'listo' || estado === 'moviendo';

interface GrupoDeSignos {
  titulo: string;
  signos: readonly Signo[];
}

/** Letras de las tres series: las que se pueden dictar en el ejercicio de escritura. */
const GRUPOS_DE_SERIES: readonly GrupoDeSignos[] = SERIES.map(({ serie, rango }) => ({
  titulo: `Serie ${serie} (${rango})`,
  signos: signosDeSerie(serie),
}));

/** Signos que se pueden levantar en la sección "Lectura", en el orden de enseñanza. */
const GRUPOS_DE_SIGNOS: readonly GrupoDeSignos[] = [
  ...GRUPOS_DE_SERIES,
  {
    titulo: 'Letras con código propio',
    signos: TABLA.filter((s) => s.categoria === 'letra-especial'),
  },
  { titulo: 'Prefijos', signos: TABLA.filter((s) => s.categoria === 'prefijo') },
  { titulo: 'Puntuación', signos: TABLA.filter((s) => s.categoria === 'puntuacion') },
];

type OrigenAcorde = 'teclado' | 'celda virtual' | 'dispositivo';

interface AcordeEscrito {
  mascara: Mascara;
  origen: OrigenAcorde;
}

const TEXTO_ORIGEN: Record<OrigenAcorde, string> = {
  teclado: 'con el teclado',
  'celda virtual': 'con la celda virtual',
  dispositivo: 'con el dispositivo',
};

const mayuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
const bit = (punto: number) => 1 << (punto - 1);

function describirSigno(signo: Signo): string {
  const figura = signo.figura ? ` Figura: ${signo.figura}.` : '';
  return `${mayuscula(nombreConArticulo(signo))}: ${describirPuntos(signo.mascara)}.${figura}`;
}

type EstadoPunto = 'presionado' | 'soltado' | 'escrito' | 'vacio';

interface PropsVisor {
  /** Acorde en curso con el teclado de seis teclas de esta pantalla. */
  teclado: AcordeEnCurso;
  /** Acorde en curso con los pulsadores del dispositivo. */
  pulsadores: AcordeEnCurso;
  celdaVirtual: Mascara;
  ultimo: AcordeEscrito | null;
}

/**
 * Visor de la celda: muestra los puntos del acorde que se está escribiendo (teclado de seis
 * teclas, pulsadores del dispositivo o celda virtual) y, cuando no hay ninguno en curso, el último
 * acorde escrito desde cualquier entrada. El texto no es región live: los anuncios siguen saliendo
 * por una sola voz.
 */
function VisorCelda({ teclado, pulsadores, celdaVirtual, ultimo }: PropsVisor) {
  let escritura: { estado: AcordeEnCurso; origen: OrigenAcorde } | null = null;
  if (teclado.acorde !== 0) escritura = { estado: teclado, origen: 'teclado' };
  else if (pulsadores.acorde !== 0) escritura = { estado: pulsadores, origen: 'dispositivo' };

  function estadoDe(p: number): EstadoPunto {
    if (escritura) {
      if (escritura.estado.presionados & bit(p)) return 'presionado';
      return escritura.estado.acorde & bit(p) ? 'soltado' : 'vacio';
    }
    if (celdaVirtual !== 0) return celdaVirtual & bit(p) ? 'presionado' : 'vacio';
    return ultimo && ultimo.mascara & bit(p) ? 'escrito' : 'vacio';
  }

  let texto: string;
  if (escritura) {
    const { presionados, acorde } = escritura.estado;
    const sueltos = acorde & ~presionados;
    texto =
      `Escribiendo ${TEXTO_ORIGEN[escritura.origen]}: ${describirPuntos(acorde)}.` +
      (sueltos ? ` Ya soltaste ${describirPuntos(sueltos)}, pero sigue en el acorde.` : '');
  } else if (celdaVirtual !== 0) {
    texto = `Marcando en la celda virtual: ${describirPuntos(celdaVirtual)}.`;
  } else if (ultimo) {
    const signo = signoPorMascara(ultimo.mascara);
    texto =
      `Último acorde ${TEXTO_ORIGEN[ultimo.origen]}: ${describirPuntos(ultimo.mascara)}` +
      (signo ? `, ${nombreConArticulo(signo)}.` : ', que no corresponde a ningún signo.');
  } else {
    texto = 'Todavía no has presionado ningún punto.';
  }

  return (
    <section aria-labelledby="t-visor" className="bloque">
      <h3 id="t-visor">Visor de la celda</h3>
      <div className="celda celda-grande celda-visor" aria-hidden="true">
        {PUNTOS.map((p) => (
          <span key={p} className="punto" data-estado={estadoDe(p)}>
            <span className="numero">{p}</span>
          </span>
        ))}
      </div>
      <p className="estado-celda">{texto}</p>
    </section>
  );
}

/** "d: puntos 1, 4 y 5" o "signo de mayúscula: puntos 4 y 6". */
function etiquetaDeSigno(signo: Signo): string {
  return `${esLetra(signo) ? signo.id : signo.nombre}: ${describirPuntos(signo.mascara)}`;
}

function OpcionesDeSignos({ grupos }: { grupos: readonly GrupoDeSignos[] }) {
  return grupos.map(({ titulo, signos }) => (
    <optgroup key={titulo} label={titulo}>
      {signos.map((s) => (
        <option key={s.id} value={s.id}>
          {etiquetaDeSigno(s)}
        </option>
      ))}
    </optgroup>
  ));
}

function describirCeldaLevantada(mascara: Mascara | null): string {
  if (mascara === null) return 'Todavía no se ha levantado nada con este dispositivo.';
  if (mascara === 0) return 'Todos los puntos están abajo.';
  const signo = signoPorMascara(mascara);
  return (
    `En la celda: ${describirPuntos(mascara)}` +
    (signo ? `, ${nombreConArticulo(signo)}.` : ', que no corresponde a ningún signo.')
  );
}

interface PropsLectura {
  /** Lo que la celda tiene levantado ahora; null si todavía no se movió con este dispositivo. */
  levantada: Mascara | null;
  esFisico: boolean;
  habilitada: boolean;
  onLevantar: (signo: Signo) => void;
  onLevantarPunto: (punto: number) => void;
  onBajar: () => void;
}

/**
 * Lectura: levanta cualquier signo de la tabla o un solo punto en la celda (en los servos o en el
 * simulador), para tocarlo o para probar el montaje, y muestra lo que la celda tiene levantado
 * ahora.
 */
function SeccionLectura({
  levantada,
  esFisico,
  habilitada,
  onLevantar,
  onLevantarPunto,
  onBajar,
}: PropsLectura) {
  const [idSigno, setIdSigno] = useState(TABLA[0]!.id);
  const signo = signoPorId(idSigno)!;

  return (
    <section aria-labelledby="t-lectura" className="panel">
      <h2 id="t-lectura">Lectura</h2>
      <p className="nota">
        Elige un signo y levántalo en {esFisico ? 'los servos del dispositivo' : 'el simulador'}{' '}
        para tocarlo.
      </p>
      <div className="formulario">
        <label className="campo">
          Signo
          <select value={idSigno} onChange={(e) => setIdSigno(e.target.value)}>
            <OpcionesDeSignos grupos={GRUPOS_DE_SIGNOS} />
          </select>
        </label>
        <div className="acciones">
          <button
            type="button"
            className="principal"
            onClick={() => onLevantar(signo)}
            disabled={!habilitada}
          >
            Levantar en la celda
          </button>
          <button type="button" onClick={onBajar} disabled={!habilitada}>
            Bajar todos los puntos
          </button>
        </div>
      </div>
      <div className="bloque">
        <div className="celda celda-grande celda-lectura" aria-hidden="true">
          {PUNTOS.map((p) => (
            <span
              key={p}
              className="punto"
              data-activo={levantada !== null && (levantada & bit(p)) !== 0}
            >
              {p}
            </span>
          ))}
        </div>
        <p className="estado-celda">{describirCeldaLevantada(levantada)}</p>
      </div>
      <section aria-labelledby="t-puntos" className="bloque">
        <h3 id="t-puntos">Puntos sueltos</h3>
        <p className="nota">
          Levanta un solo punto, para reconocer su posición o revisar que cada servo sube y baja.
        </p>
        <div className="celda" role="group" aria-labelledby="t-puntos">
          {PUNTOS.map((p) => (
            <button
              key={p}
              type="button"
              className="punto"
              aria-label={`Levantar el punto ${p}`}
              onClick={() => onLevantarPunto(p)}
              disabled={!habilitada}
            >
              {p}
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

interface PropsApp {
  /**
   * El simulador solo sirve para desarrollo y pruebas (ADR-0012): el estudiante siempre usa el
   * dispositivo. Por defecto solo se permite con `pnpm dev` y en las pruebas.
   */
  permitirSimulador?: boolean;
}

export function App({ permitirSimulador = import.meta.env.DEV }: PropsApp) {
  const simulador = useMemo(() => new SimuladorDispositivo(), []);
  const [dispositivo, setDispositivo] = useState<DispositivoBraille>(simulador);
  const [estado, setEstado] = useState<EstadoConexion>('desconectado');
  const [serie, setSerie] = useState<Serie>(1);
  const [indice, setIndice] = useState(0);
  const [anuncio, setAnuncio] = useState('');
  const [celdaVirtual, setCeldaVirtual] = useState<Mascara>(0);
  const [celdaLevantada, setCeldaLevantada] = useState<Mascara | null>(null);
  const [teclado, setTeclado] = useState<AcordeEnCurso>(SIN_ACORDE);
  const [pulsadores, setPulsadores] = useState<AcordeEnCurso>(SIN_ACORDE);
  const [ultimoAcorde, setUltimoAcorde] = useState<AcordeEscrito | null>(null);
  /** La práctica (Lectura y Escritura) solo existe con el dispositivo listo (RF-34). */
  const [practicaDisponible, setPracticaDisponible] = useState(false);
  /** Entrada de pantalla que originó el próximo acorde; si no hay, vino del dispositivo. */
  const origenRef = useRef<OrigenAcorde | null>(null);
  /** El área de escritura: allí se retoma el ejercicio tras reconectar. */
  const areaEscrituraRef = useRef<HTMLDivElement>(null);
  /** true mientras se reconecta tras una desconexión (RF-02); lo apaga el resultado del intento. */
  const reconectandoRef = useRef(false);
  /** Al volver la práctica tras reconectar, el foco va al área de escritura. */
  const enfocarAreaRef = useRef(false);
  const reconectarRef = useRef<HTMLButtonElement>(null);
  const practicaAnteriorRef = useRef(false);
  /** true cuando la persona ya empezó a conectar: el aviso inicial deja de tener sentido. */
  const intentoDeConexionRef = useRef(false);
  const letras = useMemo(() => signosDeSerie(serie), [serie]);
  const objetivo = letras[indice % letras.length]!;
  const esFisico = dispositivo !== simulador;
  const usandoSimulador = !esFisico && permitirSimulador;

  const objetivoRef = useRef(objetivo);
  const letrasRef = useRef(letras);
  useEffect(() => {
    objetivoRef.current = objetivo;
    letrasRef.current = letras;
  }, [objetivo, letras]);

  /** Región ARIA live: el lector de pantalla lo lee con la voz que la persona ya configuró. */
  const anunciar = useCallback((texto: string) => {
    setAnuncio(''); // vaciar primero permite repetir un mensaje idéntico
    window.setTimeout(() => setAnuncio(texto), 60);
  }, []);

  /**
   * Anuncia que una orden a la celda falló. Si falló porque se cerró la conexión, no dice nada:
   * el aviso de desconexión ya lo explica y dos mensajes seguidos se pisan.
   */
  const anunciarFalloDeCelda = useCallback(
    (texto: string, error: unknown) => {
      if (error instanceof ErrorConexionCerrada) return;
      anunciar(`${texto}: ${(error as Error).message}`);
    },
    [anunciar],
  );

  /** Mueve la celda de lectura; resuelve cuando quedó quieta y se puede tocar. */
  const levantar = useCallback(
    async (mascara: Mascara) => {
      await dispositivo.mostrarCelda(mascara);
      setCeldaLevantada(mascara);
    },
    [dispositivo],
  );

  const manejarAcorde = useCallback(
    (mascara: Mascara) => {
      setUltimoAcorde({ mascara, origen: origenRef.current ?? 'dispositivo' });
      origenRef.current = null;
      const esperado = objetivoRef.current;
      const evaluacion = evaluar(esperado.mascara, mascara);
      const mensaje = describirEvaluacion(evaluacion, esperado);
      if (evaluacion.tipo === 'acierto') {
        const serieActual = letrasRef.current;
        const siguiente = serieActual[(serieActual.indexOf(esperado) + 1) % serieActual.length]!;
        setIndice((i) => i + 1);
        anunciar(`${mensaje} Ahora escribe ${nombreConArticulo(siguiente)}.`);
      } else {
        anunciar(`${mensaje} Intenta de nuevo ${nombreConArticulo(esperado)}.`);
      }
      // Eco: la celda de lectura levanta lo que se escribió, para tocarlo. La retroalimentación
      // no espera a los servos (RNF-02); sin dispositivo listo no se intenta, para que un error
      // no tape el anuncio de la evaluación.
      if (puedeMoverCelda(dispositivo.estado)) {
        levantar(mascara).catch((error: unknown) =>
          anunciarFalloDeCelda('No se pudo levantar en la celda lo que escribiste', error),
        );
      }
    },
    [anunciar, anunciarFalloDeCelda, dispositivo, levantar],
  );

  const repetirInstruccion = useCallback(() => {
    anunciar(`Escribe ${nombreConArticulo(objetivoRef.current)}.`);
  }, [anunciar]);

  // Al entrar sin simulador se verifica el dispositivo y se anuncia el resultado. No se abre el
  // puerto sin un clic (RF-01): conectar exige un gesto de la persona.
  useEffect(() => {
    if (permitirSimulador) return;
    const temporizador = window.setTimeout(() => {
      if (intentoDeConexionRef.current) return;
      anunciar(webSerialDisponible() ? MENSAJE_SIN_DISPOSITIVO : MENSAJE_SIN_WEB_SERIAL);
    }, RETARDO_AVISO_INICIAL_MS);
    return () => window.clearTimeout(temporizador);
  }, [permitirSimulador, anunciar]);

  // Suscripción a los eventos del dispositivo activo y conexión inicial.
  useEffect(() => {
    const cancelar = [
      dispositivo.onEstado((nuevo) => {
        setEstado(nuevo);
        if (nuevo === 'listo') setPracticaDisponible(true);
        else if (nuevo === 'desconectado' || nuevo === 'error') setPracticaDisponible(false);
        if (nuevo === 'desconectado' && dispositivo !== simulador) anunciar(MENSAJE_DESCONEXION);
      }),
      dispositivo.onAcorde(manejarAcorde),
      dispositivo.onAcordeEnCurso(setPulsadores),
      dispositivo.onTecla((tecla) => {
        if (tecla === 'repeat') repetirInstruccion();
      }),
    ];
    if (dispositivo.estado === 'desconectado' && (dispositivo !== simulador || permitirSimulador)) {
      dispositivo
        .conectar()
        .then((info) => {
          anunciar(
            `${info.firmware === 'simulador' ? 'Simulador' : 'Dispositivo'} listo. ` +
              `Escribe ${nombreConArticulo(objetivoRef.current)}.`,
          );
          reconectandoRef.current = false;
        })
        .catch((error: Error) => {
          anunciar(
            error instanceof ErrorIncompatible
              ? MENSAJE_ACTUALIZACION
              : `No se pudo conectar: ${error.message}`,
          );
          // Si falla, el dispositivo queda en error con "Reconectar" a mano. Solo en desarrollo, y
          // en la primera conexión, se vuelve al simulador.
          if (!reconectandoRef.current && permitirSimulador) setDispositivo(simulador);
          reconectandoRef.current = false;
          enfocarAreaRef.current = false;
        });
    }
    return () => cancelar.forEach((c) => c());
  }, [dispositivo, simulador, permitirSimulador, manejarAcorde, repetirInstruccion, anunciar]);

  // El foco no se pierde cuando la práctica aparece o desaparece: al perder el dispositivo va a
  // "Reconectar"; al volver tras reconectar, al área de escritura (RF-02, RF-34).
  useEffect(() => {
    const habiaPractica = practicaAnteriorRef.current;
    practicaAnteriorRef.current = practicaDisponible;
    if (habiaPractica && !practicaDisponible) reconectarRef.current?.focus();
    if (practicaDisponible && enfocarAreaRef.current) {
      areaEscrituraRef.current?.focus();
      enfocarAreaRef.current = false;
    }
  }, [practicaDisponible, estado]);

  // La escritura de pantalla pasa por el mismo camino que la del dispositivo.
  const escribir = useCallback(
    (mascara: Mascara, origen: OrigenAcorde) => {
      origenRef.current = origen;
      if (dispositivo === simulador) simulador.pulsarAcorde(mascara);
      else manejarAcorde(mascara);
    },
    [dispositivo, simulador, manejarAcorde],
  );
  const escribirRef = useRef(escribir);
  useEffect(() => {
    escribirRef.current = escribir;
  }, [escribir]);
  const lectorRef = useRef<LectorSeisTeclas | null>(null);
  /** Solo se llama desde manejadores de eventos (nunca durante el render). */
  function lector(): LectorSeisTeclas {
    lectorRef.current ??= crearLectorSeisTeclas(
      (m) => escribirRef.current(m, 'teclado'),
      setTeclado,
    );
    return lectorRef.current;
  }

  /** Lo que mostraba el dispositivo anterior ya no aplica al nuevo. */
  function cambiarDispositivo(nuevo: DispositivoBraille) {
    setDispositivo(nuevo);
    setPracticaDisponible(false);
    setCeldaLevantada(null);
    setPulsadores(SIN_ACORDE);
  }

  async function usarPuerto(obtenerPuerto: () => Promise<PuertoSerie>) {
    intentoDeConexionRef.current = true;
    try {
      cambiarDispositivo(new DispositivoWebSerial(await obtenerPuerto()));
    } catch (error) {
      reconectandoRef.current = false;
      enfocarAreaRef.current = false;
      anunciar(`No se abrió ningún puerto: ${(error as Error).message}`);
    }
  }

  async function conectarUsb() {
    await usarPuerto(solicitarPuertoSerie);
  }

  /** Tras una desconexión: si hay un solo puerto autorizado, se usa sin abrir el selector. */
  async function reconectar() {
    reconectandoRef.current = true;
    enfocarAreaRef.current = true;
    await usarPuerto(async () => {
      const autorizados = await puertosSerieAutorizados();
      return autorizados.length === 1 ? autorizados[0]! : solicitarPuertoSerie();
    });
  }

  async function volverAlSimulador() {
    await dispositivo.desconectar();
    cambiarDispositivo(simulador);
  }

  function cambiarSerie(nueva: Serie) {
    const signos = signosDeSerie(nueva);
    setSerie(nueva);
    setIndice(0);
    anunciar(
      `Serie ${nueva}: de ${nombreConArticulo(signos[0]!)} a ${nombreConArticulo(signos.at(-1)!)}. ` +
        `Escribe ${nombreConArticulo(signos[0]!)}.`,
    );
  }

  /**
   * Fija la letra que se va a escribir, de cualquier serie. No anuncia nada: el cuadro combinado
   * ya dice la letra al cambiarla, y así recorrerlo con las flechas no llena la región live.
   */
  function dictarLetra(id: string) {
    const signo = signoPorId(id)!;
    const serieDeLetra = signo.serie!;
    setSerie(serieDeLetra);
    setIndice(signosDeSerie(serieDeLetra).findIndex((s) => s.id === id));
  }

  async function mostrarEnCelda() {
    try {
      await levantar(objetivo.mascara);
      anunciar(`${describirSigno(objetivo)} Tócala y luego escríbela.`);
    } catch (error) {
      anunciarFalloDeCelda('La celda no respondió', error);
    }
  }

  async function levantarSigno(signo: Signo) {
    try {
      await levantar(signo.mascara);
      anunciar(`${describirSigno(signo)} Ya puedes tocar la celda.`);
    } catch (error) {
      anunciarFalloDeCelda('La celda no respondió', error);
    }
  }

  async function levantarPunto(punto: number) {
    try {
      await levantar(bit(punto));
      anunciar(`${mayuscula(describirPuntos(bit(punto)))}. Ya puedes tocar la celda.`);
    } catch (error) {
      anunciarFalloDeCelda('La celda no respondió', error);
    }
  }

  async function bajarCelda() {
    try {
      await dispositivo.limpiar();
      setCeldaLevantada(0);
      anunciar('Todos los puntos están abajo.');
    } catch (error) {
      anunciarFalloDeCelda('La celda no respondió', error);
    }
  }

  function enviarCeldaVirtual() {
    if (celdaVirtual === 0) {
      anunciar('La celda está vacía: marca al menos un punto.');
      return;
    }
    escribir(celdaVirtual, 'celda virtual');
    setCeldaVirtual(0);
  }

  return (
    <main>
      <header className="cabecera">
        <div className="titulo">
          <h1>Práctica de lectoescritura Braille</h1>
          <p className="etiqueta-prueba">Versión de prueba</p>
        </div>
        <p className="nota">
          Sirve para probar el núcleo Braille y el dispositivo. Todavía faltan las entidades de la
          base de datos, el backend y el diseño final.
        </p>
      </header>

      <div role="status" aria-live="polite" aria-atomic="true" className="anuncio">
        {anuncio}
      </div>

      <section aria-labelledby="t-dispositivo" className="barra-dispositivo">
        <h2 id="t-dispositivo">Dispositivo</h2>
        <p>
          {usandoSimulador ? 'Usando el simulador' : 'Dispositivo por USB'}:{' '}
          <span className="estado-conexion" data-estado={estado}>
            {TEXTO_ESTADO[estado]}
          </span>
          .
        </p>
        {usandoSimulador && <p className="nota">Modo de desarrollo: simulador</p>}
        {esFisico ? (
          <div className="acciones">
            {(estado === 'desconectado' || estado === 'error') && (
              <button type="button" className="principal" ref={reconectarRef} onClick={reconectar}>
                Reconectar
              </button>
            )}
            {permitirSimulador && (
              <button type="button" onClick={volverAlSimulador}>
                Volver al simulador
              </button>
            )}
          </div>
        ) : webSerialDisponible() ? (
          <button type="button" onClick={conectarUsb}>
            Conectar dispositivo por USB
          </button>
        ) : (
          <p>Este navegador no permite conectar el dispositivo por USB.</p>
        )}
      </section>

      {practicaDisponible && (
        <div className="secciones">
          <SeccionLectura
            levantada={celdaLevantada}
            esFisico={esFisico}
            habilitada={puedeMoverCelda(estado)}
            onLevantar={levantarSigno}
            onLevantarPunto={levantarPunto}
            onBajar={bajarCelda}
          />

          <section aria-labelledby="t-escritura" className="panel">
            <h2 id="t-escritura">Escritura</h2>

            <section aria-labelledby="t-ejercicio">
              <h3 id="t-ejercicio">Ejercicio</h3>
              <fieldset className="selector-serie">
                <legend>Serie</legend>
                {SERIES.map(({ serie: s, rango }) => (
                  <label key={s}>
                    <input
                      type="radio"
                      name="serie"
                      checked={serie === s}
                      onChange={() => cambiarSerie(s)}
                    />
                    Serie {s} <span className="rango">{rango}</span>
                  </label>
                ))}
              </fieldset>
              <div className="formulario">
                <label className="campo">
                  Letra que se dicta
                  <select value={objetivo.id} onChange={(e) => dictarLetra(e.target.value)}>
                    <OpcionesDeSignos grupos={GRUPOS_DE_SERIES} />
                  </select>
                </label>
              </div>
              <p className="consigna">
                Escribe <strong>{nombreConArticulo(objetivo)}</strong>.
              </p>
              <div className="acciones">
                <button type="button" onClick={repetirInstruccion}>
                  Repetir instrucción
                </button>
                <button type="button" onClick={mostrarEnCelda} disabled={!puedeMoverCelda(estado)}>
                  Mostrar en la celda
                </button>
              </div>

              {/*
              role="application" hace que NVDA y JAWS pasen a modo foco y dejen llegar F D S J K L
              (en modo exploración esas letras son atajos de navegación). jsx-a11y lo trata como rol
              no interactivo; la excepción es deliberada y debe validarse con NVDA y JAWS reales.
            */}
              {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
              <div
                ref={areaEscrituraRef}
                className="area-escritura"
                role="application"
                tabIndex={0}
                aria-label="Área de escritura. Usa F, D y S para los puntos 1, 2 y 3; J, K y L para los puntos 4, 5 y 6. Suelta todas las teclas para confirmar. Espacio repite la instrucción."
                onKeyDown={(e) => {
                  if (lector().teclaAbajo(e.code, e.repeat)) e.preventDefault();
                  else if (e.code === 'Space') {
                    e.preventDefault();
                    repetirInstruccion();
                  }
                }}
                onKeyUp={(e) => {
                  if (lector().teclaArriba(e.code)) e.preventDefault();
                }}
                onBlur={() => lector().reiniciar()}
              >
                Área de escritura con teclado: F D S · J K L
              </div>
              {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
            </section>

            <div className="rejilla-escritura">
              <VisorCelda
                teclado={teclado}
                pulsadores={pulsadores}
                celdaVirtual={celdaVirtual}
                ultimo={ultimoAcorde}
              />

              <section aria-labelledby="t-celda" className="bloque">
                <h3 id="t-celda">Celda virtual</h3>
                <div className="celda celda-virtual" role="group" aria-labelledby="t-celda">
                  {PUNTOS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="punto"
                      aria-pressed={(celdaVirtual & bit(p)) !== 0}
                      onClick={() => setCeldaVirtual((c) => c ^ bit(p))}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="estado-celda">
                  Marcados:{' '}
                  {celdaVirtual === 0 ? 'ninguno' : mascaraAPuntos(celdaVirtual).join(', ')}
                </p>
                <button type="button" onClick={enviarCeldaVirtual}>
                  Enviar celda
                </button>
              </section>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
