import { Inject, Injectable } from '@nestjs/common';
import { sql } from '../../database/pg';
import type { DB } from '../../database/pg';
import { PG_DB } from '../../database/tokens';
import { CreateUserInput, UpdateUserInput, User } from '../domain/user.entity';
import { UserRepository } from '../domain/user.repository';

function mapRow(row: any): User {
  return {
    id: row.id,
    clerkId: row.clerk_id ?? null,
    nombre: row.nombre,
    email: row.email,
    rolId: row.rol_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class PgUserRepository implements UserRepository {
  constructor(@Inject(PG_DB) private readonly db: DB) {}

  async create(data: CreateUserInput): Promise<User> {
    const q = sql`
      INSERT INTO usuarios (clerk_id, nombre, email, rol_id)
      VALUES (${data.clerkId ?? null}, ${data.nombre}, ${data.email}, ${data.rolId ?? null})
      RETURNING id, clerk_id, nombre, email, rol_id, created_at, updated_at
    `;
    const rows = await this.db.query(q);
    return mapRow(rows[0]);
  }

  async findAll(): Promise<User[]> {
    const q = sql`
      SELECT id, clerk_id, nombre, email, rol_id, created_at, updated_at
      FROM usuarios
      ORDER BY id ASC
    `;
    const rows = await this.db.query(q);
    return rows.map(mapRow);
  }

  async findById(id: number): Promise<User | null> {
    const q = sql`
      SELECT id, clerk_id, nombre, email, rol_id, created_at, updated_at
      FROM usuarios WHERE id = ${id}
    `;
    const rows = await this.db.query(q);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const q = sql`
      SELECT id, clerk_id, nombre, email, rol_id, created_at, updated_at
      FROM usuarios WHERE email = ${email}
    `;
    const rows = await this.db.query(q);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async update(id: number, data: UpdateUserInput): Promise<User> {
    const sets: string[] = [];
    const values: any[] = [];
    // Manual builder to keep typed control
    if (data.clerkId !== undefined) {
      values.push(data.clerkId);
      sets.push(`clerk_id = $${values.length}`);
    }
    if (data.nombre !== undefined) {
      values.push(data.nombre);
      sets.push(`nombre = $${values.length}`);
    }
    if (data.email !== undefined) {
      values.push(data.email);
      sets.push(`email = $${values.length}`);
    }
    if (data.rolId !== undefined) {
      values.push(data.rolId);
      sets.push(`rol_id = $${values.length}`);
    }

    if (sets.length === 0) {
      // No-op update: return current
      const current = await this.findById(id);
      if (!current) throw new Error('Usuario no encontrado');
      return current;
    }

    // Always bump updated_at
    sets.push(`updated_at = CURRENT_TIMESTAMP`);

    const text = `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${values.length + 1} RETURNING id, clerk_id, nombre, email, rol_id, created_at, updated_at`;
    const rows = await this.db.query({ text, values: [...values, id] });
    if (!rows[0]) throw new Error('Usuario no encontrado');
    return mapRow(rows[0]);
  }

  async remove(id: number): Promise<User | null> {
    const q = sql`DELETE FROM usuarios WHERE id = ${id} RETURNING id, clerk_id, nombre, email, rol_id, created_at, updated_at`;
    const rows = await this.db.query(q);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findMany(params: {
    page?: number;
    limit?: number;
    orderBy?: 'id' | 'nombre' | 'email' | 'created_at';
    order?: 'asc' | 'desc';
    search?: string;
    email?: string;
    nombre?: string;
    clerkId?: string;
    rolId?: number;
  }): Promise<{ data: User[]; total?: number; page?: number; limit?: number }> {
    const where: string[] = [];
    const values: any[] = [];

    if (params.email) {
      values.push(params.email);
      where.push(`email = $${values.length}`);
    }
    if (params.nombre) {
      values.push(`%${params.nombre}%`);
      where.push(`nombre ILIKE $${values.length}`);
    }
    if (params.clerkId) {
      values.push(params.clerkId);
      where.push(`clerk_id = $${values.length}`);
    }
    if (typeof params.rolId === 'number') {
      values.push(params.rolId);
      where.push(`rol_id = $${values.length}`);
    }
    if (params.search) {
      // Busca en nombre, email y clerk_id
      values.push(`%${params.search}%`);
      const k = `$${values.length}`;
      where.push(`(nombre ILIKE ${k} OR email ILIKE ${k} OR clerk_id ILIKE ${k})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const orderBy = params.orderBy ?? 'id';
    const order = (params.order ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const hasPagination = typeof params.page === 'number' && params.page > 0;

    if (!hasPagination) {
      const text = `SELECT id, clerk_id, nombre, email, rol_id, created_at, updated_at
                    FROM usuarios ${whereSql}
                    ORDER BY ${orderBy} ${order}`;
      const rows = await this.db.query({ text, values });
      return { data: rows.map(mapRow) };
    }

    const page = params.page!;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 10;
    const offset = (page - 1) * limit;

    const countText = `SELECT COUNT(*)::int AS count FROM usuarios ${whereSql}`;
    const [{ count }] = await this.db.query<{ count: number }>({ text: countText, values });

    const dataText = `SELECT id, clerk_id, nombre, email, rol_id, created_at, updated_at
                      FROM usuarios ${whereSql}
                      ORDER BY ${orderBy} ${order}
                      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const dataRows = await this.db.query({ text: dataText, values: [...values, limit, offset] });
    return { data: dataRows.map(mapRow), total: count, page, limit };
  }
}
