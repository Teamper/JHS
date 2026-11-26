import { normalizeMovieCarNum, throwIfAborted } from '@jhs/core';
import { flagBits, pageSize, recordMovie, type LibraryQuery } from '../models/movie.ts';
import { initialSchema, searchSchema } from './schema.ts';

type Bind = string | number | null;
export interface SqlReader {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...args: Bind[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...args: Bind[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...args: Bind[]): Promise<T | null>;
}

type Transaction = (work: (connection: SqlReader) => Promise<void>) => Promise<void>;
type Entry = { exists: boolean; value?: unknown };
export type Batch = { puts: Record<string, unknown>; deletes?: string[]; signal?: AbortSignal };
type WorkRow = { position: number; value: string };
type WorkRecord = Record<string, unknown>;

const worksKey = 'car_list';

function serializeWork(value: unknown) {
  const record = (value && typeof value === 'object' ? value : {}) as WorkRecord;
  const movie = recordMovie(record, 0);
  const fields = [record.carNum, record.names, record.title, record.actorNames, record.remark];
  const flags = Object.entries(movie.stateFlags ?? {}).reduce((mask, [key, on]) => on ? mask | flagBits[key as keyof typeof flagBits] : mask, 0);
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('片库记录需要使用 JSON 数据。');
  const modified = Date.parse(String(record.updateDate ?? ''));
  return [serialized, movie.carNum, movie.carNum?.replace(/\d+/g, digits => digits.padStart(24, '0')) ?? null,
    fields.map(field => String(field ?? '').toLowerCase()).join('\u001f'), Number.isFinite(modified) ? modified : null,
    movie.releaseDate ?? null, flags] as const;
}

export class MobileDatabase {
  private writes: Promise<unknown> = Promise.resolve();
  private initialization: Promise<void> | undefined;
  private hasSearchIndex = false;
  private readonly db: SqlReader;
  private readonly transaction: Transaction;
  private readonly allowMissingFts: boolean;

  constructor(db: SqlReader, transaction: Transaction, allowMissingFts = false) {
    this.db = db;
    this.transaction = transaction;
    this.allowMissingFts = allowMissingFts;
  }

  initialize() {
    this.initialization ??= this.write(async connection => {
      const version = (await connection.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version;
      if (version > 2 || version < 0) throw new Error('片库来自较新的 JHS，请更新应用后打开。');
      if (version === 0) await connection.execAsync(initialSchema);
      const fts = await connection.getFirstAsync<{ name: string }>("SELECT name FROM pragma_module_list WHERE name = 'fts5'");
      if (fts) {
        const index = await connection.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'works_fts'");
        if (!index) await connection.execAsync(searchSchema);
        this.hasSearchIndex = true;
      } else if (!this.allowMissingFts) {
        throw new Error('当前 SQLite 缺少片库全文检索模块。');
      }
      if (version < 2) await connection.execAsync('PRAGMA user_version = 2');
    });
    return this.initialization;
  }

  private write(work: (connection: SqlReader) => Promise<void>) {
    const result = this.writes.then(() => this.transaction(work));
    this.writes = result.catch(() => undefined);
    return result;
  }

  private async entry(connection: SqlReader, key: string): Promise<Entry> {
    const row = await connection.getFirstAsync<{ value: string }>('SELECT value FROM jhs_values WHERE key = ?', key);
    if (!row) return { exists: false };
    if (key !== worksKey) return { exists: true, value: JSON.parse(row.value) };
    const works = await connection.getAllAsync<WorkRow>('SELECT value FROM works ORDER BY position');
    return { exists: true, value: works.map(work => JSON.parse(work.value)) };
  }

  async getItem(key: string) {
    await this.writes;
    return (await this.entry(this.db, key)).value ?? null;
  }

  async keys() {
    await this.writes;
    return (await this.db.getAllAsync<{ key: string }>('SELECT key FROM jhs_values ORDER BY key')).map(row => row.key);
  }

  async setItem(key: string, value: unknown) {
    await this.commitLockedBatch({ puts: { [key]: value } });
    return value;
  }

  async removeItem(key: string) { await this.commitLockedBatch({ puts: {}, deletes: [key] }); }

  async getWorkByCarNum(carNum: string) {
    await this.writes;
    const row = await this.db.getFirstAsync<WorkRow>('SELECT value FROM works WHERE number = ? ORDER BY position DESC LIMIT 1', normalizeMovieCarNum(carNum));
    return row ? JSON.parse(row.value) as WorkRecord : null;
  }

  async getWorksByCarNums(carNums: readonly string[]) {
    if (!carNums.length) return [];
    await this.writes;
    const rows = await this.db.getAllAsync<WorkRow>('SELECT value FROM works WHERE number IN (SELECT value FROM json_each(?)) ORDER BY position',
      JSON.stringify(carNums));
    return rows.map(row => JSON.parse(row.value) as WorkRecord);
  }

  async patchWorks(upserts: readonly WorkRecord[], deletes: readonly string[], batch: Batch = { puts: {} }) {
    if (Object.hasOwn(batch.puts, worksKey) || batch.deletes?.includes(worksKey)) {
      throw new TypeError('片库行更新与全量替换需要使用独立事务。');
    }
    await this.write(async connection => {
      throwIfAborted(batch.signal);
      for (const number of deletes) await connection.runAsync('DELETE FROM works WHERE number = ?', number);
      for (const record of upserts) {
        const fields = serializeWork(record);
        const number = fields[1];
        if (number === null) throw new TypeError('作品番号无效。');
        const existing = await connection.getFirstAsync<{ position: number }>('SELECT position FROM works WHERE number = ? ORDER BY position LIMIT 1', number);
        if (existing) {
          await connection.runAsync(`UPDATE works SET value = ?, number = ?, sortNumber = ?, search = ?, modified = ?, released = ?, flags = ?
            WHERE position = ? AND value <> ?`, ...fields, existing.position, fields[0]);
          await connection.runAsync('DELETE FROM works WHERE number = ? AND position <> ?', number, existing.position);
        } else {
          await connection.runAsync(`INSERT INTO works(position, value, number, sortNumber, search, modified, released, flags)
            VALUES ((SELECT coalesce(max(position), -1) + 1 FROM works), ?, ?, ?, ?, ?, ?, ?)`, ...fields);
        }
      }
      if (upserts.length) await connection.runAsync("INSERT OR IGNORE INTO jhs_values(key, value) VALUES (?, '[]')", worksKey);
      await this.commit(connection, batch);
    });
    return true;
  }

  private async commit(connection: SqlReader, batch: Batch) {
    throwIfAborted(batch.signal);
    for (const key of batch.deletes ?? []) {
      if (key === worksKey) await connection.runAsync('DELETE FROM works');
      await connection.runAsync('DELETE FROM jhs_values WHERE key = ?', key);
    }
    for (const [key, value] of Object.entries(batch.puts)) {
      if (key === worksKey) {
        if (!Array.isArray(value)) throw new TypeError('作品库需要使用数组格式。');
        const rows = JSON.stringify(value.map(serializeWork));
        await connection.runAsync(`
          INSERT INTO works(position, value, number, sortNumber, search, modified, released, flags)
          SELECT key, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
            json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'), json_extract(value, '$[6]')
          FROM json_each(?) WHERE true
          ON CONFLICT(position) DO UPDATE SET value = excluded.value, number = excluded.number,
            sortNumber = excluded.sortNumber, search = excluded.search, modified = excluded.modified,
            released = excluded.released, flags = excluded.flags WHERE works.value <> excluded.value`, rows);
        await connection.runAsync('DELETE FROM works WHERE position >= ?', value.length);
      }
      const json = JSON.stringify(key === worksKey ? [] : value);
      if (json === undefined) throw new TypeError('本地存储需要使用 JSON 数据。');
      await connection.runAsync(`INSERT INTO jhs_values(key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, json);
    }
    throwIfAborted(batch.signal);
  }

  async commitLockedBatch(batch: Batch) {
    await this.write(connection => this.commit(connection, batch));
    return true;
  }

  async readAtomicSnapshot(keys: string[]) {
    let entries: Record<string, Entry> = {};
    await this.write(async connection => {
      entries = Object.fromEntries(await Promise.all(keys.map(async key => [key, await this.entry(connection, key)])));
    });
    return entries;
  }

  async commitAtomicBatch(batch: Batch & { expected: Record<string, Entry> }) {
    await this.write(async connection => {
      for (const [key, expected] of Object.entries(batch.expected)) {
        const actual = await this.entry(connection, key);
        if (actual.exists !== expected.exists || JSON.stringify(actual.value) !== JSON.stringify(expected.value)) {
          throw new Error('片库已更新，请重新读取后再导入。');
        }
      }
      await this.commit(connection, batch);
    });
  }

  async queryMovies(query: LibraryQuery, signal?: AbortSignal) {
    await this.writes;
    throwIfAborted(signal);
    const text = query.text.trim().toLowerCase();
    const number = normalizeMovieCarNum(query.text);
    const mask = query.flags.reduce((bits, flag) => bits | flagBits[flag], 0);
    const sort = { updated: 'modified DESC', date: 'released DESC', code: 'sortNumber IS NULL, sortNumber' }[query.sort];
    const offset = query.offset ?? 0;
    let matches = 'true';
    const terms: Bind[] = [];
    if (text) {
      if (this.hasSearchIndex && [...text].length >= 3) {
        matches = `position IN (SELECT rowid FROM works_fts WHERE works_fts MATCH ?
          UNION SELECT position FROM works WHERE number = ?)`;
        terms.push('"' + text.replaceAll('"', '""') + '"', number);
      } else {
        matches = '(number = ? OR instr(search, ?) > 0)';
        terms.push(number, text);
      }
    }
    if (query.collection) {
      matches += ' AND json_extract(value, ?) = 1';
      terms.push('$.collectionMembership.' + query.collection);
    }
    const condition = `(flags & ?) = ? AND ${matches}`;
    const rows = await this.db.getAllAsync<WorkRow>(`SELECT position, value FROM works WHERE ${condition}
      ORDER BY CASE WHEN number = ? THEN 0 ELSE 1 END, ${sort}, position
      LIMIT ? OFFSET ?`, mask, mask, ...terms, number, pageSize + 1, offset);
    const count = query.includeCount && offset === 0
      ? (await this.db.getFirstAsync<{ total: number }>(`SELECT count(*) AS total FROM works WHERE ${condition}`, mask, mask, ...terms))?.total : undefined;
    throwIfAborted(signal);
    return {
      items: rows.slice(0, pageSize).map(row => recordMovie(JSON.parse(row.value) ?? {}, row.position)),
      next: rows.length > pageSize ? offset + pageSize : null,
      count,
    };
  }

  async blockedNumbers() {
    await this.writes;
    return this.db.getAllAsync<{ number: string }>('SELECT number FROM works WHERE (flags & ?) != 0 AND number IS NOT NULL', flagBits.blocked);
  }

  async summary() {
    await this.writes;
    return (await this.db.getFirstAsync<{ all: number; favorite: number; watched: number; downloaded: number }>(`
      SELECT count(*) AS 'all', count(*) FILTER (WHERE flags & 1) AS favorite,
        count(*) FILTER (WHERE flags & 2) AS downloaded, count(*) FILTER (WHERE flags & 4) AS watched FROM works`))!;
  }
}
