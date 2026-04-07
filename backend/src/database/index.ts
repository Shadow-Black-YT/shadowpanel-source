import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

let pool: Pool;
export const getPool = () => pool;

export async function initDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || 'shadow'}:${process.env.POSTGRES_PASSWORD || ''}@${process.env.POSTGRES_HOST || 'postgres'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'shadowpanel'}`;
  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => logger.error('DB pool error:', err));
  await pool.query('SELECT 1');
  await runMigrations();
  logger.info('Database connected');
}

async function runMigrations(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, ran_at TIMESTAMPTZ DEFAULT NOW())`);
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const ran = await pool.query('SELECT 1 FROM migrations WHERE name=$1', [file]);
    if (ran.rows.length) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    await pool.query(sql);
    await pool.query('INSERT INTO migrations(name) VALUES($1)', [file]);
    logger.info('Migration ran: ' + file);
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const { rows } = await pool.query(text, params);
  return (rows[0] as T) || null;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
