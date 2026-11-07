# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.
Cada `release/*` mueve lo de "Sin publicar" a su versión.

## [Sin publicar]

### Agregado

- Pruebas de interfaz en `apps/web` (Vitest + jsdom + Testing Library + axe-core) y pruebas de la conexión por USB: acción explícita, anuncios en español y accesibilidad (RF-01).
- `docs/PRUEBAS-NVDA.md`: requisito de tener una voz en español y el cambio automático de idioma en NVDA, porque una voz en inglés lee «la be» como «la bi».
- `docs/PRUEBAS-NVDA.md`: resultados de N-03, N-10, N-22 y N-23 con NVDA en Chrome 157 (RF-01).
- Pruebas de que nada que suponga la celda levantada se narra antes del `ack` de `cell`, ni cuando el `ack` no llega o el firmware responde `err` (`apps/web/test/esperar-ack.test.tsx` y `packages/device`) y resultado de N-11 con la placa y NVDA (RF-04).
- Pruebas de contrato (`packages/device/test/contrato-dispositivo.test.ts`): los mismos escenarios corren contra el simulador y contra el dispositivo real con el firmware falso (RF-03).
- Pruebas de la desconexión y la reconexión (`apps/web/test/reconectar-dispositivo.test.tsx` y `packages/device`) y resultados de N-13, N-14 y N-21 con NVDA (RF-02).
- Pruebas de `packages/device` para navegador sin Web Serial, falta de permiso, reintento y segunda conexión (RF-01).

### Corregido

- El simulador se comporta como el dispositivo real: pasa por `conectando`, rechaza conectar dos veces, pone las órdenes en cola, usa los mismos errores y, si se desconecta durante un movimiento, rechaza la orden con `ErrorConexionCerrada` sin volver a `listo` (RF-03).
- Al retirar el cable con una orden en curso, el adaptador ya no pasa por el estado `listo` y la orden se rechaza con `ErrorConexionCerrada`; la interfaz no anuncia ese fallo además del aviso de desconexión (RF-02).
- Si falla una reconexión, la pantalla conserva el dispositivo con el botón "Reconectar" en vez de volver al simulador; al reconectar con éxito el foco pasa al área de escritura y el ejercicio (serie y letra) se conserva (RF-02).
- Los errores del navegador se traducen aunque el `DOMException` venga de otro contexto (iframe), donde no cumple `instanceof Error` (RF-01).
