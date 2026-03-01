import { useState, useEffect, Component, type ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import LoginPage from "@/pages/login";
import CalendarPage from "@/pages/calendar-page";
import AppointmentsPage from "@/pages/appointments-page";
import CapacityPage from "@/pages/capacity-page";
import ProvidersPage from "@/pages/providers-page";
import UsersPage from "@/pages/users-page";
import NotificationsPage from "@/pages/notifications-page";
import AuditPage from "@/pages/audit-page";
import DocksPage from "@/pages/docks-page";
import ChatPublic from "@/pages/chat-public";
import ChatAdmin from "@/pages/chat-admin";
import WarehousePage from "@/pages/warehouse-page";
import AnalyticsPage from "@/pages/analytics-page";
import NotFound from "@/pages/not-found";
import { authApi, getAuthToken, clearAuth } from "@/lib/api";
import { useNewAppointmentToast } from "@/hooks/use-new-appointment-toast";
import { FloatingAssistant } from "@/components/floating-assistant";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { UserResponse } from "@shared/types";

type UserRole = "ADMIN" | "PLANNER" | "BASIC_READONLY";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background to-blue-50/30 dark:to-blue-950/10" data-testid="error-boundary">
          <div className="text-center space-y-6 max-w-md p-10 animate-fadeIn">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto shadow-lg shadow-red-500/20">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold">Algo salió mal</h2>
            <p className="text-muted-foreground text-sm">
              Ha ocurrido un error inesperado. Por favor, recarga la página.
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-reload" className="gradient-btn text-white border-0">
              Recargar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppointmentPolling() {
  useNewAppointmentToast();
  return null;
}

function Router({ user }: { user: UserResponse }) {
  return (
    <Switch>
      <Route path="/" component={() => <CalendarPage userRole={user.role} />} />
      <Route path="/appointments" component={() => <AppointmentsPage userRole={user.role} />} />
      <Route path="/capacity" component={() => <CapacityPage userRole={user.role} />} />
      <Route path="/docks" component={() => <DocksPage userRole={user.role} />} />
      <Route path="/providers" component={() => <ProvidersPage userRole={user.role} />} />
      {user.role === "ADMIN" && <Route path="/notifications" component={() => <NotificationsPage userRole={user.role} />} />}
      {user.role === "ADMIN" && <Route path="/users" component={UsersPage} />}
      {(user.role === "ADMIN" || user.role === "PLANNER") && <Route path="/audit" component={() => <AuditPage userRole={user.role} />} />}
      {(user.role === "ADMIN" || user.role === "PLANNER") && <Route path="/admin-chat" component={ChatAdmin} />}
      <Route path="/warehouse" component={() => <WarehousePage userRole={user.role} />} />
      {(user.role === "ADMIN" || user.role === "PLANNER") && <Route path="/analytics" component={() => <AnalyticsPage userRole={user.role} />} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (location === "/chat") {
      setIsLoading(false);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    authApi.me()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        clearAuth();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [location]);

  const handleLogin = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    setUser(response.user);
  };

  const handleLogout = () => {
    authApi.logout();
    setUser(null);
  };

  if (location === "/chat") {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <ChatPublic />
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background to-blue-50/30 dark:to-blue-950/10">
        <div className="flex flex-col items-center gap-4 animate-fadeIn">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LoginPage onLogin={handleLogin} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  const sidebarStyle = {
    "--sidebar-width": "20rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar userRole={user.role} userEmail={user.email} onLogout={handleLogout} />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="glass-header flex items-center justify-between p-4 sticky top-0 z-50">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-mono text-muted-foreground hidden sm:block">
                      {new Date().toLocaleDateString("es-ES", { 
                        timeZone: "Europe/Madrid",
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </div>
                    <ThemeToggle />
                  </div>
                </header>
                <main className="flex-1 overflow-auto p-6 lg:p-8">
                  <div className="max-w-7xl mx-auto">
                    <Router user={user} />
                  </div>
                </main>
                <AppointmentPolling />
                {location !== "/admin-chat" && <FloatingAssistant />}
              </div>
            </div>
          </SidebarProvider>
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
