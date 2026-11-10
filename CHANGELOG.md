# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.
Cada `release/*` mueve lo de "Sin publicar" a su versión.

## [Sin publicar]

### Agregado

- Flujo `.github/workflows/seguridad.yml`: Gitleaks revisa secretos en el historial y `pnpm audit --audit-level high` revisa vulnerabilidades en dependencias, en cada PR y en cada push a `main`.
- Presentación de letras (RF-06): sección "Presentación de letras" con "Presentar la letra" y "Siguiente letra". Levanta la letra, espera el `ack` y narra «Letra 4 de 10. Toque la celda. Esta es la de. Su forma: codo a la derecha.», sin números de puntos y sin evaluar ni generar intentos. Las letras sin `figura` solo se nombran. `describirPresentacion` en `braille-core` y pruebas en `apps/web/test/presentar-letra.test.tsx`.
- Pruebas de la verificación del dispositivo al entrar, de la práctica ligada al dispositivo listo, de los mensajes de sin dispositivo, sin Web Serial, desconexión y firmware incompatible, del foco y de la accesibilidad (`apps/web/test/verificar-dispositivo.test.tsx`) (RF-34).
- Pruebas de interfaz en `apps/web` (Vitest + jsdom + Testing Library + axe-core) y pruebas de la conexión por USB: acción explícita, anuncios en español y accesibilidad (RF-01).
- `docs/PRUEBAS-NVDA.md`: requisito de tener una voz en español y el cambio automático de idioma en NVDA, porque una voz en inglés lee «la be» como «la bi».
- `docs/PRUEBAS-NVDA.md`: resultados de N-03, N-10, N-22 y N-23 con NVDA en Chrome 157 (RF-01).
- Pruebas de lo que levanta cada botón de la sección Lectura (cada signo de la lista, "Mostrar en la celda", los seis puntos sueltos y "Bajar todos los puntos"), de la celda dibujada y de su accesibilidad (`apps/web/test/levantar-celda.test.tsx`); comprobado con la placa: cada punto sube por separado y un signo de cinco puntos (la a con tilde) sube a la vez (RF-05).
- Pruebas de que nada que suponga la celda levantada se narra antes del `ack` de `cell`, ni cuando el `ack` no llega o el firmware responde `err` (`apps/web/test/esperar-ack.test.tsx` y `packages/device`) y resultado de N-11 con la placa y NVDA (RF-04).
- Pruebas de contrato (`packages/device/test/contrato-dispositivo.test.ts`): los mismos escenarios corren contra el simulador y contra el dispositivo real con el firmware falso (RF-03).
- Pruebas de la desconexión y la reconexión (`apps/web/test/reconectar-dispositivo.test.tsx` y `packages/device`) y resultados de N-13, N-14 y N-21 con NVDA (RF-02).
- Pruebas de `packages/device` para navegador sin Web Serial, falta de permiso, reintento y segunda conexión (RF-01).

### Cambiado

- `CLAUDE.md`: las ramas siguen Git Flow desde `develop` (`feature/RF-xx-…`) en lugar de ramas `prototipo/` desde `main`. La etiqueta `prototipo` se mantiene.
- La pantalla se organiza en zonas (RF-06): "Aprender: lectura" (presentación de letras), "Practicar: escritura" y, solo en desarrollo, "Herramientas de prueba" con la lectura técnica de signos y puntos sueltos. En escritorio, Aprender y Practicar van lado a lado. Los encabezados quedan sin saltos de nivel (las zonas son h2; las secciones, h3; sus subsecciones, h4), y la lectura técnica deja de verse en producción.
- El dispositivo es obligatorio (ADR-0012, RF-34): Lectura y Escritura solo se muestran con el dispositivo listo, y si se pierde la práctica se pausa y conserva la serie y la letra. Al entrar sin dispositivo se anuncia qué revisar y a quién pedir ayuda, sin abrir el puerto sin un clic.
- El simulador solo está disponible con `pnpm dev` y en las pruebas (`App` recibe `permitirSimulador`). En producción desaparecen "Volver al simulador" y la caída al simulador cuando falla la conexión.
- Mensajes nuevos de sin dispositivo, sin Web Serial, desconexión (ya no ofrece "seguir con la celda virtual") y firmware incompatible ("El dispositivo necesita una actualización. Pide ayuda a tu tutor.").

### Corregido

- Pruebas de `esperar-ack.test.tsx` más estables: el `ack` falso pasó de 300 ms a 1 s, porque con la máquina cargada el clic tardaba más que la mitad del `ack` y fallaban de forma intermitente (RF-06).
- El aviso de "sin dispositivo" al entrar espera 1,5 s: NVDA descartaba el que llegaba justo al cargar la página y solo se oía al señalarlo con el mouse. Si la persona ya empezó a conectar, el aviso no se repite (RF-34).
- `mostrarCelda` rechaza al instante una máscara que no sea un entero de 0 a 63 (`ErrorProtocolo`), en el dispositivo real y en el simulador. Antes el firmware respondía `BAD_MESSAGE` sin `id` y la app tardaba dos timeouts en decir "no confirmó a tiempo" (RF-05).
- El simulador se comporta como el dispositivo real: pasa por `conectando`, rechaza conectar dos veces, pone las órdenes en cola, usa los mismos errores y, si se desconecta durante un movimiento, rechaza la orden con `ErrorConexionCerrada` sin volver a `listo` (RF-03).
- Al retirar el cable con una orden en curso, el adaptador ya no pasa por el estado `listo` y la orden se rechaza con `ErrorConexionCerrada`; la interfaz no anuncia ese fallo además del aviso de desconexión (RF-02).
- Si falla una reconexión, la pantalla conserva el dispositivo con el botón "Reconectar" en vez de volver al simulador; al reconectar con éxito el foco pasa al área de escritura y el ejercicio (serie y letra) se conserva (RF-02).
- Los errores del navegador se traducen aunque el `DOMException` venga de otro contexto (iframe), donde no cumple `instanceof Error` (RF-01).
