import 'dotenv/config';
import pg from 'pg';

// numeric -> JS number (prices fit safely in a double)
pg.types.setTypeParser(1700, (v) => parseFloat(v));

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://miftah:miftah@localhost:5432/miftah' });

export type Db = pg.Pool | pg.PoolClient;

export async function q<T = any>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const r = await db.query(sql, params);
  return r.rows as T[];
}
export async function one<T = any>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T | undefined> {
  return (await q<T>(sql, params, db))[0];
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
