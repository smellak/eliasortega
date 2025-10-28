import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@shared/types";

interface RoleBadgeProps {
  role: UserRole;
}

const roleConfig: Record<UserRole, { label: string; variant: "default" | "secondary" | "outline" }> = {
  ADMIN: { label: "ADMIN", variant: "default" },
  PLANNER: { label: "PLANNER", variant: "secondary" },
  BASIC_READONLY: { label: "VIEW ONLY", variant: "outline" },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role];
  
  return (
    <Badge variant={config.variant} className="text-xs tracking-wide" data-testid={`badge-role-${role}`}>
      {config.label}
    </Badge>
  );
}
