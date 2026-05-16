import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  OAUTH_CALLBACK_BASE_URL: z.string().url().optional(),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 15),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),

  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),

  /** Not `z.string().url()` — passwords often contain `@` / `[]` / etc.; encode those or use DATABASE_* fields instead. */
  DATABASE_URL: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().min(1).optional(),
    ),
  DATABASE_HOST: z.string().default("localhost"),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_USER: z.string().default("split"),
  DATABASE_PASSWORD: z.string().default("split"),
  DATABASE_NAME: z.string().default("split_dev"),
  /** Set true for AWS RDS (or when host is *.rds.amazonaws.com). Local Postgres: leave unset/false. */
  DATABASE_SSL: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),

  /** When an offline sync INSERT omits `group_id`, use this group (user must be a member). */
  OFFLINE_SYNC_DEFAULT_GROUP_ID: z.coerce.number().int().positive().optional(),

  GOOGLE_CLIENT_ID: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),
  GOOGLE_CLIENT_SECRET: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),
  SMTP_HOST: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional()),
  SMTP_PASS: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional()),
  SMTP_FROM: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),

  /** TabScanner receipt OCR — https://tabscanner.com */
  OCR_API_KEY: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),

  /** ElastiCache / local Redis — enables cluster rate limits, realtime fan-out, server-side session marker. */
  REDIS_URL: z.string().url().optional(),

  SES_REGION: z.string().default("ap-southeast-1"),
  AWS_REGION: z.string().default("ap-southeast-1"),
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
  SMTP_PASSWORD: config.SMTP_PASS, // Map PASS to PASSWORD for the mailer code
  OAUTH_CALLBACK_BASE_URL:
    config.OAUTH_CALLBACK_BASE_URL ?? `http://localhost:${config.PORT}`,
});
