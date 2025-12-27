import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { PostgreSqlContainer } from 'testcontainers';
import { runMigration } from '../../../src/storage/migration';
import { Pool } from 'pg';
import fs from 'fs';
import os from 'os';
import path from 'path';

let container: PostgreSqlContainer | null = null;
let connectionString: string | null = null;
let pool: Pool | null = null;
let dockerUnavailable = false;

beforeAll(async () => {
  try {
    // Start container with a timeout to avoid hanging test runners
    const startPromise = new PostgreSqlContainer('postgres:15')
      .withDatabase('synckit_test')
      .withUsername('synckit')
      .withPassword('synckit_test')
      .start();

    container = await Promise.race([
      startPromise,
      new Promise<PostgreSqlContainer>((_, reject) => setTimeout(() => reject(new Error('Testcontainers start timed out')), 20000))
    ]) as PostgreSqlContainer;

    const host = container.getHost();
    const port = container.getMappedPort(5432);
    connectionString = `postgresql://synckit:synckit_test@${host}:${port}/synckit_test`;

    pool = new Pool({ connectionString });
    await pool.query('SELECT 1');
  } catch (err) {
    // Docker/Testcontainers not available in this environment - mark tests to be skipped
    console.warn('Skipping migration integration tests - docker not available or timed out:', err?.message ?? err);
    dockerUnavailable = true;
  }
});

afterAll(async () => {
  if (pool) await pool.end();
  if (container) await container.stop();
});

function mkTmpMigrations(dirName: string) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), dirName));
  return tmp;
}

async function tableExists(pool: Pool, tableName: string) {
  const res = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [tableName]
  );
  return res.rowCount > 0;
}

describe('shared migration runner (integration)', () => {
  it('applies new migrations and records them in schema_migrations', async () => {
    if (dockerUnavailable) return;

    const migrationsDir = mkTmpMigrations('migrations-');
    const filename = '001_create_test_table.sql';
    const sql = `CREATE TABLE IF NOT EXISTS test_migrations_table (id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());`;
    fs.writeFileSync(path.join(migrationsDir, filename), sql);

    await runMigration({ connectionString: connectionString!, migrationsDir });

    // verify table exists
    const exists = await tableExists(pool!, 'test_migrations_table');
    expect(exists).toBe(true);

    // verify schema_migrations has the filename
    const res = await pool!.query('SELECT filename FROM schema_migrations WHERE filename = $1', [filename]);
    expect(res.rowCount).toBe(1);
  });

  it('skips already-applied migrations on subsequent runs', async () => {
    if (dockerUnavailable) return;

    const migrationsDir = mkTmpMigrations('migrations-');
    const filename = '001_create_test_table.sql';
    const sql = `CREATE TABLE IF NOT EXISTS test_migrations_table2 (id SERIAL PRIMARY KEY);`;
    fs.writeFileSync(path.join(migrationsDir, filename), sql);

    // First run - should apply
    await runMigration({ connectionString: connectionString!, migrationsDir });

    // Second run - should not attempt to reapply (no exception should be thrown)
    await runMigration({ connectionString: connectionString!, migrationsDir });

    const res = await pool!.query('SELECT filename FROM schema_migrations WHERE filename = $1', [filename]);
    expect(res.rowCount).toBe(1);
  });

  it('rolls back failed migrations and leaves no partial changes', async () => {
    if (dockerUnavailable) return;

    const migrationsDir = mkTmpMigrations('migrations-');
    const filename = '002_bad_migration.sql';

    // This migration will create a table and then cause an error when inserting into a non-existent table
    const sql = `CREATE TABLE bad_table (id INT); INSERT INTO non_existent_table (id) VALUES (1);`;
    fs.writeFileSync(path.join(migrationsDir, filename), sql);

    let threw = false;
    try {
      await runMigration({ connectionString: connectionString!, migrationsDir });
    } catch (err) {
      threw = true;
    }

    expect(threw).toBe(true);

    // Verify that bad_table does not exist (rolled back)
    const exists = await tableExists(pool!, 'bad_table');
    expect(exists).toBe(false);

    const res = await pool!.query('SELECT filename FROM schema_migrations WHERE filename = $1', [filename]);
    expect(res.rowCount).toBe(0);
  });
});