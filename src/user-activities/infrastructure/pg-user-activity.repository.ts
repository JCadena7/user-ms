import { Inject, Injectable } from '@nestjs/common';
import { sql } from '../../database/pg';
import type { DB } from '../../database/pg';
import { PG_DB } from '../../database/tokens';
import { CreateUserActivityInput, FindUserActivitiesParams, UserActivity } from '../domain/user-activity.entity';
import { UserActivityRepository } from '../domain/user-activity.repository';

function mapRow(row: any): UserActivity {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    description: row.description,
    target: row.target ?? null,
    content: row.content ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
  };
}

@Injectable()
export class PgUserActivityRepository implements UserActivityRepository {
  constructor(@Inject(PG_DB) private readonly db: DB) {}

  async create(data: CreateUserActivityInput): Promise<UserActivity> {
    const q = sql`
      INSERT INTO user_activities (
        user_id, type, description, target, content, metadata
      )
      VALUES (
        ${data.userId},
        ${data.type},
        ${data.description},
        ${data.target ?? null},
        ${data.content ?? null},
        ${data.metadata ? JSON.stringify(data.metadata) : null}
      )
      RETURNING *
    `;
    const rows = await this.db.query(q);
    return mapRow(rows[0]);
  }

  async findById(id: string): Promise<UserActivity | null> {
    const q = sql`
      SELECT *
      FROM user_activities
      WHERE id = ${id}
    `;
    const rows = await this.db.query(q);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByUserId(
    userId: number,
    params?: FindUserActivitiesParams
  ): Promise<{ data: UserActivity[]; total?: number; page?: number; limit?: number }> {
    return this.findMany({ ...params, userId });
  }

  async findMany(
    params: FindUserActivitiesParams
  ): Promise<{ data: UserActivity[]; total?: number; page?: number; limit?: number }> {
    const where: string[] = [];
    const values: any[] = [];

    if (params.userId) {
      values.push(params.userId);
      where.push(`user_id = $${values.length}`);
    }

    if (params.type) {
      values.push(params.type);
      where.push(`type = $${values.length}`);
    }

    if (params.startDate) {
      values.push(params.startDate);
      where.push(`created_at >= $${values.length}`);
    }

    if (params.endDate) {
      values.push(params.endDate);
      where.push(`created_at <= $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const hasPagination = typeof params.page === 'number' && params.page > 0;

    if (!hasPagination) {
      const text = `SELECT *
                    FROM user_activities ${whereSql}
                    ORDER BY created_at DESC`;
      const rows = await this.db.query({ text, values });
      return { data: rows.map(mapRow) };
    }

    const page = params.page!;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const countText = `SELECT COUNT(*)::int as count FROM user_activities ${whereSql}`;
    const [{ count }] = await this.db.query<{ count: number }>({ text: countText, values });

    const dataText = `SELECT *
                      FROM user_activities ${whereSql}
                      ORDER BY created_at DESC
                      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const dataRows = await this.db.query({ text: dataText, values: [...values, limit, offset] });
    return { data: dataRows.map(mapRow), total: count, page, limit };
  }

  async deleteById(id: string): Promise<boolean> {
    const q = sql`DELETE FROM user_activities WHERE id = ${id}`;
    const result = await this.db.query(q);
    return result.length > 0;
  }

  async deleteByUserId(userId: number): Promise<number> {
    const q = sql`DELETE FROM user_activities WHERE user_id = ${userId}`;
    const result = await this.db.query(q);
    return result.length;
  }
}
