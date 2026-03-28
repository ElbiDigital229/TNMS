import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { propertyRoutes } from "./modules/property/property.routes.js";
import { floorRoutes } from "./modules/floor/floor.routes.js";
import { unitRoutes } from "./modules/unit/unit.routes.js";
import { assetRoutes, propertyAssetRoutes } from "./modules/asset/asset.routes.js";
import { assetCategoryRoutes } from "./modules/asset-category/asset-category.routes.js";
import { areaGroupRoutes } from "./modules/area-group/area-group.routes.js";
import { ticketRoutes } from "./modules/ticket/ticket.routes.js";
import { ticketCategoryRoutes } from "./modules/ticket-category/ticket-category.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { todoRoutes } from "./modules/todo/todo.routes.js";
import { permissionRoutes } from "./modules/permission/permission.routes.js";
import { roleRoutes } from "./modules/role/role.routes.js";
import { userRoutes } from "./modules/user/user.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// General API rate limit: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Stricter login rate limit: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

// Apply general rate limit to all API routes
app.use("/api", apiLimiter);

// Serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API routes — apply stricter limiter to login endpoint
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/properties", floorRoutes);
app.use("/api/properties", unitRoutes);
app.use("/api/properties", propertyAssetRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/asset-categories", assetCategoryRoutes);
app.use("/api/area-groups", areaGroupRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/ticket-categories", ticketCategoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);

// Error handler
app.use(errorHandler);
