import { useState, useEffect } from "react";
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
import { authApi, getAuthToken } from "@/lib/api";
import type { UserResponse } from "@shared/types";

type UserRole = "ADMIN" | "PLANNER" | "BASIC_READONLY";

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

    const storedUser = localStorage.getItem("currentUser");
    const token = getAuthToken();
    
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, [location]);

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      setUser(response.user);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const handleLogout = () => {
    authApi.logout();
    setUser(null);
  };

  if (location === "/chat") {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ChatPublic />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
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
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
