import { useHashLocation } from "wouter/use-hash-location";
import { Link } from "wouter";
import {
  LayoutDashboard, FolderOpen, Share2, ShieldAlert, Lock, Settings, Cloud,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import type { AuthState } from "@/App";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "My Files", url: "/files", icon: FolderOpen },
  { title: "Shared Files", url: "/shares", icon: Share2 },
  { title: "Audit Log", url: "/audit", icon: ShieldAlert },
  { title: "Security Report", url: "/security", icon: Lock },
];

export function AppSidebar({ auth }: { auth: AuthState }) {
  const [location] = useHashLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3 border-b">
        <div className="flex items-center gap-2">
          {/* CloudDrive SVG Logo */}
          <svg
            aria-label="CloudDrive"
            viewBox="0 0 32 32"
            fill="none"
            className="w-7 h-7 shrink-0"
          >
            <rect width="32" height="32" rx="7" fill="hsl(226 71% 48%)" />
            <path
              d="M8 21a4 4 0 0 1 0-8 1 1 0 0 1 .08 0A5 5 0 0 1 18 13a4 4 0 0 1 3.92 3.2A3.5 3.5 0 0 1 21 23H8Z"
              fill="white"
              opacity="0.95"
            />
            <path
              d="M19 19.5L22 22.5M19 22.5L22 19.5"
              stroke="hsl(226 71% 48%)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">CloudDrive</span>
            <span className="text-[10px] text-muted-foreground leading-tight">v1.0 · Demo</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/ /g, "-")}`}
                    >
                      <Link href={item.url} className="flex items-center gap-2">
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings"} data-testid="nav-settings">
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Cloud className="w-3.5 h-3.5" />
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">AWS S3 · us-east-1</div>
            <div className="text-[10px] truncate">clouddrive-files</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
