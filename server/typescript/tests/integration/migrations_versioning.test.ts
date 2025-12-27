import { describe, it, expect } from 'bun:test';
import { runMigration } from '../../src/storage/migration';

describe('versioned migrations', () => {
  it('creates schema_migrations table and applies unapplied migrations', async () => {
    const queries: string[] = [];
    const fakePoolFactory = (cs: string) => ({
      query: async (q: string, params?: any[]) => {
        queries.push(q);
        if (q.includes('SELECT filename FROM schema_migrations')) {
          return { rows: [] }; // none applied
        }
        if (q.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return { rows: [] };
        }
        if (q.trim().startsWith('BEGIN') || q.trim().startsWith('COMMIT') || q.trim().startsWith('ROLLBACK')) {
          return { rows: [] };
        }
        if (q.includes('INSERT INTO schema_migrations')) {
          return { rows: [] };
        }
        // For table listing
        if (q.includes('FROM information_schema.tables')) {
          return { rows: [{ table_name: 'documents' }, { table_name: 'vector_clocks' }] };
        }
        // Simulate executing migration SQL
        return { rows: [] };
      },
      end: async () => {},
    } as any);

    await runMigration({ connectionString: 'fake', poolFactory: fakePoolFactory, migrationsDir: 'src/storage/migrations' });

    // Expect schema_migrations creation and at least one migration applied and recorded
    expect(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS schema_migrations'))).toBe(true);
    expect(queries.some(q => q.includes('INSERT INTO schema_migrations'))).toBe(true);
  });

  it('does not reapply migrations when already applied', async () => {
    const queries: string[] = [];
    const fakePoolFactory = (cs: string) => ({
      query: async (q: string, params?: any[]) => {
        queries.push(q);
        if (q.includes('SELECT filename FROM schema_migrations')) {
          return { rows: [{ filename: '001_initial_schema.sql' }] };
        }
        if (q.includes('FROM information_schema.tables')) {
          return { rows: [{ table_name: 'documents' }] };
        }
        return { rows: [] };
      },
      end: async () => {},
    } as any);

    await runMigration({ connectionString: 'fake', poolFactory: fakePoolFactory, migrationsDir: 'src/storage/migrations' });

    // Should not call INSERT into schema_migrations (no new migrations applied)
    expect(queries.some(q => q.includes('INSERT INTO schema_migrations'))).toBe(false);
  });
});