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

  // --- AppConfig defaults ---
  var DEFAULT_CONFIGS = [
    { key: "confirmation_email_enabled", value: "true", description: "Enviar email de confirmación al crear cita con email de proveedor" },
    { key: "reminder_email_enabled", value: "true", description: "Enviar recordatorio 48h antes de la cita" },
    { key: "provider_email_extra_text", value: "", description: "Texto adicional en emails al proveedor" },
    { key: "provider_email_contact_phone", value: "", description: "Teléfono de contacto del almacén en emails" },
    { key: "dock_buffer_minutes", value: "15", description: "Minutos de buffer entre descargas en el mismo muelle" },
    { key: "dock_assignment_enabled", value: "true", description: "Activar asignación automática de muelles" },
  ];

  var configCreated = 0;
  for (var ci = 0; ci < DEFAULT_CONFIGS.length; ci++) {
    var cfg = DEFAULT_CONFIGS[ci];
    var existingCfg = await prisma.appConfig.findUnique({ where: { key: cfg.key } });
    if (!existingCfg) {
      await prisma.appConfig.create({ data: cfg });
      configCreated++;
    }
  }
  if (configCreated > 0) {
    console.log("[seed] Creadas " + configCreated + " configuraciones nuevas.");
  } else {
    console.log("[seed] Todas las configuraciones ya existen.");
  }

  // --- Docks ---
  var DEFAULT_DOCKS = [
    { name: "Muelle 1", code: "M1", sortOrder: 1 },
    { name: "Muelle 2", code: "M2", sortOrder: 2 },
    { name: "Muelle 3", code: "M3", sortOrder: 3 },
  ];

  for (var di = 0; di < DEFAULT_DOCKS.length; di++) {
    var d = DEFAULT_DOCKS[di];
    await prisma.dock.upsert({
      where: { code: d.code },
      update: {},
      create: { name: d.name, code: d.code, sortOrder: d.sortOrder },
    });
  }
  console.log("[seed] Docks upserted: " + DEFAULT_DOCKS.length);

  // --- DockSlotAvailability ---
  var allTemplates = await prisma.slotTemplate.findMany({ where: { active: true } });
  var allDocks = await prisma.dock.findMany();
  var availCreated = 0;
  for (var ti = 0; ti < allTemplates.length; ti++) {
    var tpl = allTemplates[ti];
    for (var dj = 0; dj < allDocks.length; dj++) {
      var dock = allDocks[dj];
      var existing = await prisma.dockSlotAvailability.findUnique({
        where: { dockId_slotTemplateId: { dockId: dock.id, slotTemplateId: tpl.id } },
      });
      if (!existing) {
        await prisma.dockSlotAvailability.create({
          data: { dockId: dock.id, slotTemplateId: tpl.id, isActive: true },
        });
        availCreated++;
      }
    }
  }
  console.log("[seed] Dock availabilities: " + availCreated + " created");

  // --- Round-robin dock assignment for existing appointments without dockId ---
  var unassigned = await prisma.appointment.findMany({
    where: { dockId: null },
    orderBy: { startUtc: "asc" },
  });
  if (unassigned.length > 0) {
    for (var ai = 0; ai < unassigned.length; ai++) {
      var assignDock = allDocks[ai % allDocks.length];
      await prisma.appointment.update({
        where: { id: unassigned[ai].id },
        data: { dockId: assignDock.id },
      });
    }
    console.log("[seed] Assigned docks to " + unassigned.length + " existing appointments (round-robin)");
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
