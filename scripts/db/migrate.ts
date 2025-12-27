#!/usr/bin/env bun
import { runMigration } from '../../server/typescript/src/storage/migration';

// Simple wrapper that delegates to the canonical TypeScript migration.
// This file exists so orchestration tooling has a consistent top-level location.

runMigration({ connectionString: process.env.DATABASE_URL }).catch(err => {
  console.error('Migration wrapper failed:', err);
  process.exit(1);
});
