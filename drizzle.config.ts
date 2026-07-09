import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { neonConfig } from "@neondatabase/serverless";

// Local dev only: drizzle-kit talks to Neon over a WebSocket. Redirect it to
// the local-neon-http-proxy container (docker-compose.local.yml) so schema
// push works against a plain Postgres. Unset NEON_LOCAL_PROXY in prod.
if (process.env.NEON_LOCAL_PROXY) {
  const proxyHost = new URL(process.env.NEON_LOCAL_PROXY).host; // e.g. db.localtest.me:4444
  neonConfig.wsProxy = () => `${proxyHost}/v2`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
