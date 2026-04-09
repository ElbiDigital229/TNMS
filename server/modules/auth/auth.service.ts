import bcrypt from "bcrypt";
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
