import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/appError.js";

export const authService = {
  async login(username: string, password: string) {
    // Allow login by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username },
        ],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    if (user.status === "INACTIVE") {
      throw new Error("Account is deactivated");
    }

    if (user.status === "BLOCKED") {
      throw new Error("Account access has been blocked");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, tv: user.tokenVersion },
      env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const permissions = user.role.permissions.map((rp) => rp.permission.key);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        allProperties: user.allProperties,
        mustChangePassword: user.mustChangePassword,
        role: {
          id: user.role.id,
          name: user.role.name,
        },
        permissions,
      },
    };
  },

  /**
   * Bump the user's tokenVersion, invalidating any JWT that was issued
   * before this call. Used on password change, status change, role change,
   * and admin "sign out everywhere".
   */
  async bumpTokenVersion(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  },

  /**
   * Change the current user's own password. Requires the current password
   * as proof-of-possession. Bumps tokenVersion so all other devices are
   * logged out.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.unauthorized();

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw AppError.unauthorized("Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
        mustChangePassword: false,
      },
    });
  },

  /**
   * Start a password-reset flow. Generates a random opaque token, stores
   * only its SHA-256 hash with a 30-minute expiry, and returns the raw
   * token so a transport layer (email provider) can deliver it to the
   * user. We always return silently — never reveal whether the email
   * exists.
   */
  async requestPasswordReset(email: string): Promise<{ delivered: boolean; token?: string }> {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), status: "ACTIVE" },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) return { delivered: false };

    // 32 bytes of randomness → 64 hex chars. Stored as a sha256 hash, so
    // a DB leak can't replay the token.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
    });

    // Email hook. When an SMTP / Resend / SendGrid provider is wired up,
    // dispatch here. For now we log the reset URL so the flow is testable.
    const resetUrl = `${env.APP_PUBLIC_URL}/reset-password?token=${rawToken}`;
    if (env.IS_PROD) {
      console.log(`[password-reset] TODO wire email provider — token for ${user.email}: ${resetUrl}`);
    } else {
      console.log(`[password-reset] dev reset link for ${user.email}: ${resetUrl}`);
    }

    return { delivered: true, token: rawToken };
  },

  /**
   * Consume a password-reset token. Verifies it's unused and unexpired,
   * updates the password, invalidates existing sessions, and marks the
   * token as used.
   */
  async consumePasswordReset(rawToken: string, newPassword: string) {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw AppError.badRequest("This reset link is invalid or has expired");
    }

    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
          mustChangePassword: false,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      // Burn all other unused tokens for this user so they can't be used later.
      prisma.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null, id: { not: row.id } },
        data: { usedAt: new Date() },
      }),
    ]);
  },

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.key);

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      allProperties: user.allProperties,
      mustChangePassword: user.mustChangePassword,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
      permissions,
    };
  },
};
