import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config.js';

/**
 * Envío de correo por HTTP contra Resend.
 *
 * Sin SDK a propósito: es un POST con un JSON, y el paquete oficial traería una
 * dependencia entera para armarlo. El bundle de producción es un archivo único
 * sin node_modules, así que cada dependencia que se evita es peso que no viaja.
 *
 * Si no hay `RESEND_API_KEY` no falla: escribe el correo en el log. Eso es lo que
 * permite probar el flujo completo de recuperar contraseña en desarrollo sin dar
 * de alta ninguna cuenta.
 */
export async function enviarEmail(
  config: Config,
  log: FastifyBaseLogger,
  destino: string,
  asunto: string,
  cuerpo: string,
): Promise<void> {
  if (!config.RESEND_API_KEY) {
    log.warn({ destino, asunto, cuerpo }, 'sin RESEND_API_KEY: el correo va al log');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: config.EMAIL_FROM,
      to: destino,
      subject: asunto,
      text: cuerpo,
    }),
  });

  if (!res.ok) {
    /*
     * Se registra y no se propaga: quien pidió recuperar la contraseña recibe la
     * misma respuesta siempre, exista o no la cuenta, y un 500 acá delataría que
     * el email sí estaba registrado.
     */
    log.error({ status: res.status, detalle: await res.text() }, 'no se pudo enviar el correo');
  }
}
