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
    username: row.username ?? null,
    email: row.email,
    passwordHash: row.password_hash ?? null,
    firstName: row.first_name,
    lastName: row.last_name,
    rolId: row.rol_id ?? null,
    avatar: row.avatar ?? null,
    coverImage: row.cover_image ?? null,
    bio: row.bio ?? null,
    website: row.website ?? null,
    location: row.location ?? null,
    phone: row.phone ?? null,
    birthDate: row.birth_date ?? null,
    status: row.status ?? 'active',
    isVerified: row.is_verified ?? false,
    onlineStatus: row.online_status ?? 'offline',
    lastLogin: row.last_login ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class PgUserRepository implements UserRepository {
  constructor(@Inject(PG_DB) private readonly db: DB) {}

  async create(data: CreateUserInput): Promise<User> {
    const q = sql`
      INSERT INTO usuarios (
        clerk_id, username, email, password_hash, first_name, last_name, rol_id,
        avatar, cover_image, bio, website, location, phone, birth_date,
        status, is_verified, online_status
      )
      VALUES (
        ${data.clerkId ?? null},
        ${data.username ?? null},
        ${data.email},
        ${data.passwordHash ?? null},
        ${data.firstName},
        ${data.lastName},
        ${data.rolId ?? null},
        ${data.avatar ?? null},
        ${data.coverImage ?? null},
        ${data.bio ?? null},
        ${data.website ?? null},
        ${data.location ?? null},
        ${data.phone ?? null},
        ${data.birthDate ?? null},
        ${data.status ?? 'active'},
        ${data.isVerified ?? false},
        ${data.onlineStatus ?? 'offline'}
      )
      RETURNING *
    `;
    const rows = await this.db.query(q);
    return mapRow(rows[0]);
  }

  async findAll(): Promise<User[]> {
    const q = sql`
      SELECT *
      FROM usuarios
      ORDER BY id ASC
    `;
    const rows = await this.db.query(q);
    return rows.map(mapRow);
  }

  async findById(id: number): Promise<User | null> {
    const q = sql`
      SELECT *
      FROM usuarios WHERE id = ${id}
    `;
    const rows = await this.db.query(q);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const q = sql`
      SELECT *
      FROM usuarios WHERE email = ${email}
    `;
    const rows = await this.db.query(q);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const q = sql`
      SELECT *
      FROM usuarios WHERE username = ${username}
    `;
    const rows = await this.db.query(q);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByClerkId(clerkId: string): Promise<User | null> {
    const q = sql`
      SELECT *
      FROM usuarios WHERE clerk_id = ${clerkId}
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
    if (data.username !== undefined) {
      values.push(data.username);
      sets.push(`username = $${values.length}`);
    }
    if (data.email !== undefined) {
      values.push(data.email);
      sets.push(`email = $${values.length}`);
    }
    if (data.passwordHash !== undefined) {
      values.push(data.passwordHash);
      sets.push(`password_hash = $${values.length}`);
    }
    if (data.firstName !== undefined) {
      values.push(data.firstName);
      sets.push(`first_name = $${values.length}`);
    }
    if (data.lastName !== undefined) {
      values.push(data.lastName);
      sets.push(`last_name = $${values.length}`);
    }
    if (data.rolId !== undefined) {
      values.push(data.rolId);
      sets.push(`rol_id = $${values.length}`);
    }
    if (data.avatar !== undefined) {
      values.push(data.avatar);
      sets.push(`avatar = $${values.length}`);
    }
    if (data.coverImage !== undefined) {
      values.push(data.coverImage);
      sets.push(`cover_image = $${values.length}`);
    }
    if (data.bio !== undefined) {
      values.push(data.bio);
      sets.push(`bio = $${values.length}`);
    }
    if (data.website !== undefined) {
      values.push(data.website);
      sets.push(`website = $${values.length}`);
    }
    if (data.location !== undefined) {
      values.push(data.location);
      sets.push(`location = $${values.length}`);
    }
    if (data.phone !== undefined) {
      values.push(data.phone);
      sets.push(`phone = $${values.length}`);
    }
    if (data.birthDate !== undefined) {
      values.push(data.birthDate);
      sets.push(`birth_date = $${values.length}`);
    }
    if (data.status !== undefined) {
      values.push(data.status);
      sets.push(`status = $${values.length}`);
    }
    if (data.isVerified !== undefined) {
      values.push(data.isVerified);
      sets.push(`is_verified = $${values.length}`);
    }
    if (data.onlineStatus !== undefined) {
      values.push(data.onlineStatus);
      sets.push(`online_status = $${values.length}`);
    }
    if (data.lastLogin !== undefined) {
      values.push(data.lastLogin);
      sets.push(`last_login = $${values.length}`);
    }

    if (sets.length === 0) {
      // No-op update: return current
      const current = await this.findById(id);
      if (!current) throw new Error('Usuario no encontrado');
      return current;
    }

    // Always bump updated_at
    sets.push(`updated_at = CURRENT_TIMESTAMP`);

    const text = `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    const rows = await this.db.query({ text, values: [...values, id] });
    if (!rows[0]) throw new Error('Usuario no encontrado');
    return mapRow(rows[0]);
  }

  async remove(id: number): Promise<User | null> {
    const q = sql`DELETE FROM usuarios WHERE id = ${id} RETURNING *`;
    const rows = await this.db.query(q);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findMany(params: {
    page?: number;
    limit?: number;
    orderBy?: 'id' | 'first_name' | 'last_name' | 'email' | 'username' | 'created_at' | 'status';
    order?: 'asc' | 'desc';
    search?: string;
    email?: string;
    nombre?: string;
    username?: string;
    clerkId?: string;
    rolId?: number;
    status?: 'active' | 'inactive' | 'suspended';
    isVerified?: boolean;
  }): Promise<{ data: User[]; total?: number; page?: number; limit?: number }> {
    const where: string[] = [];
    const values: any[] = [];

    if (params.email) {
      values.push(params.email);
      where.push(`email = $${values.length}`);
    }
    if (params.nombre) {
      values.push(`%${params.nombre}%`);
      where.push(`(first_name ILIKE $${values.length} OR last_name ILIKE $${values.length})`);
    }
    if (params.username) {
      values.push(params.username);
      where.push(`username = $${values.length}`);
    }
    if (params.clerkId) {
      values.push(params.clerkId);
      where.push(`clerk_id = $${values.length}`);
    }
    if (typeof params.rolId === 'number') {
      values.push(params.rolId);
      where.push(`rol_id = $${values.length}`);
    }
    if (params.status) {
      values.push(params.status);
      where.push(`status = $${values.length}`);
    }
    if (typeof params.isVerified === 'boolean') {
      values.push(params.isVerified);
      where.push(`is_verified = $${values.length}`);
    }
    if (params.search) {
      // Busca en nombre, email, username y clerk_id
      values.push(`%${params.search}%`);
      const k = `$${values.length}`;
      where.push(`(first_name ILIKE ${k} OR last_name ILIKE ${k} OR email ILIKE ${k} OR username ILIKE ${k} OR clerk_id ILIKE ${k})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const orderBy = params.orderBy ?? 'id';
    const order = (params.order ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const hasPagination = typeof params.page === 'number' && params.page > 0;

    if (!hasPagination) {
      const text = `SELECT *
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

    const dataText = `SELECT *
                      FROM usuarios ${whereSql}
                      ORDER BY ${orderBy} ${order}
                      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const dataRows = await this.db.query({ text: dataText, values: [...values, limit, offset] });
    return { data: dataRows.map(mapRow), total: count, page, limit };
  }
}
