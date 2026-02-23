#!/usr/bin/env node
/**
 * Script para crear usuarios en la base de datos de PRODUCCION
 *
 * IMPORTANTE: Este script debe ejecutarse contra la base de datos de PRODUCCION
 * CAMBIAR EN PRODUCCION: Las passwords por defecto deben cambiarse inmediatamente
 * despues del primer login usando PUT /api/auth/change-password
 *
 * Para ejecutar:
 * 1. Asegurate de que DATABASE_URL apunte a produccion
 * 2. Ejecuta: node seed-production.js
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedProduction() {
  console.log("Iniciando seed de base de datos de PRODUCCION...");
  console.log("ADVERTENCIA: Este script modificara la base de datos de PRODUCCION");
  console.log("");

  try {
    // CAMBIAR EN PRODUCCION — cambiar password tras primer login
    const adminPassword = await bcrypt.hash("CHS-Admin-2026!", 10);
    const admin = await prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {
        passwordHash: adminPassword,
        role: "ADMIN"
      },
      create: {
        email: "admin@example.com",
        passwordHash: adminPassword,
        role: "ADMIN",
      },
    });
    console.log("Usuario admin creado/actualizado:", admin.email);

    // CAMBIAR EN PRODUCCION
    const plannerPassword = await bcrypt.hash("CHS-Planner-2026!", 10);
    const planner = await prisma.user.upsert({
      where: { email: "planner@example.com" },
      update: {
        passwordHash: plannerPassword,
        role: "PLANNER"
      },
      create: {
        email: "planner@example.com",
        passwordHash: plannerPassword,
        role: "PLANNER",
      },
    });
    console.log("Usuario planner creado/actualizado:", planner.email);

    // CAMBIAR EN PRODUCCION
    const viewerPassword = await bcrypt.hash("CHS-Viewer-2026!", 10);
    const viewer = await prisma.user.upsert({
      where: { email: "viewer@example.com" },
      update: {
        passwordHash: viewerPassword,
        role: "BASIC_READONLY"
      },
      create: {
        email: "viewer@example.com",
        passwordHash: viewerPassword,
        role: "BASIC_READONLY",
      },
    });
    console.log("Usuario viewer creado/actualizado:", viewer.email);

    console.log("");
    console.log("Seed de produccion completado exitosamente!");
    console.log("");
    console.log("Credenciales de acceso (CAMBIAR TRAS PRIMER LOGIN):");
    console.log("   Admin:    admin@example.com / CHS-Admin-2026!");
    console.log("   Planner:  planner@example.com / CHS-Planner-2026!");
    console.log("   Viewer:   viewer@example.com / CHS-Viewer-2026!");

  } catch (error) {
    console.error("Error al hacer seed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedProduction()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
