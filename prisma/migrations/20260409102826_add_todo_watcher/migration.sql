-- CreateTable
CREATE TABLE "TodoWatcher" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "watcherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TodoWatcher_ownerId_idx" ON "TodoWatcher"("ownerId");

-- CreateIndex
CREATE INDEX "TodoWatcher_watcherId_idx" ON "TodoWatcher"("watcherId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoWatcher_ownerId_watcherId_key" ON "TodoWatcher"("ownerId", "watcherId");

-- AddForeignKey
ALTER TABLE "TodoWatcher" ADD CONSTRAINT "TodoWatcher_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoWatcher" ADD CONSTRAINT "TodoWatcher_watcherId_fkey" FOREIGN KEY ("watcherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
