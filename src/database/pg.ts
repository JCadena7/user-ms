import { Pool, PoolClient, QueryResult } from 'pg';
import { envs } from '../config';

// ---------- Types ----------
export type SQLQuery = { text: string; values: any[] };
export type QueryInput = string | SQLQuery;
export type IsolationLevel = 'read committed' | 'repeatable read' | 'serializable';

export interface Tx {
  query<T = any>(q: QueryInput, params?: any[]): Promise<T[]>;
  sql: typeof sql;
}

// ---------- Pool Singleton ----------
let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: envs.cadenaConexion });
  }
  return _pool;
}

// ---------- SQL tagged template (auto-parameterized) ----------
export function sql(strings: TemplateStringsArray, ...values: any[]): SQLQuery {
  let text = '';
  const params: any[] = [];
  strings.forEach((chunk, i) => {
    text += chunk;
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  });
  // Compact excessive whitespace/newlines for cleaner logging
  text = text.replace(/\n\s+/g, ' ').trim();
  return { text, values: params };
}

// ---------- Basic query helper ----------
export async function query<T = any>(q: QueryInput, params?: any[], client?: PoolClient): Promise<T[]> {
  const pool = getPool();
  const runner = client ?? pool;
  let res: QueryResult<T>;
  if (typeof q === 'string') {
    res = await runner.query(q, params);
  } else {
    res = await runner.query(q.text, q.values);
  }
  return res.rows;
}

// ---------- $transaction helper (array or callback) ----------
// Overloads to provide precise return types
export async function $transaction<T = any>(
  fn: (tx: Tx) => Promise<T>,
  options?: { isolationLevel?: IsolationLevel },
): Promise<T>;
export async function $transaction(
  fnOrQueries: SQLQuery[],
  options?: { isolationLevel?: IsolationLevel },
): Promise<any[]>;
export async function $transaction<T = any>(
  fnOrQueries: ((tx: Tx) => Promise<T>) | SQLQuery[],
  options?: { isolationLevel?: IsolationLevel },
): Promise<T | any[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (options?.isolationLevel) {
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel.toUpperCase()}`);
    }

    if (Array.isArray(fnOrQueries)) {
      const results: any[] = [];
      for (const q of fnOrQueries) {
        const r = await client.query(q.text, q.values);
        results.push(r.rows);
      }
      await client.query('COMMIT');
      return results;
    } else {
      const tx: Tx = {
        query: (q, params) => query(q as any, params, client),
        sql,
      };
      const out = await fnOrQueries(tx);
      await client.query('COMMIT');
      return out;
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------- High-level facade (Prisma-like) ----------
export const db = Object.freeze({
  get pool() {
    return getPool();
  },
  query,
  sql,
  $transaction,
  async $disconnect() {
    if (_pool) {
      await _pool.end();
      _pool = null;
    }
  },
});

export default db;
export type DB = typeof db;
