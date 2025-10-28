import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { passwordHash: adminPassword },
    create: {
      email: "admin@example.com",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("Created admin user:", admin.email);

  // Create planner user
  const plannerPassword = await bcrypt.hash("planner123", 10);
  const planner = await prisma.user.upsert({
    where: { email: "planner@example.com" },
    update: { passwordHash: plannerPassword },
    create: {
      email: "planner@example.com",
      passwordHash: plannerPassword,
      role: "PLANNER",
    },
  });
  console.log("Created planner user:", planner.email);

  // Create read-only user
  const viewerPassword = await bcrypt.hash("viewer123", 10);
  const viewer = await prisma.user.upsert({
    where: { email: "viewer@example.com" },
    update: { passwordHash: viewerPassword },
    create: {
      email: "viewer@example.com",
      passwordHash: viewerPassword,
      role: "BASIC_READONLY",
    },
  });
  console.log("Created viewer user:", viewer.email);

  // Create demo providers
  const providers = [
    { name: "Acme Corp", notes: "Main electronics supplier" },
    { name: "Global Logistics", notes: "International shipping partner" },
    { name: "Fast Shipping Inc", notes: "Express deliveries only" },
  ];

  for (const providerData of providers) {
    const provider = await prisma.provider.upsert({
      where: { name: providerData.name },
      update: {},
      create: providerData,
    });
    console.log("Created provider:", provider.name);
  }

  // Create capacity shifts for one week (Monday to Friday, 08:00-16:00 Europe/Madrid)
  // Convert to UTC (Europe/Madrid is UTC+1 in winter, UTC+2 in summer)
  // Using a recent date in October 2025 (UTC+2)
  const shifts: any[] = [];
  const baseDate = new Date("2025-10-27"); // Monday
  
  for (let i = 0; i < 5; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    
    // 08:00 Europe/Madrid = 06:00 UTC (in summer time UTC+2)
    const startUtc = new Date(date.toISOString().split("T")[0] + "T06:00:00.000Z");
    // 16:00 Europe/Madrid = 14:00 UTC
    const endUtc = new Date(date.toISOString().split("T")[0] + "T14:00:00.000Z");

    const shift = await prisma.capacityShift.create({
      data: {
        startUtc,
        endUtc,
        workers: 3,
        forklifts: 2,
        docks: 3,
      },
    });
    shifts.push(shift);
    console.log(`Created shift for ${date.toISOString().split("T")[0]}: ${startUtc.toISOString()} - ${endUtc.toISOString()}`);
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
