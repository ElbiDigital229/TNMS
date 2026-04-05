import { prisma } from "../config/db.js";

let firebaseAdmin: any = null;

async function getFirebase() {
  if (firebaseAdmin) return firebaseAdmin;

  // Support either a file path or inline JSON via env var
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountPath && !serviceAccountJson) return null;

  try {
    const admin = await import("firebase-admin");
    let serviceAccount: any;

    if (serviceAccountJson) {
      serviceAccount = JSON.parse(serviceAccountJson);
    } else {
      const fs = await import("fs");
      serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath!, "utf-8")
      );
    }

    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
    });

    firebaseAdmin = admin.default;
    console.log("Firebase Admin initialized for push notifications");
    return firebaseAdmin;
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
    return null;
  }
}

// Initialize on import (non-blocking)
getFirebase();

export const fcmService = {
  /**
   * Send push notification to a specific user (all their devices)
   */
  async sendToUser(userId: string, payload: { title: string; body: string; data?: Record<string, string> }) {
    const admin = await getFirebase();
    if (!admin) return;

    const tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    });

    if (tokens.length === 0) return;

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: "high" as const,
        notification: {
          channelId: "tnms_notifications",
          icon: "ic_launcher",
          color: "#2563EB",
        },
      },
    };

    // Send to each device token
    const staleTokenIds: string[] = [];

    for (const { id, token } of tokens) {
      try {
        await admin.messaging().send({ ...message, token });
      } catch (err: any) {
        // Token is invalid/expired — mark for cleanup
        if (
          err.code === "messaging/invalid-registration-token" ||
          err.code === "messaging/registration-token-not-registered"
        ) {
          staleTokenIds.push(id);
        } else {
          console.error(`FCM send failed for token ${id}:`, err.message);
        }
      }
    }

    // Clean up stale tokens
    if (staleTokenIds.length > 0) {
      await prisma.deviceToken.deleteMany({
        where: { id: { in: staleTokenIds } },
      });
    }
  },

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(userIds: string[], payload: { title: string; body: string; data?: Record<string, string> }) {
    // Fire all sends concurrently
    await Promise.allSettled(
      userIds.map((userId) => this.sendToUser(userId, payload))
    );
  },

  /**
   * Register or update a device token for a user
   */
  async registerToken(userId: string, token: string, platform = "android") {
    return prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform, updatedAt: new Date() },
      create: { userId, token, platform },
    });
  },

  /**
   * Remove a device token (on logout)
   */
  async removeToken(token: string) {
    return prisma.deviceToken.deleteMany({
      where: { token },
    });
  },
};
