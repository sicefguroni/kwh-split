import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 15),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),

  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),

  DATABASE_URL: z.string().url().optional(),
  DATABASE_HOST: z.string().default("localhost"),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_USER: z.string().default("split"),
  DATABASE_PASSWORD: z.string().default("split"),
  DATABASE_NAME: z.string().default("split_dev"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", z.treeifyError(parsed.error));
  process.exit(1);
}

const config = parsed.data;
const databaseUrl =
  config.DATABASE_URL ??
  `postgres://${encodeURIComponent(config.DATABASE_USER)}:${encodeURIComponent(
    config.DATABASE_PASSWORD,
  )}@${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`;

export const env = Object.freeze({
  ...config,
  DATABASE_URL: databaseUrl,
});
export type Env = typeof env;
