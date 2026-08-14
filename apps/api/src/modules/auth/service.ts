import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { AuthUser, RegisterRequest } from '@circuitos/shared';
import type { Config } from '../../config.js';
import { DomainError, badRequest, unauthorized } from '../../lib/errors.js';
import type { AuthRepository } from './repository.js';

/** Hash de descarte: iguala el tiempo de respuesta cuando el email no existe. */
const HASH_FANTASMA = '$2b$12$' + 'x'.repeat(53);

/**
 * SHA-256 y no bcrypt: el token ya son 32 bytes al azar, así que no hay nada que
 * adivinar por fuerza bruta y el hash solo tiene que evitar que sirva leído de la
 * base. Bcrypt acá sería lento sin comprar nada.
 */
const hashDeToken = (token: string) => createHash('sha256').update(token).digest('hex');

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

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Nunca devolver el hash al cliente: se arma el perfil campo por campo. */
const perfil = (u: { id: string; name: string; email: string; role: AuthUser['role']; discipline: string | null }): AuthUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  discipline: u.discipline,
});

export function authService(repo: AuthRepository) {
  return {
    async register(input: RegisterRequest): Promise<AuthUser> {
      const email = normalizeEmail(input.email);
      if (await repo.findByEmail(email)) {
        /*
         * El mensaje no nombra la causa a propósito. "Ya existe una cuenta con
         * ese email" convierte al registro en un oráculo: con una lista de
         * direcciones filtrada de otro sitio se arma el padrón de quién usa la
         * app. El login ya se cuida de eso (mensaje genérico y hash fantasma
         * para igualar los tiempos) y el registro lo tiraba abajo.
         */
        throw new DomainError(
          409,
          'REGISTRO_RECHAZADO',
          'No pudimos crear la cuenta con esos datos. Si ya tenés una, ingresá.',
        );
      }
      const user = await repo.create({
        name: input.name.trim(),
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
        disciplineSlug: input.discipline,
      });
      return perfil(user);
    },

    async login(email: string, password: string): Promise<AuthUser> {
      const user = await repo.findByEmail(normalizeEmail(email));
      // se compara siempre, exista o no la cuenta, para no revelar qué emails hay
      const ok = await bcrypt.compare(password, user?.passwordHash ?? HASH_FANTASMA);
      if (!user || !ok) throw unauthorized('Email o contraseña incorrectos');
      return perfil(user);
    },

    /**
     * Arranca la recuperación. Devuelve el token en claro para que la ruta lo
     * mande por correo, o null si no hay cuenta con ese email: quien llama
     * responde lo mismo en los dos casos, si no el endpoint sería un oráculo
     * para averiguar quién está registrado.
     */
    async startPasswordReset(email: string): Promise<{ token: string; name: string } | null> {
      const user = await repo.findByEmail(normalizeEmail(email));
      if (!user) return null;

      const token = randomBytes(32).toString('base64url');
      await repo.setResetToken(user.id, hashDeToken(token));
      return { token, name: user.name };
    },

    /** Consume el token y deja la contraseña nueva. */
    async finishPasswordReset(token: string, password: string): Promise<void> {
      const user = await repo.findByResetTokenHash(hashDeToken(token));
      if (!user) {
        throw badRequest('TOKEN_INVALIDO', 'El enlace no sirve o venció. Pedí uno nuevo.');
      }
      await repo.updatePassword(user.id, await bcrypt.hash(password, 12));
    },

    /** Borra la cuenta. Los circuitos que haya cargado no se tocan: created_by no tiene FK. */
    async deleteAccount(id: string): Promise<void> {
      await repo.deleteById(id);
    },

    async profile(id: string): Promise<AuthUser> {
      const user = await repo.findById(id);
      if (!user) throw unauthorized('La cuenta ya no existe');
      return perfil(user);
    },

    /** Rol vigente en la base. `null` si la cuenta ya no existe. */
    roleOf(id: string): Promise<AuthUser['role'] | null> {
      return repo.roleById(id);
    },

    countUsers(): Promise<number> {
      return repo.countUsers();
    },
  };
}

export type AuthService = ReturnType<typeof authService>;
