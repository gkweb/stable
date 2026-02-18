import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const dataDir = process.env['DATA_DIR'] ?? './data';
const pgliteDir = join(dataDir, 'pglite');
mkdirSync(pgliteDir, { recursive: true });

const client = new PGlite(pgliteDir);
const db = drizzle(client);

await migrate(db, { migrationsFolder: './drizzle' });

// eslint-disable-next-line no-console
console.log('Migrations applied successfully');

await client.close();
