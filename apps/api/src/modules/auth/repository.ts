import { sql } from 'drizzle-orm';
import type { AuthUser } from '@circuitos/shared';
import type { Db } from '../../db/index.js';

export interface UserRow extends AuthUser {
  passwordHash: string | null;
}

interface RawUser {
  id: string;
  name: string;
  email: string;
  role: AuthUser['role'];
  discipline: string | null;
  password_hash: string | null;
}

const toUser = (r: RawUser): UserRow => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  discipline: r.discipline,
  passwordHash: r.password_hash,
});

const SELECT_USER = sql`
  SELECT u.id, u.name, u.email, u.role, u.password_hash, d.slug AS discipline
  FROM users u
  LEFT JOIN disciplines d ON d.id = u.discipline_id
`;

export function authRepository(db: Db) {
  return {
    async findByEmail(email: string): Promise<UserRow | null> {
      const rows = (await db.execute(
        sql`${SELECT_USER} WHERE u.email = ${email}`,
      )) as unknown as RawUser[];
      return rows[0] ? toUser(rows[0]) : null;
    },

    async findById(id: string): Promise<UserRow | null> {
      const rows = (await db.execute(
        sql`${SELECT_USER} WHERE u.id = ${id}`,
      )) as unknown as RawUser[];
      return rows[0] ? toUser(rows[0]) : null;
    },

    async create(data: {
      name: string;
      email: string;
      passwordHash: string;
      disciplineSlug?: string;
    }): Promise<UserRow> {
      const rows = (await db.execute(sql`
        INSERT INTO users (name, email, password_hash, discipline_id, terms_accepted_at)
        VALUES (
          ${data.name}, ${data.email}, ${data.passwordHash},
          -- si el slug es null la subconsulta no devuelve filas y queda NULL
          (SELECT id FROM disciplines WHERE slug = ${data.disciplineSlug ?? null}),
          -- la ruta de registro no deja crear una cuenta sin aceptarlos
          now()
        )
        RETURNING id
      `)) as unknown as { id: string }[];
      const created = await this.findById(rows[0]!.id);
      return created!;
    },

    /**
     * Deja pedido un cambio de contraseña. Se guarda el hash del token, no el
     * token, y siempre pisa el anterior: pedir uno nuevo invalida el viejo.
     *
     * El vencimiento lo pone la base (`now() + 1 hour`) y no JavaScript: el driver
     * `postgres` no acepta un `Date` como parámetro, y de paso el reloj que cuenta
     * es el mismo que después compara.
     */
    async setResetToken(userId: string, tokenHash: string): Promise<void> {
      await db.execute(sql`
        UPDATE users
        SET reset_token_hash = ${tokenHash}, reset_expires_at = now() + interval '1 hour'
        WHERE id = ${userId}
      `);
    },

    /** Cuenta con un pedido de cambio vigente para ese hash. Null si venció o no existe. */
    async findByResetTokenHash(tokenHash: string): Promise<{ id: string } | null> {
      const rows = (await db.execute(sql`
        SELECT id FROM users
        WHERE reset_token_hash = ${tokenHash} AND reset_expires_at > now()
      `)) as unknown as { id: string }[];
      return rows[0] ?? null;
    },

    /** Cambia la contraseña y consume el token en la misma sentencia. */
    async updatePassword(userId: string, passwordHash: string): Promise<void> {
      await db.execute(sql`
        UPDATE users
        SET password_hash = ${passwordHash}, reset_token_hash = NULL, reset_expires_at = NULL
        WHERE id = ${userId}
      `);
    },

    /**
     * Borra la cuenta y, con ella, el teléfono que haya dejado al proponer.
     *
     * El circuito propuesto sobrevive —`created_by` queda en null por la clave
     * foránea—, pero el teléfono es un dato personal y la política de privacidad
     * promete eliminarlo. Va en la misma transacción: media baja no es una baja.
     */
    async deleteById(userId: string): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.execute(sql`UPDATE circuits SET contact_phone = NULL WHERE created_by = ${userId}`);
        await tx.execute(sql`DELETE FROM users WHERE id = ${userId}`);
      });
    },

    /**
     * Solo el rol, para autorizar. Va aparte de `findById` porque corre en cada
     * pedido del panel: lee una columna por clave primaria y no arrastra el hash
     * de la contraseña ni el join con disciplinas.
     */
    async roleById(id: string): Promise<AuthUser['role'] | null> {
      const rows = (await db.execute(
        sql`SELECT role FROM users WHERE id = ${id}`,
      )) as unknown as { role: AuthUser['role'] }[];
      return rows[0]?.role ?? null;
    },

    async countUsers(): Promise<number> {
      const rows = (await db.execute(
        sql`SELECT count(*)::int AS total FROM users`,
      )) as unknown as { total: number }[];
      return rows[0]?.total ?? 0;
    },
  };
}

export type AuthRepository = ReturnType<typeof authRepository>;
