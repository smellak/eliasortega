import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@shared/types";

interface RoleBadgeProps {
  role: UserRole;
}

const roleConfig: Record<UserRole, { label: string; variant: "default" | "secondary" | "outline"; className: string }> = {
  ADMIN: { label: "ADMINISTRADOR", variant: "default", className: "bg-gradient-to-r from-[#1565C0] to-[#1976D2] text-white border-0 shadow-sm no-default-hover-elevate no-default-active-elevate" },
  PLANNER: { label: "PLANIFICADOR", variant: "secondary", className: "bg-gradient-to-r from-teal-500 to-emerald-600 text-white border-0 shadow-sm no-default-hover-elevate no-default-active-elevate" },
  BASIC_READONLY: { label: "SOLO LECTURA", variant: "outline", className: "bg-gradient-to-r from-gray-400 to-gray-500 text-white border-0 shadow-sm no-default-hover-elevate no-default-active-elevate" },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role];
  
  return (
    <Badge variant={config.variant} className={`text-xs tracking-wide ${config.className}`} data-testid={`badge-role-${role}`}>
      {config.label}
    </Badge>
  );
}
