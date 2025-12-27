import { readFileSync } from 'fs';
import { join } from 'path';
import type { Pool } from 'pg';

export type PoolFactory = (connectionString: string) => Pool;

export function getConnectionString(): string {
  return (
    process.env.DATABASE_URL ||
    // Aspire / .NET style injected conn string
    process.env.ConnectionStrings__synckit ||
    'postgresql://localhost:5432/synckit'
  );
}

export async function runMigration(opts: {
  connectionString?: string;
  schemaPath?: string;
  migrationsDir?: string;
  poolFactory?: PoolFactory;
}): Promise<void> {
  const connectionString = opts.connectionString ?? getConnectionString();
  const migrationsDir = opts.migrationsDir ?? join(__dirname, 'migrations');
  const poolFactory = opts.poolFactory ?? ((cs: string) => new (require('pg').Pool)({ connectionString: cs }));

  console.log('🔄 Starting shared database migration...');
  console.log(`📍 Database: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  const pool = poolFactory(connectionString);

  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Ensure schema_migrations table exists
    console.log('⚙️  Ensuring schema_migrations table exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64)
      );
    `);
    console.log('✅ schema_migrations ready');

    // Load available migration files
    const files = require('fs').readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    // Query applied migrations
    const appliedRes = await pool.query(`SELECT filename FROM schema_migrations`);
    const applied = new Set(appliedRes.rows.map((r: any) => r.filename));

    const unapplied = files.filter((f: string) => !applied.has(f));

    if (unapplied.length === 0) {
      console.log('ℹ️  No new migrations to apply');
    } else {
      console.log(`⚙️  Applying ${unapplied.length} migrations`);
      for (const filename of unapplied) {
        const path = join(migrationsDir, filename);
        console.log(`➡️ Applying: ${filename}`);
        const sql = readFileSync(path, 'utf-8');
        // Execute migration in a transaction
        await pool.query('BEGIN');
        try {
          await pool.query(sql);
          await pool.query(`INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)`, [filename, null]);
          await pool.query('COMMIT');
          console.log(`✅ Applied: ${filename}`);
        } catch (err) {
          await pool.query('ROLLBACK');
          throw err;
        }
      }
    }

    // Verify tables (same as before)
    console.log('🔍 Verifying tables...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('✅ Tables available:');
    result.rows.forEach((row: any) => console.log(`   - ${row.table_name}`));

    console.log('\n🎉 Migration completed - schema ready for both TS and C# servers!');
  } finally {
    await pool.end();
  }
}

export async function checkSchema(opts: {
  connectionString?: string;
  requiredTables?: string[];
  poolFactory?: PoolFactory;
}): Promise<boolean> {
  const connectionString = opts.connectionString ?? getConnectionString();
  const poolFactory = opts.poolFactory ?? ((cs: string) => new (require('pg').Pool)({ connectionString: cs }));
  const requiredTables = opts.requiredTables ?? ['documents', 'vector_clocks', 'deltas', 'sessions'];

  const pool = poolFactory(connectionString);
  try {
    await pool.query('SELECT NOW()');

    const placeholders = requiredTables.map((_, i) => `$${i + 1}`).join(',');
    const q = `
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (${placeholders})
    `;

    const res = await pool.query(q, requiredTables);
    const found = new Set(res.rows.map((r: any) => r.table_name));

    return requiredTables.every(t => found.has(t));
  } finally {
    await pool.end();
  }
}
