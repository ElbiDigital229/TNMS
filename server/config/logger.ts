import pino from "pino";
import { env } from "./env.js";

/**
 * Structured logger. In development we use pino-pretty for human-readable
 * output; in production we emit single-line JSON so log aggregators can
 * parse it. Never log passwords, tokens, or password hashes.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (env.IS_PROD ? "info" : "debug"),
  ...(env.IS_PROD
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.currentPassword",
      "req.body.newPassword",
      "req.body.token",
      "*.passwordHash",
      "*.tokenHash",
    ],
    censor: "[REDACTED]",
  },
});
