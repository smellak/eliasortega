-- Script para crear usuarios en la base de datos de producción
-- Ejecutar desde Replit Database Tool > SQL Runner > Production Database

-- Insertar usuario Admin
INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
VALUES (
  'admin-prod-001',
  'admin@example.com',
  '$2b$10$1NheIUEhGRhUabGJPxdoU.aKQxGfWcZ8F3qxBJvL7PZ8qWZ8qWZ8q',
  'ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();

-- Insertar usuario Planner
INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
VALUES (
  'planner-prod-001',
  'planner@example.com',
  '$2b$10$1NheIUEhGRhUabGJPxdoU.aKQxGfWcZ8F3qxBJvL7PZ8qWZ8qWZ8q',
  'PLANNER',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();

-- Insertar usuario Viewer
INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
VALUES (
  'viewer-prod-001',
  'viewer@example.com',
  '$2b$10$1NheIUEhGRhUabGJPxdoU.aKQxGfWcZ8F3qxBJvL7PZ8qWZ8qWZ8q',
  'BASIC_READONLY',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();

-- Verificar que se crearon correctamente
SELECT email, role FROM users;
