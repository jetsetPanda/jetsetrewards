import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | undefined;

// Lazy init: importing this module must not require DATABASE_URL (the Next
// build imports pages to collect page data before any env is available).
function getDb(): Db {
  if (!_db) {
    // Local dev only: point the HTTP driver at a local neon proxy in front
    // of a plain Postgres (see docker-compose.local.yml). Unset in prod.
    if (process.env.NEON_LOCAL_PROXY) {
      neonConfig.fetchEndpoint = process.env.NEON_LOCAL_PROXY;
    }
    // Next.js instruments global fetch and caches responses in its Data Cache.
    // The neon-http driver issues queries as fetch POSTs, so without opting out
    // every SQL result gets cached and pages render stale data. `no-store`
    // makes each query hit the database.
    const sql = neon(process.env.DATABASE_URL!, {
      fetchOptions: { cache: "no-store" },
    });
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb() as object, prop, receiver);
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});

export { schema };
