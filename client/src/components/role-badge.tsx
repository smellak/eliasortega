import { Badge } from "@/components/ui/badge";

type Role = "admin" | "planner" | "basic_readonly";

interface RoleBadgeProps {
  role: Role;
}

const roleConfig: Record<Role, { label: string; variant: "default" | "secondary" | "outline" }> = {
  admin: { label: "ADMIN", variant: "default" },
  planner: { label: "PLANNER", variant: "secondary" },
  basic_readonly: { label: "VIEW ONLY", variant: "outline" },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role];
  
  return (
    <Badge variant={config.variant} className="text-xs tracking-wide" data-testid={`badge-role-${role}`}>
      {config.label}
    </Badge>
  );
}
