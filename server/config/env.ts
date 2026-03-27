import "dotenv/config";

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET || "default-secret",
  PORT: parseInt(process.env.PORT || "3000", 10),
  APP_BASE_URL: process.env.APP_BASE_URL || "http://localhost:3000",
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
};
