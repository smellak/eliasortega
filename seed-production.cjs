#!/usr/bin/env node
/**
 * Production seed script — creates admin user and default slot templates.
 * Safe to run multiple times: skips resources that already exist.
 *
 * Usage: node seed-production.js
 * Requires: DATABASE_URL environment variable
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const DEFAULT_SLOTS = [
  // Lunes a Viernes: 08:00-10:00, 10:00-12:00, 12:00-14:00 (6 pts)
  { dayOfWeek: 1, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 1, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 1, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  { dayOfWeek: 2, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 2, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 2, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  { dayOfWeek: 3, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 3, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 3, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  { dayOfWeek: 4, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 4, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 4, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  { dayOfWeek: 5, startTime: "08:00", endTime: "10:00", maxPoints: 6 },
  { dayOfWeek: 5, startTime: "10:00", endTime: "12:00", maxPoints: 6 },
  { dayOfWeek: 5, startTime: "12:00", endTime: "14:00", maxPoints: 6 },
  // Lunes a Viernes: 14:00-16:00, 16:00-18:00 (6 pts), 18:00-20:00 (4 pts)
  { dayOfWeek: 1, startTime: "14:00", endTime: "16:00", maxPoints: 6 },
  { dayOfWeek: 1, startTime: "16:00", endTime: "18:00", maxPoints: 6 },
  { dayOfWeek: 1, startTime: "18:00", endTime: "20:00", maxPoints: 4 },
  { dayOfWeek: 2, startTime: "14:00", endTime: "16:00", maxPoints: 6 },
  { dayOfWeek: 2, startTime: "16:00", endTime: "18:00", maxPoints: 6 },
  { dayOfWeek: 2, startTime: "18:00", endTime: "20:00", maxPoints: 4 },
  { dayOfWeek: 3, startTime: "14:00", endTime: "16:00", maxPoints: 6 },
  { dayOfWeek: 3, startTime: "16:00", endTime: "18:00", maxPoints: 6 },
  { dayOfWeek: 3, startTime: "18:00", endTime: "20:00", maxPoints: 4 },
  { dayOfWeek: 4, startTime: "14:00", endTime: "16:00", maxPoints: 6 },
  { dayOfWeek: 4, startTime: "16:00", endTime: "18:00", maxPoints: 6 },
  { dayOfWeek: 4, startTime: "18:00", endTime: "20:00", maxPoints: 4 },
  { dayOfWeek: 5, startTime: "14:00", endTime: "16:00", maxPoints: 6 },
  { dayOfWeek: 5, startTime: "16:00", endTime: "18:00", maxPoints: 6 },
  { dayOfWeek: 5, startTime: "18:00", endTime: "20:00", maxPoints: 4 },
  // Sabado: 08:00-11:00, 11:00-14:00 (4 pts)
  { dayOfWeek: 6, startTime: "08:00", endTime: "11:00", maxPoints: 4 },
  { dayOfWeek: 6, startTime: "11:00", endTime: "14:00", maxPoints: 4 },
];

async function seed() {
  console.log("[seed] Iniciando seed de produccion...");

  // 1. Usuario admin
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@admin.com" },
  });

  if (existingAdmin) {
    console.log("[seed] Usuario admin@admin.com ya existe, saltando.");
  } else {
    const hash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        email: "admin@admin.com",
        passwordHash: hash,
        role: "ADMIN",
      },
    });
    console.log("[seed] Usuario admin creado: admin@admin.com");
  }

  // 2. Plantillas de slots (per-slot upsert — additive & idempotent)
  let created = 0;
  for (const slot of DEFAULT_SLOTS) {
    const existing = await prisma.slotTemplate.findFirst({
      where: {
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    });
    if (!existing) {
      await prisma.slotTemplate.create({
        data: {
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxPoints: slot.maxPoints,
          active: true,
        },
      });
      created++;
    }
  }
  if (created > 0) {
    console.log("[seed] Creadas " + created + " plantillas de slots nuevas.");
  } else {
    console.log("[seed] Todas las plantillas de slots ya existen, nada que crear.");
  }

  console.log("[seed] Seed completado.");
}

seed()
  .catch(function (err) {
    console.error("[seed] Error:", err);
    process.exit(1);
  })
  .finally(function () {
    return prisma.$disconnect();
  });
