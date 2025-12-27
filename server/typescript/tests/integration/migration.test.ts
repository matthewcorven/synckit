import { describe, it, expect } from 'bun:test';
import { checkSchema, runMigration, getConnectionString } from '../../src/storage/migration';

describe('migration runner', () => {
  it('checkSchema returns true when all required tables found', async () => {
    const fakePoolFactory = (cs: string) => {
      return {
        query: async (q: string, params?: any[]) => {
          // simulate returning rows for all required tables
          return { rows: [{ table_name: 'documents' }, { table_name: 'vector_clocks' }, { table_name: 'deltas' }, { table_name: 'sessions' }] };
        },
        end: async () => {},
      } as any;
    };

    const ok = await checkSchema({ connectionString: 'fake', poolFactory: fakePoolFactory });
    expect(ok).toBe(true);
  });

  it('checkSchema returns false when some tables are missing', async () => {
    const fakePoolFactory = (cs: string) => {
      return {
        query: async (q: string, params?: any[]) => {
          return { rows: [{ table_name: 'documents' }, { table_name: 'vector_clocks' }] };
        },
        end: async () => {},
      } as any;
    };

    const ok = await checkSchema({ connectionString: 'fake', poolFactory: fakePoolFactory });
    expect(ok).toBe(false);
  });

  it('runMigration executes schema and lists tables', async () => {
    const queries: string[] = [];
    const fakePoolFactory = (cs: string) => {
      return {
        query: async (q: string, params?: any[]) => {
          queries.push(q);
          if (q.includes('SELECT table_name')) {
            return { rows: [{ table_name: 'documents' }, { table_name: 'vector_clocks' }] };
          }
          return { rows: [] };
        },
        end: async () => {},
      } as any;
    };

    await runMigration({ connectionString: 'fake', poolFactory: fakePoolFactory, schemaPath: 'src/storage/schema.sql' });

    // Should have executed schema (large SQL text) and verified tables
    expect(queries.some(q => q.includes('CREATE TABLE'))).toBe(true);
    expect(queries.some(q => q.includes('SELECT table_name'))).toBe(true);
  });
});