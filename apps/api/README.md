# apps/api

Backend en NestJS con adaptador Fastify, PostgreSQL y Prisma. **Todavía no existe a propósito:** el
ciclo de aprendizaje (acorde → evaluación → retroalimentación) no necesita servidor, así que el
backend se construye al final del MVP, cuando la lección con el dispositivo ya funcione.

## Cuando llegue el momento

```bash
pnpm dlx @nestjs/cli new api --directory apps/api --package-manager pnpm --skip-git
pnpm --filter api add @nestjs/platform-fastify @prisma/client
pnpm --filter api add -D prisma
```

Cambiar el nombre del paquete a `@braille/api` y agregar un `docker-compose.yml` en la raíz con
`api` + `postgres` para desarrollo local.

## Módulos previstos (monolito modular)

| Módulo       | Responsabilidad                                                      |
| ------------ | -------------------------------------------------------------------- |
| `identidad`  | Usuarios, roles (estudiante, docente, administrador) y sesiones      |
| `contenidos` | Módulos, lecciones y listas de palabras                              |
| `progreso`   | Intentos (UUID generado en el cliente, _upsert_ idempotente) y metas |
| `reportes`   | Avance por estudiante y grupo; exportación CSV                       |

Reglas: ningún módulo importa repositorios de otro; errores en formato _Problem Details_
(RFC 9457) con mensajes en español claro; API versionada en `/v1`; OpenAPI generado con
`@nestjs/swagger` para tipar el cliente web.
