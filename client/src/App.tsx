import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, User } from "lucide-react";
import { setAuth, clearAuth, authToken, currentUser as cUser } from "@/lib/auth";
import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import FilesPage from "@/pages/files";
import SharesPage from "@/pages/shares";
import AuditPage from "@/pages/audit";
import SecurityPage from "@/pages/security";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

export interface AuthState {
  token: string | null;
  user: { id: number; email: string; username: string; role: string } | null;
}

function AppRouter({ auth, onLogout }: { auth: AuthState; onLogout: () => void }) {
  return (
    <Switch>
      <Route path="/" component={() => <DashboardPage auth={auth} />} />
      <Route path="/files" component={() => <FilesPage auth={auth} />} />
      <Route path="/shares" component={() => <SharesPage auth={auth} />} />
      <Route path="/audit" component={() => <AuditPage auth={auth} />} />
      <Route path="/security" component={() => <SecurityPage auth={auth} />} />
      <Route path="/settings" component={() => <SettingsPage auth={auth} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const pref = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(pref);
    document.documentElement.classList.toggle("dark", pref);
  }, []);
  return (
    <Button
      size="icon"
      variant="ghost"
      data-testid="button-theme-toggle"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
      }}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

export default function App() {
  const [auth, setAuthState] = useState<AuthState>({ token: null, user: null });

  const handleLogin = (token: string, user: AuthState["user"]) => {
    setAuth(token, user);
    setAuthState({ token, user });
  };

  const handleLogout = () => {
    clearAuth();
    setAuthState({ token: null, user: null });
    queryClient.clear();
  };

  if (!auth.token || !auth.user) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthPage onLogin={handleLogin} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  const sidebarStyle = { "--sidebar-width": "14rem", "--sidebar-width-icon": "3.5rem" };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full overflow-hidden">
            <AppSidebar auth={auth} />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center justify-between px-4 py-2 border-b bg-card h-12 shrink-0 z-50">
                <div className="flex items-center gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" className="-ml-1" />
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>S3 Connected · us-east-1</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ThemeToggle />
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{auth.user.username}</span>
                    {auth.user.role === "admin" && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1 rounded font-medium">admin</span>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" onClick={handleLogout} data-testid="button-logout">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <Router hook={useHashLocation}>
                  <AppRouter auth={auth} onLogout={handleLogout} />
                </Router>
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
