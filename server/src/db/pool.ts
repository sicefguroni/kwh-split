import pg from "pg";
import { parse as parsePgConnectionString } from "pg-connection-string";
import { env } from "../config/env.js";

const poolBase: Pick<pg.PoolConfig, "max" | "idleTimeoutMillis" | "connectionTimeoutMillis"> = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
};

/** RDS expects TLS; use Amazon's CA or rejectUnauthorized: false for typical ECS/VPC setups. */
function postgresSsl(): pg.ConnectionConfig["ssl"] | undefined {
  const host = env.DATABASE_HOST;
  const useSsl =
    env.DATABASE_SSL || host.includes(".rds.amazonaws.com");
  if (!useSsl) {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

function withSsl(config: pg.PoolConfig): pg.PoolConfig {
  const ssl = postgresSsl();
  return ssl ? { ...config, ssl } : config;
}

function buildPoolConfig(): pg.PoolConfig {
  const rawUrl = process.env.DATABASE_URL?.trim();
  if (rawUrl) {
    try {
      parsePgConnectionString(rawUrl);
      return withSsl({ ...poolBase, connectionString: rawUrl });
    } catch {
      if (!process.env.DATABASE_HOST?.trim()) {
        throw new Error(
          [
            "DATABASE_URL is not a valid postgres URI (node-postgres cannot parse it).",
            "Passwords with characters like @, [, ], #, or spaces often break URI parsing.",
            "Unset DATABASE_URL and set DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME, DATABASE_PORT (password can be literal),",
            "or percent-encode the user and password inside DATABASE_URL.",
          ].join(" "),
        );
      }
      return withSsl({
        ...poolBase,
        host: env.DATABASE_HOST,
        port: env.DATABASE_PORT,
        user: env.DATABASE_USER,
        password: env.DATABASE_PASSWORD,
        database: env.DATABASE_NAME,
      });
    }
  }
  return withSsl({ ...poolBase, connectionString: env.DATABASE_URL });
}

export const pool = new pg.Pool(buildPoolConfig());

pool.on("error", (error) => {
  console.error("Unexpected Postgres pool error", error);
});
