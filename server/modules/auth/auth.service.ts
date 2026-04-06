import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";

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
      { id: user.id, username: user.username },
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
        role: {
          id: user.role.id,
          name: user.role.name,
          level: user.role.level,
        },
        permissions,
      },
    };
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
      role: {
        id: user.role.id,
        name: user.role.name,
        level: user.role.level,
      },
      permissions,
    };
  },
};
