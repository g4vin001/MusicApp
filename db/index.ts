import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure its database ID in wrangler.json and apply the D1 migrations before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
