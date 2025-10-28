#!/usr/bin/env node
/**
 * Script para crear usuarios en la base de datos de PRODUCCIÓN
 * 
 * IMPORTANTE: Este script debe ejecutarse contra la base de datos de PRODUCCIÓN
 * 
 * Para ejecutar:
 * 1. Asegúrate de que DATABASE_URL apunte a producción
 * 2. Ejecuta: node seed-production.js
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedProduction() {
  console.log("🚀 Iniciando seed de base de datos de PRODUCCIÓN...");
  console.log("⚠️  ADVERTENCIA: Este script modificará la base de datos de PRODUCCIÓN");
  console.log("");

  try {
    // Crear usuario admin
    const adminPassword = await bcrypt.hash("admin123", 10);
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
    console.log("✅ Usuario admin creado/actualizado:", admin.email);

    // Crear usuario planner
    const plannerPassword = await bcrypt.hash("planner123", 10);
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
    console.log("✅ Usuario planner creado/actualizado:", planner.email);

    // Crear usuario viewer
    const viewerPassword = await bcrypt.hash("viewer123", 10);
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
    console.log("✅ Usuario viewer creado/actualizado:", viewer.email);

    console.log("");
    console.log("🎉 Seed de producción completado exitosamente!");
    console.log("");
    console.log("📝 Credenciales de acceso:");
    console.log("   Admin:    admin@example.com / admin123");
    console.log("   Planner:  planner@example.com / planner123");
    console.log("   Viewer:   viewer@example.com / viewer123");

  } catch (error) {
    console.error("❌ Error al hacer seed:", error);
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
