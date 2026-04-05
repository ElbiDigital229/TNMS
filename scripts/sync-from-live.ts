/**
 * Sync data from the live TNMS server into your local database.
 *
 * Usage:
 *   npx tsx scripts/sync-from-live.ts
 *
 * Prerequisites:
 *   - Local database created and migrations applied (npm run setup)
 *   - Live server must be reachable
 *
 * What it does:
 *   1. Logs into the live API
 *   2. Fetches all data (properties, floors, units, assets, roles, users, settings)
 *   3. Inserts everything into your local database
 *   4. Creates a local admin user so you can log in
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const LIVE_URL = process.env.LIVE_API_URL || "http://18.234.126.30:5000";
const LIVE_USER = process.env.LIVE_USERNAME || "admin";
const LIVE_PASS = process.env.LIVE_PASSWORD || "admin";

const prisma = new PrismaClient();

async function api(path: string, token: string) {
  const res = await fetch(`${LIVE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

async function login(): Promise<string> {
  const res = await fetch(`${LIVE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: LIVE_USER, password: LIVE_PASS }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.data?.token ?? data.token;
}

async function main() {
  console.log(`\nSyncing from ${LIVE_URL}...\n`);

  // ── 1. Login ──
  console.log("[1/8] Logging in...");
  const token = await login();
  console.log("  Logged in ✓");

  // ── 2. Fetch all data ──
  console.log("[2/8] Fetching data from live server...");

  const [propsRes, rolesRes, usersRes, assetCats, areaGroups] = await Promise.all([
    api("/api/properties", token),
    api("/api/roles", token),
    api("/api/users", token),
    api("/api/asset-categories", token),
    api("/api/area-groups", token),
  ]);

  const properties = propsRes.data ?? propsRes;
  const roles = Array.isArray(rolesRes) ? rolesRes : rolesRes.data ?? rolesRes;
  const users = usersRes.data ?? usersRes;

  console.log(`  ${properties.length} properties, ${roles.length} roles, ${users.length} users`);
  console.log(`  ${assetCats.length} asset categories, ${areaGroups.length} area groups`);

  // Fetch role details (permissions)
  const roleDetails = await Promise.all(
    roles.map((r: any) => api(`/api/roles/${r.id}`, token))
  );

  // Fetch user details (property assignments)
  const userDetails = await Promise.all(
    users.map((u: any) => api(`/api/users/${u.id}`, token))
  );

  // Fetch floors, units, assets per property
  console.log("[3/8] Fetching floors, units, assets...");
  const allFloors: any[] = [];
  const allUnits: any[] = [];
  const allAssets: any[] = [];

  for (const prop of properties) {
    const [floors, units, assets] = await Promise.all([
      api(`/api/properties/${prop.id}/floors`, token),
      api(`/api/properties/${prop.id}/units`, token),
      api(`/api/properties/${prop.id}/assets`, token),
    ]);
    const floorList = Array.isArray(floors) ? floors : floors.data ?? floors;
    const unitList = Array.isArray(units) ? units : units.data ?? units;
    const assetList = Array.isArray(assets) ? assets : assets.data ?? assets;

    allFloors.push(...floorList);
    allUnits.push(...unitList);
    allAssets.push(...assetList);
    console.log(`  ${prop.name}: ${floorList.length} floors, ${unitList.length} units, ${assetList.length} assets`);
  }

  // ── 3. Clear local database ──
  console.log("[4/8] Clearing local database...");
  await prisma.$transaction([
    prisma.ticketAsset.deleteMany(),
    prisma.ticketActivity.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.asset.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.floor.deleteMany(),
    prisma.userPropertyAssignment.deleteMany(),
    prisma.todo.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.property.deleteMany(),
    prisma.assetCategory.deleteMany(),
    prisma.areaGroup.deleteMany(),
  ]);
  console.log("  Cleared ✓");

  // ── 4. Seed permissions (from shared constants) ──
  console.log("[5/8] Seeding permissions...");
  const { PERMISSION_DEFINITIONS } = await import("../shared/permissions.js");
  for (const perm of PERMISSION_DEFINITIONS) {
    await prisma.permission.create({
      data: { key: perm.key, module: perm.module, description: perm.description },
    });
  }
  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));
  console.log(`  ${allPerms.length} permissions ✓`);

  // ── 5. Seed area groups, asset categories, roles ──
  console.log("[6/8] Seeding settings, roles...");

  for (const ag of areaGroups) {
    await prisma.areaGroup.create({
      data: { id: ag.id, city: ag.city, groupName: ag.groupName },
    });
  }

  for (const cat of assetCats) {
    await prisma.assetCategory.create({
      data: { id: cat.id, name: cat.name, status: cat.status || "ACTIVE" },
    });
  }

  // Create roles with permissions
  for (const rd of roleDetails) {
    const role = rd;
    await prisma.role.create({
      data: {
        id: role.id,
        name: role.name,
        level: role.level,
        canAssignToMaxLevel: role.canAssignToMaxLevel,
        isSystemRole: role.isSystemRole,
        status: role.status || "ACTIVE",
        permissions: {
          create: (role.permissions || [])
            .filter((rp: any) => permByKey.has(rp.permission?.key))
            .map((rp: any) => ({
              permissionId: permByKey.get(rp.permission.key)!,
            })),
        },
      },
    });
  }
  console.log(`  ${areaGroups.length} area groups, ${assetCats.length} categories, ${roleDetails.length} roles ✓`);

  // ── 6. Seed properties, floors, units ──
  console.log("[7/8] Seeding properties, floors, units...");

  for (const prop of properties) {
    await prisma.property.create({
      data: {
        id: prop.id,
        name: prop.name,
        code: prop.code,
        type: prop.type,
        description: prop.description || "",
        imagePath: prop.imagePath,
        latitude: prop.latitude,
        longitude: prop.longitude,
        city: prop.city,
        status: prop.status || "ACTIVE",
        areaGroupId: prop.areaGroupId,
      },
    });
  }

  for (const floor of allFloors) {
    await prisma.floor.create({
      data: {
        id: floor.id,
        name: floor.name,
        propertyId: floor.propertyId,
        status: floor.status || "ACTIVE",
      },
    });
  }

  for (const unit of allUnits) {
    await prisma.unit.create({
      data: {
        id: unit.id,
        name: unit.name,
        code: unit.code || unit.name,
        floorId: unit.floorId,
        propertyId: unit.propertyId,
        unitType: unit.type || unit.unitType || null,
        status: unit.status || "ACTIVE",
      },
    });
  }
  console.log(`  ${properties.length} properties, ${allFloors.length} floors, ${allUnits.length} units ✓`);

  // ── 7. Seed users ──
  console.log("[8/8] Seeding users and assets...");

  const passwordHash = await bcrypt.hash("admin", 10);
  for (const ud of userDetails) {
    const u = ud;
    await prisma.user.create({
      data: {
        id: u.id,
        username: u.username,
        passwordHash,  // all users get "admin" as password locally
        fullName: u.fullName || u.username,
        email: u.email || undefined,
        phone: u.phone || undefined,
        isSuperAdmin: u.isSuperAdmin || false,
        allProperties: u.allProperties || false,
        roleId: u.roleId,
        reportsToId: u.reportsToId || undefined,
        status: u.status || "ACTIVE",
        propertyAssignments: {
          create: (u.propertyAssignments || []).map((pa: any) => ({
            propertyId: pa.propertyId,
          })),
        },
      },
    });
  }

  // ── 8. Seed assets ──
  let assetCount = 0;
  for (const asset of allAssets) {
    try {
      await prisma.asset.create({
        data: {
          code: asset.code,
          name: asset.name,
          categoryId: asset.categoryId,
          unitOfMeasure: asset.unitOfMeasure || "NOS",
          quantity: asset.quantity || 1,
          condition: asset.condition || "GOOD",
          additionalInfo: asset.additionalInfo || undefined,
          floorId: asset.floorId,
          propertyId: asset.propertyId,
          serialNumber: asset.serialNumber || undefined,
          purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : undefined,
          qrCode: asset.qrCode || "",
          status: asset.status || "ACTIVE",
        },
      });
      assetCount++;
    } catch (e: any) {
      // Skip duplicates or errors
      console.log(`  Skipped asset ${asset.code}: ${e.message.substring(0, 80)}`);
    }
  }

  console.log(`  ${users.length} users, ${assetCount} assets ✓`);

  console.log("\n=========================================");
  console.log("  Sync complete!");
  console.log("=========================================");
  console.log(`\n  All users have password: "admin"`);
  console.log("  Start the app: npm run dev\n");
}

main()
  .catch((e) => {
    console.error("Sync failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
