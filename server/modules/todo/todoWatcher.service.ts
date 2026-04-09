import { prisma } from "../../config/db.js";

export const todoWatcherService = {
  /** Add a watcher to the current user's todo list */
  async addWatcher(ownerId: string, watcherId: string) {
    if (ownerId === watcherId) throw new Error("Cannot watch your own list");

    // Verify watcher user exists and is active
    const watcher = await prisma.user.findUnique({
      where: { id: watcherId },
      select: { id: true, status: true },
    });
    if (!watcher || watcher.status !== "ACTIVE") {
      throw new Error("User not found or inactive");
    }

    return prisma.todoWatcher.create({
      data: { ownerId, watcherId },
      include: {
        watcher: { select: { id: true, fullName: true, username: true } },
      },
    });
  },

  /** Remove a watcher from the current user's todo list */
  async removeWatcher(ownerId: string, watcherId: string) {
    return prisma.todoWatcher.delete({
      where: { ownerId_watcherId: { ownerId, watcherId } },
    });
  },

  /** List users who can watch my list (my watchers) */
  async getMyWatchers(ownerId: string) {
    return prisma.todoWatcher.findMany({
      where: { ownerId },
      include: {
        watcher: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /** List whose lists I'm watching */
  async getWatchedLists(watcherId: string) {
    return prisma.todoWatcher.findMany({
      where: { watcherId },
      include: {
        owner: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Check if user is a watcher of owner's list */
  async isWatcher(ownerId: string, watcherId: string) {
    const record = await prisma.todoWatcher.findUnique({
      where: { ownerId_watcherId: { ownerId, watcherId } },
    });
    return !!record;
  },
};
