import "dotenv/config";

/**
 * Strict environment loader. Fails fast on missing required variables
 * and refuses to boot with well-known insecure defaults in production.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${v}"`);
  }
  return n;
}

const NODE_ENV = optional("NODE_ENV", "development");
const isProd = NODE_ENV === "production";

const JWT_SECRET = isProd
  ? required("JWT_SECRET")
  : optional("JWT_SECRET", "dev-only-secret-do-not-use-in-prod");
if (isProd) {
  const insecure = ["default-secret", "change-me-to-a-random-secret", "dev-only-secret-do-not-use-in-prod"];
  if (insecure.includes(JWT_SECRET) || JWT_SECRET.length < 24) {
    throw new Error(
      "JWT_SECRET is insecure in production. Set a random string of at least 24 characters.",
    );
  }
}

const DATABASE_URL = required("DATABASE_URL");

export const env = {
  DATABASE_URL,
  JWT_SECRET,
  PORT: intEnv("PORT", 3000),
  APP_BASE_URL: optional("APP_BASE_URL", "http://localhost:3000"),
  BCRYPT_SALT_ROUNDS: intEnv("BCRYPT_SALT_ROUNDS", 10),
  NODE_ENV,
  IS_PROD: isProd,
  /** Comma-separated list of allowed CORS origins (production). */
  CORS_ORIGINS: optional(
    "CORS_ORIGINS",
    "https://feoms.vercel.app,https://apitnms.duckdns.org",
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** Public-facing URL used in password reset emails etc. */
  APP_PUBLIC_URL: optional("APP_PUBLIC_URL", "https://feoms.vercel.app"),
};
