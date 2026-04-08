/**
 * One-shot cleanup:
 *   1. Wipes all ticket data + ticket schedules
 *   2. Wipes per-user data (todos, audit logs, notifications, device tokens, property assignments)
 *   3. Deletes all users except `admin`
 *   4. Consolidates roles down to: Super Admin, Manager, Staff
 *   5. Ensures `admin` is on Super Admin with every permission
 *
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/reset-users-and-roles.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_USERNAME = "admin";

// Permissions assigned to each preserved role.
// Super Admin gets ALL permissions automatically.
const MANAGER_PERMISSIONS = [
  // Properties / floors / units / assets — full management
  "properties.view", "properties.create", "properties.edit", "properties.deactivate", "properties.export",
  "floors.view", "floors.create", "floors.edit", "floors.deactivate", "floors.import", "floors.delete",
  "units.view", "units.create", "units.edit", "units.deactivate", "units.export", "units.import",
  "assets.view", "assets.create", "assets.edit", "assets.deactivate", "assets.export", "assets.import", "assets.qr_download",
  // Tickets — full
  "tickets.view_all", "tickets.view_assigned", "tickets.create", "tickets.edit",
  "tickets.update_status", "tickets.assign", "tickets.assignee_eligible",
  "tickets.comment", "tickets.export", "tickets.reopen",
  // Misc
  "todos.access",
  "dashboard.view",
  "reports.view",
  "audit.view",
  // Settings (catalog management — categories, departments, area groups)
  "settings.area_groups.manage",
  "settings.asset_categories.manage",
  "settings.ticket_categories.manage",
  "settings.departments.manage",
];

const STAFF_PERMISSIONS = [
  // Read-only on inventory
  "properties.view",
  "floors.view",
  "units.view",
  "assets.view",
  // Tickets — work their own queue
  "tickets.view_assigned",
  "tickets.create",
  "tickets.update_status",
  "tickets.assignee_eligible",
  "tickets.comment",
  "tickets.reopen",
  // Misc
  "todos.access",
  "dashboard.view",
];

async function main() {
  console.log("\n=== TNMS reset: users + roles ===\n");

  // ── Step 1: locate admin ──
  const admin = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } });
  if (!admin) throw new Error(`Admin user "${ADMIN_USERNAME}" not found — aborting.`);
  console.log(`✓ Found admin user: ${admin.id}`);

  // ── Step 2: wipe ticket data ──
  console.log("\n[1/5] Wiping ticket data...");
  await prisma.$transaction([
    prisma.ticketAsset.deleteMany(),
    prisma.ticketComment.deleteMany(),
    prisma.ticketActivity.deleteMany(),
    prisma.ticketBlock.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.ticketSchedule.deleteMany(),
  ]);
  console.log("  ✓ tickets, comments, activities, blocks, schedules cleared");

  // ── Step 3: wipe per-user data that doesn't cascade ──
  console.log("\n[2/5] Wiping per-user data...");
  await prisma.$transaction([
    prisma.todo.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);
  console.log("  ✓ todos, audit logs cleared");

  // ── Step 4: clear dept heads, then delete non-admin users ──
  console.log("\n[3/5] Deleting non-admin users...");
  await prisma.department.updateMany({ data: { headUserId: null } });
  const deleted = await prisma.user.deleteMany({
    where: { username: { not: ADMIN_USERNAME } },
  });
  console.log(`  ✓ removed ${deleted.count} users (cascaded: notifications, device tokens, property assignments)`);

  // ── Step 5: consolidate roles ──
  console.log("\n[4/5] Consolidating roles...");

  const allPermissions = await prisma.permission.findMany();
  const permByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

  async function upsertRole(name: string, permKeys: string[]) {
    const existing = await prisma.role.findFirst({ where: { name } });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", isSystemRole: true },
        })
      : await prisma.role.create({
          data: { name, status: "ACTIVE", isSystemRole: true },
        });

    // Reset its permission set
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const ids = permKeys
      .map((k) => permByKey.get(k))
      .filter((id): id is string => !!id);
    if (ids.length) {
      await prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
    }
    console.log(`  ✓ ${name}: ${ids.length} permissions`);
    return role;
  }

  const superAdmin = await upsertRole("Super Admin", allPermissions.map((p) => p.key));
  const manager = await upsertRole("Manager", MANAGER_PERMISSIONS);
  const staff = await upsertRole("Staff", STAFF_PERMISSIONS);

  // Make sure admin is on Super Admin
  await prisma.user.update({
    where: { id: admin.id },
    data: { roleId: superAdmin.id, isSuperAdmin: true, allProperties: true },
  });

  // Drop all other roles
  const keepRoleIds = [superAdmin.id, manager.id, staff.id];
  const orphans = await prisma.role.findMany({
    where: { id: { notIn: keepRoleIds } },
    include: { _count: { select: { users: true } } },
  });

  for (const r of orphans) {
    if (r._count.users > 0) {
      console.log(`  ! skipping role "${r.name}" — still has ${r._count.users} user(s)`);
      continue;
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: r.id } });
    await prisma.role.delete({ where: { id: r.id } });
    console.log(`  ✓ removed legacy role: ${r.name}`);
  }

  // ── Step 6: summary ──
  console.log("\n[5/5] Final state:");
  const userCount = await prisma.user.count();
  const roles = await prisma.role.findMany({
    include: { _count: { select: { users: true, permissions: true } } },
    orderBy: { name: "asc" },
  });
  console.log(`  users: ${userCount}`);
  console.log("  roles:");
  for (const r of roles) {
    console.log(`    - ${r.name}: ${r._count.permissions} perms, ${r._count.users} user(s)`);
  }

  console.log("\n=== Done ===\n");
}

main()
  .catch((e) => {
    console.error("Reset failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
