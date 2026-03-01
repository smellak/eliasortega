import { useEffect, useState, useCallback } from "react";
import { Calendar, List, Gauge, Package, Users, LogOut, Bell, Shield, Warehouse, MessageSquare, ClipboardCheck, BarChart3 } from "lucide-react";
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
import { appointmentsApi, providersApi } from "@/lib/api";

interface AppSidebarProps {
  userRole: UserRole;
  userEmail: string;
  onLogout?: () => void;
}

export function AppSidebar({ userRole, userEmail, onLogout }: AppSidebarProps) {
  const [location] = useLocation();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [providerCount, setProviderCount] = useState<number | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const [appointments, providers] = await Promise.all([
        appointmentsApi.list(),
        providersApi.list(),
      ]);
      setPendingCount(appointments.filter(a => a.confirmationStatus === "pending").length);
      setProviderCount(providers.length);
    } catch {
      // silently fail — sidebar badges are non-critical
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  // Also refresh on navigation
  useEffect(() => {
    fetchCounts();
  }, [location, fetchCounts]);

  const mainItems = [
    { title: "Calendario", url: "/", icon: Calendar, badge: null },
    { title: "Citas", url: "/appointments", icon: List, badge: pendingCount },
    { title: "Almacén", url: "/warehouse", icon: ClipboardCheck, badge: null },
    { title: "Asistente IA", url: "/admin-chat", icon: MessageSquare, badge: null },
  ];

  const managementItems = [
    { title: "Capacidad", url: "/capacity", icon: Gauge, roles: ["ADMIN", "PLANNER"], badge: null },
    { title: "Muelles", url: "/docks", icon: Warehouse, roles: ["ADMIN", "PLANNER"], badge: null },
    { title: "Proveedores", url: "/providers", icon: Package, roles: ["ADMIN", "PLANNER"], badge: providerCount },
    { title: "Notificaciones", url: "/notifications", icon: Bell, roles: ["ADMIN"], badge: null },
    { title: "Usuarios", url: "/users", icon: Users, roles: ["ADMIN"], badge: null },
    { title: "Auditoría", url: "/audit", icon: Shield, roles: ["ADMIN", "PLANNER"], badge: null },
    { title: "Precisión IA", url: "/analytics", icon: BarChart3, roles: ["ADMIN", "PLANNER"], badge: null },
  ];

  const filteredManagementItems = managementItems.filter(
    item => !item.roles || item.roles.includes(userRole)
  );

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src="/logo-sanchez.png" alt="Centro Hogar Sanchez" className="h-10 w-auto" />
          <div>
            <h2 className="text-sm font-semibold">Centro Hogar</h2>
            <p className="text-xs text-muted-foreground">Gestión de Almacén</p>
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
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    className="transition-all duration-200"
                  >
                    <a href={item.url} data-testid={`link-sidebar-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.badge !== null && item.badge > 0 && (
                        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white px-1.5">
                          {item.badge}
                        </span>
                      )}
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
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="transition-all duration-200"
                    >
                      <a href={item.url} data-testid={`link-sidebar-${item.title.toLowerCase()}`}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {item.badge !== null && item.badge > 0 && (
                          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white px-1.5">
                            {item.badge}
                          </span>
                        )}
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
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {userEmail[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userEmail}</p>
            </div>
          </div>
          <RoleBadge role={userRole} />
        </div>
        <SidebarMenuButton onClick={onLogout} data-testid="button-logout" className="transition-all duration-200">
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
