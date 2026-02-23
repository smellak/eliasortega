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
import ChatPublic from "@/pages/chat-public";
import NotFound from "@/pages/not-found";
import { authApi, getAuthToken, clearAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
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
        <div className="flex items-center justify-center h-screen bg-background" data-testid="error-boundary">
          <div className="text-center space-y-4 max-w-md p-8">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Algo salió mal</h2>
            <p className="text-muted-foreground text-sm">
              Ha ocurrido un error inesperado. Por favor, recarga la página.
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-reload">
              Recargar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router({ user }: { user: UserResponse }) {
  return (
    <Switch>
      <Route path="/" component={() => <CalendarPage userRole={user.role} />} />
      <Route path="/appointments" component={() => <AppointmentsPage userRole={user.role} />} />
      <Route path="/capacity" component={() => <CapacityPage userRole={user.role} />} />
      <Route path="/providers" component={() => <ProvidersPage userRole={user.role} />} />
      {user.role === "ADMIN" && <Route path="/users" component={UsersPage} />}
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Cargando...</div>
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
                <header className="flex items-center justify-between p-4 border-b border-border bg-background">
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
