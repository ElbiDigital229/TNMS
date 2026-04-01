import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TALHA = "d3eaab01-770d-4b34-a607-824092600331";

// Blocking candidates
const IVAN   = "7c820755-2bae-4adc-94ac-d9cd1caf773c";  // Yellow Bar
const FRANK  = "33236fce-2fdc-45ed-bed5-94f0e0b8b17b";  // Facility
const CAROL  = "a6b6178d-3296-4e2f-9c07-3bb9efb5be09";  // Management
const GEORGE = "76002c11-754e-410d-ac20-519276e36422";  // Yellow Bar

// Departments
const DEPT_FACILITY   = "54459a58-b2cb-4d66-a814-83f98505a595";
const DEPT_MANAGEMENT = "9aeebb1d-0cbf-4cd5-9a19-49cfb7e2edb7";
const DEPT_YELLOWBAR  = "6a0608f8-001f-4d4e-a8d0-9a9f018c15c3";

// Categories
const CAT_ELECTRICAL  = "3c3668d7-0701-4bff-8d7d-624862b2506e";
const CAT_PLUMBING    = "016ea569-21bb-4d35-893b-5d32325e5425";
const CAT_HVAC        = "13522ca3-f8fe-4791-b74c-97426140b423";
const CAT_CLEANING    = "9cb24ae9-1673-411c-9232-2553f325d4cd";
const CAT_CARPENTRY   = "13aa0fd1-2ca9-4de2-83f8-cea26a4e7f77";
const CAT_PAINTING    = "63570122-41ab-42ef-9a61-71e7dd2c728e";
const CAT_APPLIANCE   = "e8b8998d-a3e2-497c-8995-8bfc64d45ec3";
const CAT_PEST        = "257b4b17-f96b-4dd7-84c5-5e73ad747df5";
const CAT_SECURITY    = "157b85e1-c3c2-4cc9-97c5-953260760f23";
const CAT_IT          = "b7cbf17a-5e9f-4625-8418-88b0d76401d8";
const CAT_GENERAL     = "4c34c357-8150-417d-bdfc-36a9ff5a44ba";
const CAT_FIRE        = "d20fc2b0-e002-44f0-8350-cf2b619e908e";

// Properties + Units
const P_ALPHA    = "d99efc97-2df3-4c77-a505-5452363bb4af";
const P_NORTH    = "e5683a39-12ef-4dc8-80f2-4e1bda9e3d88";
const P_VANGUARD = "8a0082ca-aa08-4da1-89c1-d2ac6dfb1f38";
const P_FAIRWAYS = "4438a677-8df9-43c5-85e7-6af89fd43d33";
const P_ONE      = "fc59da71-9a84-4dea-bf0c-cec44f628c4a";

const U_ALPHA_RECEPTION  = "59864e16-0504-4cb3-95df-6995479c3e34";
const U_ALPHA_WAITING    = "12330858-fd44-4a03-821c-f126c1f4daad";
const U_NORTH_RECEPTION  = "c8bf217c-01ad-4d2d-8467-d429d5ba9342";
const U_NORTH_WAITING    = "5a8b0588-1ab5-4dd8-9a1f-cc0c288ecf7b";
const U_VANGUARD_LOUNGE  = "83975586-bd0b-4838-a4fc-4304158c63b0";
const U_VANGUARD_G04     = "751993cf-f5b5-4857-822d-c4081aabaa40";
const U_FAIRWAYS_HR02    = "5afe275e-0fe8-4cce-b146-8d33f9168ef0";
const U_FAIRWAYS_LOUNGE  = "7f6762a7-4cee-4cd5-a4d7-0ac81ba84bc7";
const U_ONE_LOBBY        = "57a6e419-1505-4bc1-b617-6a43feda8f83";
const U_ONE_201          = "fc19529b-8c53-4809-8f8d-135413182737";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(18, 0, 0, 0);
  return d;
}

async function getNextTicketNumber(): Promise<string> {
  const last = await prisma.ticket.findFirst({ orderBy: { ticketNumber: "desc" } });
  if (!last) return "TKT0001";
  const num = parseInt(last.ticketNumber.replace("TKT", ""), 10);
  return `TKT${String(num + 1).padStart(4, "0")}`;
}

async function createTicket(data: {
  name: string;
  description: string;
  propertyId: string;
  unitId: string;
  dueDate: Date;
  createdAt: Date;
  taskType: "COMPLAIN" | "MAINTENANCE" | "INSPECT" | "TASK";
  subTaskType: "REACTIVE" | "PREVENTIVE";
  categoryId: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  departmentId: string;
  status: "OPEN" | "IN_PROGRESS" | "OVERDUE" | "COMPLETED";
  completedAt?: Date;
}) {
  const ticketNumber = await getNextTicketNumber();
  return prisma.ticket.create({
    data: {
      ticketNumber,
      name: data.name,
      description: data.description,
      propertyId: data.propertyId,
      unitId: data.unitId,
      dueDate: data.dueDate,
      createdAt: data.createdAt,
      taskType: data.taskType,
      subTaskType: data.subTaskType,
      categoryId: data.categoryId,
      priority: data.priority,
      departmentId: data.departmentId,
      assignedToId: TALHA,
      createdById: TALHA,
      status: data.status,
      completedAt: data.completedAt ?? null,
    },
  });
}

async function main() {
  console.log("Seeding 20 tickets for Talha...");

  // ─── 10 COMPLETED ON TIME ─────────────────────────────────────────────────
  // These were created in the past, had a future due date, and completed before it

  const t1 = await createTicket({
    name: "AC unit not cooling in Reception",
    description: "The central AC in Alpha reception is not cooling properly. Temperature above 30°C.",
    propertyId: P_ALPHA, unitId: U_ALPHA_RECEPTION,
    createdAt: daysAgo(45), dueDate: daysAgo(38),
    taskType: "COMPLAIN", subTaskType: "REACTIVE",
    categoryId: CAT_HVAC, priority: "HIGH", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(40),
  });

  const t2 = await createTicket({
    name: "Leaking pipe under kitchen sink",
    description: "Water dripping from under the sink in the staff kitchen. Floor getting wet.",
    propertyId: P_ALPHA, unitId: U_ALPHA_WAITING,
    createdAt: daysAgo(40), dueDate: daysAgo(33),
    taskType: "COMPLAIN", subTaskType: "REACTIVE",
    categoryId: CAT_PLUMBING, priority: "CRITICAL", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(36),
  });

  const t3 = await createTicket({
    name: "Broken light fixture in Waiting Area",
    description: "Two ceiling lights are flickering and one has gone out completely.",
    propertyId: P_NORTH, unitId: U_NORTH_WAITING,
    createdAt: daysAgo(35), dueDate: daysAgo(28),
    taskType: "COMPLAIN", subTaskType: "REACTIVE",
    categoryId: CAT_ELECTRICAL, priority: "MEDIUM", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(30),
  });

  const t4 = await createTicket({
    name: "Quarterly pest control inspection",
    description: "Scheduled Q1 pest control treatment for all common areas.",
    propertyId: P_NORTH, unitId: U_NORTH_RECEPTION,
    createdAt: daysAgo(60), dueDate: daysAgo(53),
    taskType: "INSPECT", subTaskType: "PREVENTIVE",
    categoryId: CAT_PEST, priority: "LOW", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(55),
  });

  const t5 = await createTicket({
    name: "Security camera offline - G04",
    description: "Camera on floor G04 is showing offline in the dashboard. Needs hardware check.",
    propertyId: P_VANGUARD, unitId: U_VANGUARD_G04,
    createdAt: daysAgo(30), dueDate: daysAgo(23),
    taskType: "COMPLAIN", subTaskType: "REACTIVE",
    categoryId: CAT_SECURITY, priority: "HIGH", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(25),
  });

  const t6 = await createTicket({
    name: "Repaint scuffed walls in Reception Lounge",
    description: "Multiple scuff marks and scratches on walls near elevator. Needs touch-up painting.",
    propertyId: P_VANGUARD, unitId: U_VANGUARD_LOUNGE,
    createdAt: daysAgo(55), dueDate: daysAgo(44),
    taskType: "MAINTENANCE", subTaskType: "PREVENTIVE",
    categoryId: CAT_PAINTING, priority: "LOW", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(47),
  });

  const t7 = await createTicket({
    name: "Office chair repairs - HR-02",
    description: "Three chairs have broken armrests and one has a faulty height mechanism.",
    propertyId: P_FAIRWAYS, unitId: U_FAIRWAYS_HR02,
    createdAt: daysAgo(25), dueDate: daysAgo(18),
    taskType: "MAINTENANCE", subTaskType: "REACTIVE",
    categoryId: CAT_CARPENTRY, priority: "LOW", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(20),
  });

  const t8 = await createTicket({
    name: "Fire alarm test - Yellow Bar Lounge",
    description: "Monthly fire alarm functional test as per safety schedule.",
    propertyId: P_FAIRWAYS, unitId: U_FAIRWAYS_LOUNGE,
    createdAt: daysAgo(20), dueDate: daysAgo(13),
    taskType: "INSPECT", subTaskType: "PREVENTIVE",
    categoryId: CAT_FIRE, priority: "MEDIUM", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(15),
  });

  const t9 = await createTicket({
    name: "Network switch replacement - 201",
    description: "The old network switch is failing intermittently causing connectivity drops.",
    propertyId: P_ONE, unitId: U_ONE_201,
    createdAt: daysAgo(18), dueDate: daysAgo(11),
    taskType: "MAINTENANCE", subTaskType: "REACTIVE",
    categoryId: CAT_IT, priority: "HIGH", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(13),
  });

  const t10 = await createTicket({
    name: "Deep clean Reception Lobby",
    description: "Full deep cleaning of lobby including carpets, windows, and high surfaces.",
    propertyId: P_ONE, unitId: U_ONE_LOBBY,
    createdAt: daysAgo(15), dueDate: daysAgo(8),
    taskType: "MAINTENANCE", subTaskType: "PREVENTIVE",
    categoryId: CAT_CLEANING, priority: "MEDIUM", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(10),
  });

  console.log("✓ 10 completed on time");

  // ─── 6 COMPLETED LATE ─────────────────────────────────────────────────────

  const t11 = await createTicket({
    name: "Elevator button panel malfunction",
    description: "Floor 3 and 4 buttons on elevator B are unresponsive.",
    propertyId: P_ALPHA, unitId: U_ALPHA_RECEPTION,
    createdAt: daysAgo(50), dueDate: daysAgo(43),
    taskType: "COMPLAIN", subTaskType: "REACTIVE",
    categoryId: CAT_ELECTRICAL, priority: "CRITICAL", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(38), // 5 days late
  });

  const t12 = await createTicket({
    name: "Broken door lock - Waiting Area",
    description: "Electronic lock on the waiting area door is stuck in the locked position.",
    propertyId: P_NORTH, unitId: U_NORTH_WAITING,
    createdAt: daysAgo(42), dueDate: daysAgo(35),
    taskType: "COMPLAIN", subTaskType: "REACTIVE",
    categoryId: CAT_SECURITY, priority: "HIGH", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(28), // 7 days late
  });

  const t13 = await createTicket({
    name: "Appliance service - coffee machine",
    description: "Coffee machine in staff lounge throwing error E05 and not heating.",
    propertyId: P_VANGUARD, unitId: U_VANGUARD_LOUNGE,
    createdAt: daysAgo(38), dueDate: daysAgo(31),
    taskType: "MAINTENANCE", subTaskType: "REACTIVE",
    categoryId: CAT_APPLIANCE, priority: "MEDIUM", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(24), // 7 days late
  });

  const t14 = await createTicket({
    name: "Roof drainage blockage",
    description: "Water pooling on rooftop due to blocked drainage. Risk of leakage.",
    propertyId: P_FAIRWAYS, unitId: U_FAIRWAYS_HR02,
    createdAt: daysAgo(33), dueDate: daysAgo(26),
    taskType: "COMPLAIN", subTaskType: "REACTIVE",
    categoryId: CAT_PLUMBING, priority: "HIGH", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(18), // 8 days late
  });

  const t15 = await createTicket({
    name: "Carpet replacement - HR-02",
    description: "Office carpet severely worn in high-traffic areas. Needs replacing.",
    propertyId: P_FAIRWAYS, unitId: U_FAIRWAYS_HR02,
    createdAt: daysAgo(28), dueDate: daysAgo(21),
    taskType: "MAINTENANCE", subTaskType: "PREVENTIVE",
    categoryId: CAT_GENERAL, priority: "LOW", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(12), // 9 days late
  });

  const t16 = await createTicket({
    name: "Generator service and fuel check",
    description: "Backup generator requires 6-monthly service. Fuel level at 30%.",
    propertyId: P_ONE, unitId: U_ONE_201,
    createdAt: daysAgo(22), dueDate: daysAgo(15),
    taskType: "INSPECT", subTaskType: "PREVENTIVE",
    categoryId: CAT_GENERAL, priority: "HIGH", departmentId: DEPT_FACILITY,
    status: "COMPLETED", completedAt: daysAgo(7), // 8 days late
  });

  console.log("✓ 6 completed late");

  // ─── 2 OVERDUE ────────────────────────────────────────────────────────────

  const t17 = await createTicket({
    name: "Water heater failure - staff bathroom",
    description: "Hot water not available in staff bathroom. Thermostat may be faulty.",
    propertyId: P_ALPHA, unitId: U_ALPHA_WAITING,
    createdAt: daysAgo(12), dueDate: daysAgo(5),
    taskType: "COMPLAIN", subTaskType: "REACTIVE",
    categoryId: CAT_PLUMBING, priority: "HIGH", departmentId: DEPT_FACILITY,
    status: "OVERDUE",
  });

  const t18 = await createTicket({
    name: "Mold growth inspection - North Reception",
    description: "Visible mold patches near window seals in reception area. Urgent inspection needed.",
    propertyId: P_NORTH, unitId: U_NORTH_RECEPTION,
    createdAt: daysAgo(10), dueDate: daysAgo(3),
    taskType: "INSPECT", subTaskType: "REACTIVE",
    categoryId: CAT_CLEANING, priority: "CRITICAL", departmentId: DEPT_FACILITY,
    status: "OVERDUE",
  });

  console.log("✓ 2 overdue");

  // ─── 1 IN PROGRESS ───────────────────────────────────────────────────────

  const t19 = await createTicket({
    name: "CCTV system upgrade - Vanguard",
    description: "Replacing legacy CCTV system with IP camera network across all floors.",
    propertyId: P_VANGUARD, unitId: U_VANGUARD_LOUNGE,
    createdAt: daysAgo(5), dueDate: daysFromNow(5),
    taskType: "MAINTENANCE", subTaskType: "PREVENTIVE",
    categoryId: CAT_SECURITY, priority: "MEDIUM", departmentId: DEPT_FACILITY,
    status: "IN_PROGRESS",
  });

  console.log("✓ 1 in progress");

  // ─── 1 OPEN ──────────────────────────────────────────────────────────────

  const t20 = await createTicket({
    name: "Solar panel cleaning - rooftop",
    description: "Quarterly cleaning of solar panels required. Efficiency has dropped 15%.",
    propertyId: P_ONE, unitId: U_ONE_LOBBY,
    createdAt: daysAgo(2), dueDate: daysFromNow(10),
    taskType: "MAINTENANCE", subTaskType: "PREVENTIVE",
    categoryId: CAT_GENERAL, priority: "LOW", departmentId: DEPT_FACILITY,
    status: "OPEN",
  });

  console.log("✓ 1 open");

  // ─── TICKET ACTIVITIES for all ───────────────────────────────────────────
  // Add CREATED activity for all tickets
  const allTickets = [t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16,t17,t18,t19,t20];
  for (const t of allTickets) {
    await prisma.ticketActivity.create({
      data: { ticketId: t.id, action: "CREATED", details: "Ticket created", performedById: TALHA },
    });
  }

  // Add STATUS_CHANGED activity for completed tickets
  const completedTickets = [t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16];
  for (const t of completedTickets) {
    await prisma.ticketActivity.create({
      data: { ticketId: t.id, action: "STATUS_CHANGED", details: "Status changed to COMPLETED", performedById: TALHA, createdAt: t.completedAt! },
    });
  }

  console.log("✓ Activities added");

  // ─── BLOCKS raised BY TALHA (he blocked someone on 3 tickets) ────────────

  // Block 1: Talha blocked Management dept on t12 (completed late) — RESOLVED
  // This was resolved when the ticket completed
  await prisma.ticketBlock.create({
    data: {
      ticketId: t12.id,
      blockedById: TALHA,
      blockingUserId: CAROL,
      departmentId: DEPT_MANAGEMENT,
      reason: "Waiting for management approval to replace the electronic lock with a new vendor.",
      previousStatus: "IN_PROGRESS",
      resolvedAt: daysAgo(29),
      resolvedById: CAROL,
      resolvedNote: "Approval granted. Vendor confirmed.",
    },
  });

  // Block 2: Talha blocked Yellow Bar dept on t14 (completed late) — RESOLVED
  await prisma.ticketBlock.create({
    data: {
      ticketId: t14.id,
      blockedById: TALHA,
      blockingUserId: GEORGE,
      departmentId: DEPT_YELLOWBAR,
      reason: "Need Yellow Bar team to clear rooftop storage before drainage work can begin.",
      previousStatus: "IN_PROGRESS",
      resolvedAt: daysAgo(20),
      resolvedById: GEORGE,
      resolvedNote: "Rooftop cleared. Talha can proceed.",
    },
  });

  // Block 3: Talha blocked Management on t17 (currently OVERDUE) — ACTIVE
  await prisma.ticketBlock.create({
    data: {
      ticketId: t17.id,
      blockedById: TALHA,
      blockingUserId: CAROL,
      departmentId: DEPT_MANAGEMENT,
      reason: "Waiting for management to approve the replacement water heater purchase (PKR 45,000).",
      previousStatus: "IN_PROGRESS",
      // resolvedAt is null — still active block
    },
  });

  // Block 4: Talha blocked Yellow Bar on t13 (completed late) — RESOLVED
  await prisma.ticketBlock.create({
    data: {
      ticketId: t13.id,
      blockedById: TALHA,
      blockingUserId: IVAN,
      departmentId: DEPT_YELLOWBAR,
      reason: "Spare parts for coffee machine need to be ordered through Yellow Bar procurement.",
      previousStatus: "OPEN",
      resolvedAt: daysAgo(25),
      resolvedById: IVAN,
      resolvedNote: "Parts ordered and delivered.",
    },
  });

  // Add BLOCKED/UNBLOCKED activities
  await prisma.ticketActivity.create({
    data: { ticketId: t12.id, action: "BLOCKED", details: "Talha Facility blocked — waiting on Management (Carol Test). Reason: Waiting for management approval to replace the electronic lock with a new vendor.", performedById: TALHA, createdAt: daysAgo(33) },
  });
  await prisma.ticketActivity.create({
    data: { ticketId: t12.id, action: "UNBLOCKED", details: "Block resolved by Carol Test. Note: Approval granted. Vendor confirmed.", performedById: CAROL, createdAt: daysAgo(29) },
  });

  await prisma.ticketActivity.create({
    data: { ticketId: t14.id, action: "BLOCKED", details: "Talha Facility blocked — waiting on Yellow Bar (George Test). Reason: Need Yellow Bar team to clear rooftop storage.", performedById: TALHA, createdAt: daysAgo(28) },
  });
  await prisma.ticketActivity.create({
    data: { ticketId: t14.id, action: "UNBLOCKED", details: "Block resolved by George Test. Note: Rooftop cleared.", performedById: GEORGE, createdAt: daysAgo(20) },
  });

  await prisma.ticketActivity.create({
    data: { ticketId: t17.id, action: "BLOCKED", details: "Talha Facility blocked — waiting on Management (Carol Test). Reason: Waiting for management to approve water heater purchase.", performedById: TALHA, createdAt: daysAgo(6) },
  });

  await prisma.ticketActivity.create({
    data: { ticketId: t13.id, action: "BLOCKED", details: "Talha Facility blocked — waiting on Yellow Bar (Ivan Test). Reason: Spare parts need to be ordered through Yellow Bar procurement.", performedById: TALHA, createdAt: daysAgo(36) },
  });
  await prisma.ticketActivity.create({
    data: { ticketId: t13.id, action: "UNBLOCKED", details: "Block resolved by Ivan Test. Note: Parts ordered and delivered.", performedById: IVAN, createdAt: daysAgo(25) },
  });

  console.log("✓ 4 blocks added (3 resolved, 1 active on t17)");

  console.log("\n=== DONE ===");
  console.log(`Total tickets: ${allTickets.length}`);
  console.log("Completed on time: 10 (50%)");
  console.log("Completed late:    6 (30%)");
  console.log("Total completed:   16 (80%)");
  console.log("Overdue:           2 (10%)");
  console.log("In Progress:       1 (5%)");
  console.log("Open:              1 (5%)");
  console.log("Blocks raised by Talha: 4 (3 resolved, 1 active)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
