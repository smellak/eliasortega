import { useState } from "react";
import { Switch, Route } from "wouter";
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
import NotFound from "@/pages/not-found";

type UserRole = "admin" | "planner" | "basic_readonly";

interface User {
  email: string;
  role: UserRole;
}

function Router({ user }: { user: User }) {
  return (
    <Switch>
      <Route path="/" component={() => <CalendarPage userRole={user.role} />} />
      <Route path="/appointments" component={() => <AppointmentsPage userRole={user.role} />} />
      <Route path="/capacity" component={() => <CapacityPage userRole={user.role} />} />
      <Route path="/providers" component={() => <ProvidersPage userRole={user.role} />} />
      {user.role === "admin" && <Route path="/users" component={UsersPage} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // TODO: remove mock authentication
  const [user, setUser] = useState<User | null>({ email: "planner@example.com", role: "planner" });

  const handleLogin = (email: string, password: string) => {
    console.log("Login:", email, password);
    // TODO: Call authentication API
    // For demo, set mock user based on email
    if (email.includes("admin")) {
      setUser({ email, role: "admin" });
    } else if (email.includes("planner")) {
      setUser({ email, role: "planner" });
    } else {
      setUser({ email, role: "basic_readonly" });
    }
  };

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
            <AppSidebar userRole={user.role} userEmail={user.email} />
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
