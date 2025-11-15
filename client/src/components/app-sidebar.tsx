import { Calendar, List, Gauge, Package, Users, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { RoleBadge } from "./role-badge";
import { useLocation } from "wouter";
import type { UserRole } from "@shared/types";

interface AppSidebarProps {
  userRole: UserRole;
  userEmail: string;
  onLogout?: () => void;
}

export function AppSidebar({ userRole, userEmail, onLogout }: AppSidebarProps) {
  const [location] = useLocation();

  const mainItems = [
    { title: "Calendario", url: "/", icon: Calendar },
    { title: "Citas", url: "/appointments", icon: List },
  ];

  const managementItems = [
    { title: "Capacidad", url: "/capacity", icon: Gauge, roles: ["ADMIN", "PLANNER"] },
    { title: "Proveedores", url: "/providers", icon: Package, roles: ["ADMIN", "PLANNER"] },
    { title: "Usuarios", url: "/users", icon: Users, roles: ["ADMIN"] },
  ];

  const filteredManagementItems = managementItems.filter(
    item => !item.roles || item.roles.includes(userRole)
  );

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Almacén</h2>
            <p className="text-xs text-muted-foreground">Citas</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <a href={item.url} data-testid={`link-sidebar-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredManagementItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestión</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredManagementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <a href={item.url} data-testid={`link-sidebar-${item.title.toLowerCase()}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userEmail}</p>
          </div>
          <RoleBadge role={userRole} />
        </div>
        <SidebarMenuButton onClick={onLogout} data-testid="button-logout">
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
