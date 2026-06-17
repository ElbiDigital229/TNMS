import fs from "fs";
import path from "path";
import { app } from "./app.js";
import { prisma } from "./config/db.js";
import { env } from "./config/env.js";
import { seed } from "./config/seed.js";
import { notificationTrigger } from "./services/notificationTrigger.service.js";
import { ticketScheduleService } from "./modules/ticketSchedule/ticketSchedule.service.js";

/**
 * Make sure runtime-managed upload directories exist on boot. Asset QR
 * generation depends on uploads/qrcodes/; if the directory is missing
 * (e.g. wiped during a server migration or manual cleanup), the very
 * first write would silently fail or throw on a cold prod box.
 */
function ensureUploadDirs() {
  for (const sub of ["", "qrcodes"]) {
    const dir = path.resolve("uploads", sub);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created missing upload dir: ${dir}`);
    }
  }
}

// Run overdue/due-soon checks every hour
function startScheduledNotificationChecks() {
  const ONE_HOUR = 60 * 60 * 1000;

  const runChecks = async () => {
    try {
      const overdue = await notificationTrigger.checkOverdueTickets();
      const dueSoon = await notificationTrigger.checkDueSoonTickets();
      if (overdue > 0 || dueSoon > 0) {
        console.log(`Notification checks: ${overdue} overdue, ${dueSoon} due soon`);
      }
    } catch (err) {
      console.error("Scheduled notification check failed:", err);
    }

    // Process recurring/scheduled ticket creation
    try {
      await ticketScheduleService.processDueSchedules();
    } catch (err) {
      console.error("Scheduled ticket processing failed:", err);
    }
  };

  // Run once after 30s delay (let server fully start), then every hour
  setTimeout(() => {
    runChecks();
    setInterval(runChecks, ONE_HOUR);
  }, 30_000);
}

async function main() {
  try {
    ensureUploadDirs();

    await prisma.$connect();
    console.log("Database connected");

    await seed();

    if (env.NODE_ENV === "development") {
      const { setupVite } = await import("./vite.js");
      await setupVite(app);
    } else {
      const { serveStatic } = await import("./vite.js");
      serveStatic(app);
    }

    app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
    });

    // Start background notification checks
    startScheduledNotificationChecks();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
