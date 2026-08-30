import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/yelpbiz';

declare global {
  // eslint-disable-next-line no-var
  var __ybiz_sql: ReturnType<typeof postgres> | undefined;
}

const client = globalThis.__ybiz_sql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== 'production') globalThis.__ybiz_sql = client;

export const db = drizzle(client, { schema });
export { schema };
