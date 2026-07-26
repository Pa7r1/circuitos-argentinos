import bcrypt from 'bcryptjs';
import type { Config } from '../../config.js';
import { unauthorized } from '../../lib/errors.js';

/** Valida las credenciales del admin único contra las variables de entorno. */
export async function verifyAdminCredentials(
  config: Config,
  user: string,
  password: string,
): Promise<void> {
  const userOk = user === config.ADMIN_USER;
  // bcrypt.compare siempre se ejecuta para no filtrar por timing si el usuario existe
  const passwordOk = await bcrypt.compare(password, config.ADMIN_PASSWORD_HASH);
  if (!userOk || !passwordOk) {
    throw unauthorized('Usuario o contraseña incorrectos');
  }
}
