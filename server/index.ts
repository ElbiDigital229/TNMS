import { app } from "./app.js";
import { prisma } from "./config/db.js";
import { env } from "./config/env.js";
import { seed } from "./config/seed.js";

async function main() {
  try {
    await prisma.$connect();
    console.log("Database connected");

    await seed();

    if (env.NODE_ENV === "development") {
      const { setupVite } = await import("./vite.js");
      await setupVite(app);
    }

    app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
