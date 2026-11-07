# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.
Cada `release/*` mueve lo de "Sin publicar" a su versión.

## [Sin publicar]

### Agregado

- Pruebas de interfaz en `apps/web` (Vitest + jsdom + Testing Library + axe-core) y pruebas de la conexión por USB: acción explícita, anuncios en español y accesibilidad (RF-01).
- Pruebas de `packages/device` para navegador sin Web Serial, falta de permiso, reintento y segunda conexión (RF-01).

### Corregido

- Los errores del navegador se traducen aunque el `DOMException` venga de otro contexto (iframe), donde no cumple `instanceof Error` (RF-01).
