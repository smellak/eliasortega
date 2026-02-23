import { prisma } from "../db/client";
import type { Prisma } from "@prisma/client";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";
type ActorType = "USER" | "CHAT_AGENT" | "INTEGRATION" | "SYSTEM";

export async function logAudit(params: {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorType: ActorType;
  actorId?: string | null;
  changes?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actorType: params.actorType,
        actorId: params.actorId || null,
        changes: (params.changes as Prisma.InputJsonValue) || undefined,
      },
    });
  } catch (e) {
    console.error("[AUDIT] Failed to log:", e);
  }
}

export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { before: unknown; after: unknown }> | null {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = Object.keys(before).concat(Object.keys(after));
  const uniqueKeys = allKeys.filter((k, i) => allKeys.indexOf(k) === i);

  for (const key of uniqueKeys) {
    if (key === "updatedAt" || key === "createdAt") continue;
    const bVal = before[key];
    const aVal = after[key];
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changes[key] = { before: bVal, after: aVal };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}
