import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { propertyRoutes } from "./modules/property/property.routes.js";
import { floorRoutes } from "./modules/floor/floor.routes.js";
import { unitRoutes, unitGlobalRoutes } from "./modules/unit/unit.routes.js";
import { assetRoutes, propertyAssetRoutes } from "./modules/asset/asset.routes.js";
import { assetCategoryRoutes } from "./modules/asset-category/asset-category.routes.js";
import { areaGroupRoutes } from "./modules/area-group/area-group.routes.js";
import { ticketRoutes } from "./modules/ticket/ticket.routes.js";
import { ticketCategoryRoutes } from "./modules/ticket-category/ticket-category.routes.js";
import { departmentRoutes } from "./modules/department/department.routes.js";
import { designationRoutes } from "./modules/designation/designation.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { todoRoutes } from "./modules/todo/todo.routes.js";
import { permissionRoutes } from "./modules/permission/permission.routes.js";
import { roleRoutes } from "./modules/role/role.routes.js";
import { userRoutes } from "./modules/user/user.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { reportRoutes } from "./modules/report/report.routes.js";
import { notificationRoutes } from "./modules/notification/notification.routes.js";
import { ticketScheduleRoutes } from "./modules/ticketSchedule/ticketSchedule.routes.js";
import { acquisitionAgentRoutes } from "./modules/acquisition/agent/agent.routes.js";
import { acquisitionLandRoutes } from "./modules/acquisition/land/land.routes.js";
import { acquisitionBuildingRoutes } from "./modules/acquisition/building/building.routes.js";
import { ppmRoutes } from "./modules/ppm/ppm.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// --- Request logging -----------------------------------------------------
// pino-http attaches a request-scoped logger and emits a single JSON line
// per response with method, url, status, latency, and a correlation id.
// Health checks are dropped to keep the noise down.
app.use(
  pinoHttp({
    logger,
    genReqId: (req) =>
      (req.headers["x-request-id"] as string | undefined) ??
      crypto.randomUUID(),
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    autoLogging: {
      ignore: (req) => req.url === "/api/health",
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        };
      },
    },
  }),
);

// --- Security headers ----------------------------------------------------
// Keep CSP off here: we serve the SPA statically and Vite inlines bootstrap
// scripts, and the helmet default CSP would break it. Everything else
// (HSTS, frame-guard, nosniff, referrer-policy, etc.) is enabled.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// --- CORS -----------------------------------------------------------------
// In production we whitelist known origins. In development we allow any
// localhost port so the Vite dev server on whatever port works out of the box.
const corsAllowlist = new Set(env.CORS_ORIGINS);
app.use(
  cors({
    origin: (origin, cb) => {
      // Non-browser clients (curl, server-to-server, mobile webview) send no Origin
      if (!origin) return cb(null, true);
      if (!env.IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      if (corsAllowlist.has(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} is not allowed`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());

// General API rate limit: 1000 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  validate: { xForwardedForHeader: false },
});

// Stricter login rate limit: 20 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
  validate: { xForwardedForHeader: false },
});

// Generous rate limit for notification polling (300 req/15min)
const notificationPollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  validate: { xForwardedForHeader: false },
});
app.use("/api/notifications/unread-count", notificationPollLimiter);

// Tight limit for expensive endpoints: report builder, exports, bulk
// imports. These do heavy DB work and/or touch large payloads. 30 reqs
// per 15 minutes is more than enough for interactive use and stops
// runaway loops / accidental abuse.
const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests for this operation, please wait." },
  validate: { xForwardedForHeader: false },
});
app.use("/api/reports", expensiveLimiter);
app.use("/api/users/bulk-import", expensiveLimiter);

// Apply general rate limit to all API routes
app.use("/api", apiLimiter);

// Serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// --- Liveness probe ------------------------------------------------------
// Dead-simple health check for PM2 / uptime monitoring. Also pokes the DB
// so a wedged connection pool shows up as unhealthy. Never cached.
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "ok", uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

// API routes — apply stricter limiter to login endpoint
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/properties", floorRoutes);
app.use("/api/properties", unitRoutes);
app.use("/api/properties", propertyAssetRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/units", unitGlobalRoutes);
app.use("/api/asset-categories", assetCategoryRoutes);
app.use("/api/area-groups", areaGroupRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/ticket-categories", ticketCategoryRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ticket-schedules", ticketScheduleRoutes);
app.use("/api/acquisitions/agents", acquisitionAgentRoutes);
app.use("/api/acquisitions/land", acquisitionLandRoutes);
app.use("/api/acquisitions/buildings", acquisitionBuildingRoutes);
app.use("/api/ppms", ppmRoutes);

// Unmatched /api/* → JSON 404 (don't fall through to SPA)
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, error: "Not found", code: "NOT_FOUND" });
});

// Error handler (keep last)
app.use(errorHandler);
