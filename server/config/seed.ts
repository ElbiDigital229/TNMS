import bcrypt from "bcrypt";
import { prisma } from "./db.js";
import { env } from "./env.js";
import {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
} from "../../shared/permissions.js";

export async function seed() {
  // ─── 1. Seed Permissions ─────────────────────────────────
  console.log("Seeding permissions...");
  for (const perm of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { module: perm.module, description: perm.description },
      create: { key: perm.key, module: perm.module, description: perm.description },
    });
  }
  console.log(`Seeded ${PERMISSION_DEFINITIONS.length} permissions`);

  // Fetch all permissions for role assignment
  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));

  const getPermIds = (keys: string[]) =>
    keys.map((k) => permByKey.get(k)!).filter(Boolean);

  // ─── 2. Seed Roles ──────────────────────────────────────
  // Three-tier role model: Super Admin / Manager / Staff.
  // Legacy roles (CEO, OPS Lead, Community Executive, Supervisor, Technician)
  // were removed in 2026-04. They are auto-deactivated below if still in DB.
  console.log("Seeding roles...");

  const P = PERMISSIONS;

  const roleDefs: {
    name: string;
    level: number;
    canAssignToMaxLevel: number | null;
    permissions: string[];
  }[] = [
    {
      name: "Super Admin",
      level: 0,
      canAssignToMaxLevel: null,
      permissions: [], // isSuperAdmin bypasses all permission checks
    },
    {
      // Manager — view-only on assets, tickets, users, departments, area groups.
      // Property/floor/unit hierarchy still editable since they own that workflow.
      name: "Manager",
      level: 1,
      canAssignToMaxLevel: 2,
      permissions: [
        P.PROPERTIES.VIEW, P.PROPERTIES.CREATE, P.PROPERTIES.EDIT, P.PROPERTIES.DEACTIVATE, P.PROPERTIES.EXPORT,
        P.FLOORS.VIEW, P.FLOORS.CREATE, P.FLOORS.EDIT, P.FLOORS.DEACTIVATE, P.FLOORS.IMPORT, P.FLOORS.DELETE,
        P.UNITS.VIEW, P.UNITS.CREATE, P.UNITS.EDIT, P.UNITS.DEACTIVATE, P.UNITS.EXPORT, P.UNITS.IMPORT,
        P.ASSETS.VIEW, P.ASSETS.EXPORT, P.ASSETS.QR_DOWNLOAD,
        P.TICKETS.VIEW_ALL, P.TICKETS.VIEW_ASSIGNED, P.TICKETS.EXPORT,
        P.TODOS.ACCESS,
        P.DASHBOARD.VIEW,
        P.REPORTS.VIEW,
        P.AUDIT.VIEW,
        P.USERS.VIEW,
      ],
    },
    {
      // Staff — read-only inventory, work their own ticket queue
      name: "Staff",
      level: 2,
      canAssignToMaxLevel: null,
      permissions: [
        P.PROPERTIES.VIEW,
        P.FLOORS.VIEW,
        P.UNITS.VIEW,
        P.ASSETS.VIEW,
        P.TICKETS.VIEW_ASSIGNED,
        P.TICKETS.CREATE,
        P.TICKETS.UPDATE_STATUS,
        P.TICKETS.ASSIGNEE_ELIGIBLE,
        P.TICKETS.COMMENT,
        P.TICKETS.REOPEN,
        P.TODOS.ACCESS,
        P.DASHBOARD.VIEW,
      ],
    },
  ];

  for (const roleDef of roleDefs) {
    const existingRole = await prisma.role.findUnique({
      where: { name: roleDef.name },
    });

    if (existingRole) {
      // Role already exists — don't overwrite permissions (preserves manual changes)
      console.log(`  Skipped role: ${roleDef.name} (already exists)`);
      continue;
      /* OLD CODE — was wiping manual permission changes on every restart:
      await prisma.role.update({
        where: { id: existingRole.id },
        data: {
          level: roleDef.level,
          canAssignToMaxLevel: roleDef.canAssignToMaxLevel,
          isSystemRole: true,
        },
      });

      */
    } else {
      const permIds = getPermIds(roleDef.permissions);
      await prisma.role.create({
        data: {
          name: roleDef.name,
          level: roleDef.level,
          canAssignToMaxLevel: roleDef.canAssignToMaxLevel,
          isSystemRole: true,
          permissions: {
            create: permIds.map((permId) => ({ permissionId: permId })),
          },
        },
      });
    }
    console.log(`Seeded role: ${roleDef.name}`);
  }

  // Deactivate (or delete if empty) old roles that are no longer in the hierarchy
  const oldRoleNames = [
    "General Manager", "Operations Manager", "Office Manager", "Viewer",
    "CEO", "OPS Lead", "Community Executive", "Supervisor", "Technician",
  ];
  for (const name of oldRoleNames) {
    const oldRole = await prisma.role.findUnique({
      where: { name },
      include: { _count: { select: { users: true } } },
    });
    if (!oldRole) continue;
    if (oldRole._count.users === 0) {
      await prisma.rolePermission.deleteMany({ where: { roleId: oldRole.id } });
      await prisma.role.delete({ where: { id: oldRole.id } });
      console.log(`Removed legacy role: ${name}`);
    } else {
      await prisma.role.update({ where: { id: oldRole.id }, data: { status: "INACTIVE" } });
      console.log(`Deactivated legacy role (still has users): ${name}`);
    }
  }

  // ─── 3. Fetch roles for user assignment ─────────────────
  const roleMap: Record<string, string> = {};
  for (const name of ["Super Admin", "Manager", "Staff"]) {
    const role = await prisma.role.findUnique({ where: { name } });
    if (role) roleMap[name] = role.id;
  }

  // ─── 4. Seed/Update Admin User ──────────────────────────
  const existingAdmin = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  const passwordHash = await bcrypt.hash("admin", env.BCRYPT_SALT_ROUNDS);

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username: "admin",
        passwordHash,
        fullName: "System Administrator",
        isSuperAdmin: true,
        allProperties: true,
        roleId: roleMap["Super Admin"],
      },
    });
    console.log("Seeded admin user (admin/admin)");
  } else {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        isSuperAdmin: true,
        allProperties: true,
        roleId: roleMap["Super Admin"],
      },
    });
    console.log("Updated admin user with Super Admin role");
  }

  // ─── 5+ Only seed mock data when explicitly requested ─────
  if (process.env.SEED_MOCK_DATA !== "true") {
    console.log("Skipping mock data seeding (set SEED_MOCK_DATA=true to seed)");
    return;
  }

  // ─── 5. Seed Default Area Groups ─────────────────────────
  for (const ag of [
    { city: "LAHORE" as const, groupName: "Central" },
    { city: "ISLAMABAD" as const, groupName: "North" },
  ]) {
    await prisma.areaGroup.upsert({
      where: { city: ag.city },
      update: {},
      create: ag,
    });
  }
  console.log("Seeded area groups");

  // ─── 6. Seed Asset & Ticket Categories ──────────────────
  const assetCatNames = ["HVAC", "Plumbing", "Electrical", "Fire Safety", "Elevator", "General"];
  for (const name of assetCatNames) {
    await prisma.assetCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${assetCatNames.length} asset categories`);

  const ticketCatNames = ["Maintenance", "Complaint", "Inspection", "Cleaning", "Security"];
  for (const name of ticketCatNames) {
    await prisma.ticketCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${ticketCatNames.length} ticket categories`);

  // ─── Seed Departments ────────────────────────────────────
  const departmentNames = ["Operations", "Maintenance", "Cleaning", "Security", "Administration", "Finance"];
  for (const name of departmentNames) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${departmentNames.length} departments`);

  // ─── 7. Seed Properties, Floors, Units, Assets ──────────
  const lahore = await prisma.areaGroup.findUnique({ where: { city: "LAHORE" } });
  const islamabad = await prisma.areaGroup.findUnique({ where: { city: "ISLAMABAD" } });
  const hvacCat = await prisma.assetCategory.findUnique({ where: { name: "HVAC" } });
  const plumbingCat = await prisma.assetCategory.findUnique({ where: { name: "Plumbing" } });
  const electricalCat = await prisma.assetCategory.findUnique({ where: { name: "Electrical" } });
  const fireCat = await prisma.assetCategory.findUnique({ where: { name: "Fire Safety" } });
  const elevatorCat = await prisma.assetCategory.findUnique({ where: { name: "Elevator" } });
  const generalCat = await prisma.assetCategory.findUnique({ where: { name: "General" } });

  const propertyDefs = [
    { code: "PROP-001", name: "Gulberg Heights", type: "BUILDING" as const, city: "LAHORE" as const, description: "14-story residential tower in Gulberg III", areaGroupId: lahore?.id },
    { code: "PROP-002", name: "Blue Area Tower", type: "BUILDING" as const, city: "ISLAMABAD" as const, description: "Commercial office complex in Blue Area", areaGroupId: islamabad?.id },
    { code: "PROP-003", name: "DHA Villas Compound", type: "COMPOUND" as const, city: "LAHORE" as const, description: "Gated community of 24 villas in DHA Phase 6", areaGroupId: lahore?.id },
  ];

  const createdProperties: Record<string, string> = {};
  const createdUnits: { id: string; propertyCode: string; code: string }[] = [];

  for (const propDef of propertyDefs) {
    const existing = await prisma.property.findUnique({ where: { code: propDef.code } });
    if (existing) {
      createdProperties[propDef.code] = existing.id;
      console.log(`Property ${propDef.code} already exists`);
      // Still collect units
      const units = await prisma.unit.findMany({ where: { propertyId: existing.id }, select: { id: true, code: true } });
      for (const u of units) createdUnits.push({ id: u.id, propertyCode: propDef.code, code: u.code });
      continue;
    }

    const property = await prisma.property.create({ data: propDef });
    createdProperties[propDef.code] = property.id;
    console.log(`Seeded property: ${propDef.name}`);

    // Floors
    const floorDefs =
      propDef.type === "BUILDING"
        ? ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor"]
        : ["Block A", "Block B"];

    const createdFloors: { id: string; name: string }[] = [];
    for (const floorName of floorDefs) {
      const floor = await prisma.floor.create({
        data: { name: floorName, propertyId: property.id },
      });
      createdFloors.push({ id: floor.id, name: floor.name });
    }

    // Units — 2 per floor
    let unitIndex = 1;
    for (const floor of createdFloors) {
      for (let u = 1; u <= 2; u++) {
        const unitCode = `${propDef.code}-U${String(unitIndex).padStart(2, "0")}`;
        const unitType = propDef.type === "COMPOUND" ? "Villa" : (unitIndex % 2 === 0 ? "Office" : "Apartment");
        const unit = await prisma.unit.create({
          data: {
            code: unitCode,
            name: `Unit ${unitIndex}`,
            unitType,
            floorId: floor.id,
            propertyId: property.id,
          },
        });
        createdUnits.push({ id: unit.id, propertyCode: propDef.code, code: unitCode });
        unitIndex++;
      }
    }

    // Assets — a few per property spread across floors
    const assetDefs = [
      { name: "Split AC Unit", categoryId: hvacCat!.id, unitOfMeasure: "Unit", condition: "GOOD" as const },
      { name: "Water Heater", categoryId: plumbingCat!.id, unitOfMeasure: "Unit", condition: "EXCELLENT" as const },
      { name: "Main Distribution Board", categoryId: electricalCat!.id, unitOfMeasure: "Unit", condition: "GOOD" as const },
      { name: "Fire Extinguisher", categoryId: fireCat!.id, unitOfMeasure: "Unit", condition: "FAIR" as const },
      { name: "Passenger Elevator", categoryId: elevatorCat!.id, unitOfMeasure: "Unit", condition: "GOOD" as const },
      { name: "Generator Set", categoryId: generalCat!.id, unitOfMeasure: "Unit", condition: "GOOD" as const },
    ];

    for (let i = 0; i < assetDefs.length; i++) {
      const targetFloor = createdFloors[i % createdFloors.length];
      const assetCode = `${propDef.code}-A${String(i + 1).padStart(3, "0")}`;
      await prisma.asset.create({
        data: {
          code: assetCode,
          name: assetDefs[i].name,
          categoryId: assetDefs[i].categoryId,
          unitOfMeasure: assetDefs[i].unitOfMeasure,
          condition: assetDefs[i].condition,
          floorId: targetFloor.id,
          propertyId: property.id,
          qrCode: `QR-${assetCode}`,
        },
      });
    }
    console.log(`Seeded ${assetDefs.length} assets for ${propDef.name}`);
  }

  // ─── 8. Seed Mock Users with Hierarchy ──────────────────
  const defaultPw = await bcrypt.hash("password123", env.BCRYPT_SALT_ROUNDS);

  const upsertUser = async (data: {
    username: string;
    fullName: string;
    email: string;
    phone?: string;
    roleName: string;
    allProperties: boolean;
    propertyCodeAssignments?: string[];
    reportsToUsername?: string; // ignored — kept for backward seed compat
  }) => {
    const roleId = roleMap[data.roleName];
    if (!roleId) { console.log(`Role ${data.roleName} not found, skipping ${data.username}`); return; }

    let user = await prisma.user.findUnique({ where: { username: data.username } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: data.username,
          passwordHash: defaultPw,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          roleId,
          allProperties: data.allProperties,
        },
      });
      console.log(`Seeded user: ${data.fullName} (${data.roleName})`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId, allProperties: data.allProperties, fullName: data.fullName, email: data.email },
      });
      console.log(`Updated user: ${data.fullName}`);
    }

    // Assign properties
    if (data.propertyCodeAssignments && data.propertyCodeAssignments.length > 0) {
      await prisma.userPropertyAssignment.deleteMany({ where: { userId: user.id } });
      const propIds = data.propertyCodeAssignments
        .map((code) => createdProperties[code])
        .filter(Boolean);
      if (propIds.length > 0) {
        await prisma.userPropertyAssignment.createMany({
          data: propIds.map((propertyId) => ({ userId: user.id, propertyId })),
          skipDuplicates: true,
        });
      }
    }

    return user;
  };

  // CEO — reports to admin, all properties
  await upsertUser({
    username: "ceo",
    fullName: "Farhan Ahmed",
    email: "farhan@propmgmt.com",
    phone: "0300-1234567",
    roleName: "CEO",
    allProperties: true,
    reportsToUsername: "admin",
  });

  // OPS Lead — reports to CEO, all properties
  await upsertUser({
    username: "opslead",
    fullName: "Saad Malik",
    email: "saad@propmgmt.com",
    phone: "0301-2345678",
    roleName: "OPS Lead",
    allProperties: true,
    reportsToUsername: "ceo",
  });

  // Community Executive 1 — Gulberg Heights + DHA Villas
  await upsertUser({
    username: "ce_ali",
    fullName: "Ali Raza",
    email: "ali@propmgmt.com",
    phone: "0302-3456789",
    roleName: "Community Executive",
    allProperties: false,
    propertyCodeAssignments: ["PROP-001", "PROP-003"],
    reportsToUsername: "opslead",
  });

  // Community Executive 2 — Blue Area Tower
  await upsertUser({
    username: "ce_sara",
    fullName: "Sara Khan",
    email: "sara@propmgmt.com",
    phone: "0303-4567890",
    roleName: "Community Executive",
    allProperties: false,
    propertyCodeAssignments: ["PROP-002"],
    reportsToUsername: "opslead",
  });

  // Manager 1 — under CE Ali, same properties
  await upsertUser({
    username: "lm_hassan",
    fullName: "Hassan Javed",
    email: "hassan@propmgmt.com",
    phone: "0304-5678901",
    roleName: "Manager",
    allProperties: false,
    propertyCodeAssignments: ["PROP-001", "PROP-003"],
    reportsToUsername: "ce_ali",
  });

  // Manager 2 — under CE Sara, Blue Area Tower
  await upsertUser({
    username: "lm_ayesha",
    fullName: "Ayesha Tariq",
    email: "ayesha@propmgmt.com",
    phone: "0305-6789012",
    roleName: "Manager",
    allProperties: false,
    propertyCodeAssignments: ["PROP-002"],
    reportsToUsername: "ce_sara",
  });

  // Supervisor 1 — under LM Hassan
  await upsertUser({
    username: "sup_kamran",
    fullName: "Kamran Akbar",
    email: "kamran@propmgmt.com",
    phone: "0306-7890123",
    roleName: "Supervisor",
    allProperties: false,
    propertyCodeAssignments: ["PROP-001", "PROP-003"],
    reportsToUsername: "lm_hassan",
  });

  // Supervisor 2 — under LM Ayesha
  await upsertUser({
    username: "sup_bilal",
    fullName: "Bilal Asghar",
    email: "bilal@propmgmt.com",
    phone: "0307-8901234",
    roleName: "Supervisor",
    allProperties: false,
    propertyCodeAssignments: ["PROP-002"],
    reportsToUsername: "lm_ayesha",
  });

  // Technician 1 — under Supervisor Kamran (Gulberg + DHA)
  await upsertUser({
    username: "tech_usman",
    fullName: "Usman Ghani",
    email: "usman@propmgmt.com",
    phone: "0308-9012345",
    roleName: "Technician",
    allProperties: false,
    propertyCodeAssignments: ["PROP-001", "PROP-003"],
    reportsToUsername: "sup_kamran",
  });

  // Technician 2 — under Supervisor Kamran (Gulberg + DHA)
  await upsertUser({
    username: "tech_faisal",
    fullName: "Faisal Mehmood",
    email: "faisal@propmgmt.com",
    phone: "0309-0123456",
    roleName: "Technician",
    allProperties: false,
    propertyCodeAssignments: ["PROP-001"],
    reportsToUsername: "sup_kamran",
  });

  // Technician 3 — under Supervisor Bilal (Blue Area)
  await upsertUser({
    username: "tech_zain",
    fullName: "Zain Abbas",
    email: "zain@propmgmt.com",
    phone: "0310-1234567",
    roleName: "Technician",
    allProperties: false,
    propertyCodeAssignments: ["PROP-002"],
    reportsToUsername: "sup_bilal",
  });

  // Technician 4 — under Supervisor Bilal (Blue Area)
  await upsertUser({
    username: "tech_noor",
    fullName: "Noor Fatima",
    email: "noor@propmgmt.com",
    phone: "0311-2345678",
    roleName: "Technician",
    allProperties: false,
    propertyCodeAssignments: ["PROP-002"],
    reportsToUsername: "sup_bilal",
  });

  console.log("All mock users seeded");

  // ─── 9. Seed 10 Tickets ─────────────────────────────────
  const existingTicketCount = await prisma.ticket.count();
  if (existingTicketCount >= 10) {
    console.log(`${existingTicketCount} tickets already exist, skipping ticket seeding`);
    return;
  }

  const maintenanceCat = await prisma.ticketCategory.findUnique({ where: { name: "Maintenance" } });
  const complaintCat = await prisma.ticketCategory.findUnique({ where: { name: "Complaint" } });
  const inspectionCat = await prisma.ticketCategory.findUnique({ where: { name: "Inspection" } });
  const cleaningCat = await prisma.ticketCategory.findUnique({ where: { name: "Cleaning" } });
  const securityCat = await prisma.ticketCategory.findUnique({ where: { name: "Security" } });

  // Get users for assignment
  const techUsman = await prisma.user.findUnique({ where: { username: "tech_usman" } });
  const techFaisal = await prisma.user.findUnique({ where: { username: "tech_faisal" } });
  const techZain = await prisma.user.findUnique({ where: { username: "tech_zain" } });
  const techNoor = await prisma.user.findUnique({ where: { username: "tech_noor" } });
  const supKamran = await prisma.user.findUnique({ where: { username: "sup_kamran" } });
  const supBilal = await prisma.user.findUnique({ where: { username: "sup_bilal" } });

  // Collect unit IDs per property
  const prop1Units = createdUnits.filter((u) => u.propertyCode === "PROP-001");
  const prop2Units = createdUnits.filter((u) => u.propertyCode === "PROP-002");
  const prop3Units = createdUnits.filter((u) => u.propertyCode === "PROP-003");

  const now = new Date();
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);

  const ticketDefs = [
    {
      name: "AC not cooling in Unit 1",
      description: "The split AC in Unit 1 is running but not producing cold air. Tenant reports it has been warm for 2 days.",
      propertyId: createdProperties["PROP-001"],
      unitId: prop1Units[0]?.id,
      dueDate: daysFromNow(3),
      taskType: "MAINTENANCE" as const,
      subTaskType: "REACTIVE" as const,
      categoryId: maintenanceCat!.id,
      priority: "HIGH" as const,
      assignedToId: techUsman?.id,
    },
    {
      name: "Water leak in 2nd floor bathroom",
      description: "Persistent water leak from the ceiling of the 2nd floor bathroom. Possibly from the unit above.",
      propertyId: createdProperties["PROP-001"],
      unitId: prop1Units[2]?.id,
      dueDate: daysFromNow(1),
      taskType: "COMPLAIN" as const,
      subTaskType: "REACTIVE" as const,
      categoryId: complaintCat!.id,
      priority: "CRITICAL" as const,
      assignedToId: techFaisal?.id,
    },
    {
      name: "Monthly fire extinguisher inspection",
      description: "Routine monthly check of all fire extinguishers across the building. Check expiry, pressure gauge, and physical condition.",
      propertyId: createdProperties["PROP-001"],
      unitId: prop1Units[1]?.id,
      dueDate: daysFromNow(7),
      taskType: "INSPECT" as const,
      subTaskType: "PREVENTIVE" as const,
      categoryId: inspectionCat!.id,
      priority: "MEDIUM" as const,
      assignedToId: supKamran?.id,
    },
    {
      name: "Elevator maintenance check",
      description: "Quarterly preventive maintenance for the passenger elevator. Check cables, motor, and emergency systems.",
      propertyId: createdProperties["PROP-002"],
      unitId: prop2Units[0]?.id,
      dueDate: daysFromNow(5),
      taskType: "MAINTENANCE" as const,
      subTaskType: "PREVENTIVE" as const,
      categoryId: maintenanceCat!.id,
      priority: "HIGH" as const,
      assignedToId: techZain?.id,
    },
    {
      name: "Broken window in Office 3",
      description: "A window pane in Office 3 is cracked and needs immediate replacement for safety.",
      propertyId: createdProperties["PROP-002"],
      unitId: prop2Units[2]?.id,
      dueDate: daysFromNow(2),
      taskType: "COMPLAIN" as const,
      subTaskType: "REACTIVE" as const,
      categoryId: complaintCat!.id,
      priority: "HIGH" as const,
      assignedToId: techNoor?.id,
    },
    {
      name: "Deep cleaning of common areas",
      description: "Full deep cleaning of lobby, corridors, and parking area of Blue Area Tower.",
      propertyId: createdProperties["PROP-002"],
      unitId: prop2Units[1]?.id,
      dueDate: daysFromNow(4),
      taskType: "TASK" as const,
      subTaskType: "PREVENTIVE" as const,
      categoryId: cleaningCat!.id,
      priority: "LOW" as const,
      assignedToId: supBilal?.id,
    },
    {
      name: "CCTV camera not recording",
      description: "The CCTV camera at the main gate of DHA Villas has stopped recording. The DVR shows no feed from camera 3.",
      propertyId: createdProperties["PROP-003"],
      unitId: prop3Units[0]?.id,
      dueDate: daysFromNow(1),
      taskType: "COMPLAIN" as const,
      subTaskType: "REACTIVE" as const,
      categoryId: securityCat!.id,
      priority: "CRITICAL" as const,
      assignedToId: techUsman?.id,
    },
    {
      name: "Garden irrigation system repair",
      description: "The sprinkler system in Block B garden area has multiple broken heads and low pressure.",
      propertyId: createdProperties["PROP-003"],
      unitId: prop3Units[1]?.id,
      dueDate: daysFromNow(6),
      taskType: "MAINTENANCE" as const,
      subTaskType: "REACTIVE" as const,
      categoryId: maintenanceCat!.id,
      priority: "MEDIUM" as const,
      // Unassigned — to test unassigned ticket visibility
    },
    {
      name: "Electrical panel inspection",
      description: "Annual inspection of main electrical distribution panels in all three properties. Check for overheating, loose connections.",
      propertyId: createdProperties["PROP-001"],
      unitId: prop1Units[3]?.id,
      dueDate: daysFromNow(10),
      taskType: "INSPECT" as const,
      subTaskType: "PREVENTIVE" as const,
      categoryId: inspectionCat!.id,
      priority: "MEDIUM" as const,
      // Unassigned
    },
    {
      name: "Parking barrier malfunction",
      description: "The automated parking barrier at the main entrance is not opening/closing properly. Manual override required.",
      propertyId: createdProperties["PROP-002"],
      unitId: prop2Units[3]?.id,
      dueDate: daysFromNow(2),
      taskType: "MAINTENANCE" as const,
      subTaskType: "REACTIVE" as const,
      categoryId: maintenanceCat!.id,
      priority: "HIGH" as const,
      assignedToId: techZain?.id,
    },
  ];

  for (const ticketDef of ticketDefs) {
    if (!ticketDef.unitId || !ticketDef.propertyId) {
      console.log(`Skipping ticket "${ticketDef.name}" — missing unit or property`);
      continue;
    }

    const ticketNumber = `TKT${String(await prisma.ticket.count() + 1).padStart(4, "0")}`;
    await prisma.ticket.create({
        // @ts-ignore - departmentId may not exist in mock seeding context
      data: {
        ticketNumber,
        name: ticketDef.name,
        description: ticketDef.description,
        propertyId: ticketDef.propertyId,
        unitId: ticketDef.unitId,
        dueDate: ticketDef.dueDate,
        taskType: ticketDef.taskType,
        subTaskType: ticketDef.subTaskType,
        categoryId: ticketDef.categoryId,
        priority: ticketDef.priority,
        assignedToId: ticketDef.assignedToId,
      },
    });
    console.log(`Seeded ticket: ${ticketDef.name}`);
  }

  console.log("Seed complete!");
}
