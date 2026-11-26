import { DatabaseSync } from 'node:sqlite';
import { MobileDatabase, type SqlReader } from '../src/data/sqlite/MobileDatabase.ts';

export function sqlite() {
  const db = new DatabaseSync(':memory:');
  const statements: string[] = [];
  function prepare(query: string) { statements.push(query); return db.prepare(query); }
  const connection: SqlReader = {
    async execAsync(query) { db.exec(query); },
    async runAsync(query, ...args) { prepare(query).run(...args); },
    async getAllAsync<T>(query: string, ...args: (string | number | null)[]) { return prepare(query).all(...args) as T[]; },
    async getFirstAsync<T>(query: string, ...args: (string | number | null)[]) { return prepare(query).get(...args) as T ?? null; },
  };
  const store = new MobileDatabase(connection, async work => {
    db.exec('BEGIN IMMEDIATE');
    try { await work(connection); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  return { db, store, statements };
}
