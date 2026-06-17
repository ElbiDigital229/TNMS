/**
 * One-off restore script for the missing uploads incident.
 *
 *   1. Regenerates QR code PNGs for every asset that has a qrCode path
 *      in the database. The generator is deterministic (encodes the
 *      asset code into a URL), so re-running it produces identical
 *      files to whatever was there before.
 *
 *   2. Clears the imagePath column on any Property whose referenced
 *      image file is missing from disk. The original uploads can't be
 *      recovered without a backup, but clearing the dangling reference
 *      replaces the broken-image icon in the UI with the standard
 *      placeholder.
 *
 *   3. Ensures uploads/qrcodes/ exists so future asset creates don't
 *      silently fail.
 *
 * Run with:
 *   npx tsx scripts/restore-uploads.ts
 */
import { prisma } from "../server/config/db.js";
import { assetService } from "../server/modules/asset/asset.service.js";
import fs from "fs";
import path from "path";

const UPLOADS_ROOT = path.resolve("uploads");
const QR_DIR = path.join(UPLOADS_ROOT, "qrcodes");

async function ensureDirs() {
  if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });
  console.log(`✓ uploads/ + uploads/qrcodes/ exist`);
}

async function regenerateAssetQRs() {
  const assets = await prisma.asset.findMany({
    where: { NOT: { qrCode: null } },
    select: { id: true, code: true, qrCode: true },
  });
  console.log(`\nRegenerating ${assets.length} asset QR codes…`);

  let written = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    try {
      // Skip if file already exists (idempotent re-runs).
      const expected = path.resolve(a.qrCode!);
      if (fs.existsSync(expected)) {
        skipped++;
      } else {
        const newPath = await assetService.generateQRCode(a.code);
        // Keep the DB path in sync — should already match.
        if (newPath !== a.qrCode) {
          await prisma.asset.update({ where: { id: a.id }, data: { qrCode: newPath } });
        }
        written++;
      }
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${a.code}: ${e?.message || e}`);
    }
    if ((i + 1) % 200 === 0) {
      console.log(`  … ${i + 1}/${assets.length} processed (written=${written}, skipped=${skipped}, failed=${failed})`);
    }
  }
  console.log(`✓ QR regeneration done: ${written} written, ${skipped} already present, ${failed} failed`);
}

async function clearDanglingPropertyImages() {
  const properties = await prisma.property.findMany({
    where: { NOT: { imagePath: null } },
    select: { id: true, code: true, name: true, imagePath: true },
  });
  console.log(`\nChecking ${properties.length} property imagePath references…`);

  let cleared = 0;
  for (const p of properties) {
    const full = path.resolve(p.imagePath!);
    if (!fs.existsSync(full)) {
      await prisma.property.update({
        where: { id: p.id },
        data: { imagePath: null },
      });
      console.log(`  cleared: ${p.code} ${p.name}  (was: ${p.imagePath})`);
      cleared++;
    }
  }
  console.log(`✓ Cleared ${cleared} dangling property imagePath references`);
}

async function main() {
  await ensureDirs();
  await regenerateAssetQRs();
  await clearDanglingPropertyImages();
  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
