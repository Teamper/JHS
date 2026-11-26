export const initialSchema = `
  CREATE TABLE IF NOT EXISTS jhs_values (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS works (
    position INTEGER PRIMARY KEY, value TEXT NOT NULL, number TEXT, sortNumber TEXT,
    search TEXT NOT NULL, modified INTEGER, released TEXT, flags INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS works_number ON works(number);
  CREATE INDEX IF NOT EXISTS works_modified ON works(modified DESC, position);
  CREATE INDEX IF NOT EXISTS works_released ON works(released DESC, position);
  CREATE INDEX IF NOT EXISTS works_sort_number ON works(sortNumber, position);
`;

export const searchSchema = `
  CREATE VIRTUAL TABLE works_fts USING fts5(search, content='works', content_rowid='position', tokenize='trigram');
  CREATE TRIGGER works_fts_insert AFTER INSERT ON works BEGIN
    INSERT INTO works_fts(rowid, search) VALUES (new.position, new.search);
  END;
  CREATE TRIGGER works_fts_delete AFTER DELETE ON works BEGIN
    INSERT INTO works_fts(works_fts, rowid, search) VALUES ('delete', old.position, old.search);
  END;
  CREATE TRIGGER works_fts_update AFTER UPDATE OF search ON works WHEN old.search <> new.search BEGIN
    INSERT INTO works_fts(works_fts, rowid, search) VALUES ('delete', old.position, old.search);
    INSERT INTO works_fts(rowid, search) VALUES (new.position, new.search);
  END;
  INSERT INTO works_fts(works_fts) VALUES ('rebuild');
`;
