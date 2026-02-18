import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema.js';
import { getConfig } from '../config/index.js';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: PGlite | null = null;

export async function getDatabase() {
  if (_db) return _db;

  const config = getConfig();
  const dataDir = join(config.dataDir, 'pglite');
  mkdirSync(dataDir, { recursive: true });

  _client = new PGlite(dataDir);
  _db = drizzle(_client, { schema });

  return _db;
}

export async function closeDatabase() {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
  }
}

export type Database = Awaited<ReturnType<typeof getDatabase>>;
