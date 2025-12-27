#!/usr/bin/env bun
/**
 * Shared Database Migration Script (wrapper)
 *
 * Supports:
 *  - apply (default): executes schema.sql against DATABASE_URL or ConnectionStrings__synckit
 *  - --status: checks that required tables are present and exits 0/1
 */

import { join } from 'path';
import { getConnectionString, runMigration, checkSchema } from './migration';

async function main() {
  const args = process.argv.slice(2);
  const statusOnly = args.includes('--status');

  const connectionString = getConnectionString();

  if (statusOnly) {
    console.log('ℹ️  Checking schema status...');
    const ok = await checkSchema({ connectionString });
    if (ok) {
      console.log('✅ Schema validated');
      process.exit(0);
    } else {
      console.error('❌ Schema not found or incomplete');
      process.exit(1);
    }
  }

  await runMigration({ connectionString, schemaPath: join(__dirname, 'schema.sql') });
}

main().catch(err => {
  console.error('❌ Migration runner failed:', err);
  process.exit(1);
});
