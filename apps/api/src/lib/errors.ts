import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

/** Error de dominio: seguro para mostrar al cliente. */
export class DomainError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const badRequest = (code: string, message: string) => new DomainError(400, code, message);
export const unauthorized = (message = 'No autorizado') =>
  new DomainError(401, 'NO_AUTORIZADO', message);
export const notFound = (message = 'Recurso no encontrado') =>
  new DomainError(404, 'NO_ENCONTRADO', message);
/** El pedido es válido pero choca con el estado actual del recurso (duplicado, orden de pasos). */
export const conflict = (code: string, message: string) => new DomainError(409, code, message);

/** Handler central: errores de dominio y de validación al cliente; el resto, 500 genérico. */
export function errorHandler(
  error: FastifyError | DomainError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof DomainError) {
    void reply
      .status(error.statusCode)
      .send({ statusCode: error.statusCode, code: error.code, message: error.message });
    return;
  }

  if (hasZodFastifySchemaValidationErrors(error)) {
    const detail = error.validation
      .map((v) => `${v.instancePath || 'body'}: ${v.message}`)
      .join('; ');
    void reply
      .status(400)
      .send({ statusCode: 400, code: 'VALIDACION', message: `Entrada inválida: ${detail}` });
    return;
  }

  // errores con statusCode de plugins de fastify (rate-limit 429, jwt 401, multipart 413...)
  const statusCode = 'statusCode' in error && error.statusCode ? error.statusCode : 500;
  if (statusCode < 500) {
    void reply
      .status(statusCode)
      .send({ statusCode, code: error.code ?? 'ERROR', message: error.message });
    return;
  }

  // nunca filtrar detalles internos al cliente
  request.log.error({ err: error }, 'error no manejado');
  void reply
    .status(500)
    .send({ statusCode: 500, code: 'ERROR_INTERNO', message: 'Error interno del servidor' });
}
