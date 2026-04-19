import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Clock, Hash, Mail, Shield, Cloud, Lock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { AuthState } from "@/App";

export default function SettingsPage({ auth }: { auth: AuthState }) {
  const { data: me, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/me");
      return res.json();
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json();
    },
    enabled: auth.user?.role === "admin",
    retry: false,
  });

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Account details and configuration</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Your Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex flex-col gap-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="flex flex-col gap-0 divide-y">
              {[
                { icon: User, label: "Username", value: me?.username },
                { icon: Mail, label: "Email", value: me?.email },
                { icon: Shield, label: "Role", value: me?.role, badge: true },
                { icon: Hash, label: "Account ID", value: `#${me?.id}`, mono: true },
                { icon: Clock, label: "Member since", value: me?.createdAt ? format(new Date(me.createdAt), "PPP") : "—" },
                { icon: Clock, label: "Last login", value: me?.lastLoginAt ? formatDistanceToNow(new Date(me.lastLoginAt), { addSuffix: true }) : "—" },
                { icon: Hash, label: "Total logins", value: String(me?.loginCount ?? 0), mono: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <row.icon className="w-3.5 h-3.5 shrink-0" />
                    {row.label}
                  </div>
                  {row.badge ? (
                    <Badge variant={row.value === "admin" ? "default" : "secondary"} className="capitalize">
                      {row.value}
                    </Badge>
                  ) : (
                    <span className={`text-sm font-medium ${row.mono ? "font-mono text-muted-foreground" : ""}`}>
                      {row.value ?? "—"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Security Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-0 divide-y">
            {[
              { label: "Authentication", value: "JWT (HS256) · 24h expiry" },
              { label: "Password hashing", value: "bcrypt · cost factor 10" },
              { label: "Storage encryption", value: "AES-256 at rest (S3 SSE)" },
              { label: "S3 access method", value: "Presigned URLs · 1h expiry" },
              { label: "Transport security", value: "TLS 1.2+ (HTTPS)" },
              { label: "SAST scanning", value: "Semgrep (GitHub Actions)" },
              { label: "Container scanning", value: "Trivy (GitHub Actions)" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-3 gap-3">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="text-sm font-medium font-mono text-xs">{row.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* S3 config */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">AWS S3 Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-0 divide-y">
            {[
              { label: "Bucket", value: "clouddrive-files" },
              { label: "Region", value: "us-east-1" },
              { label: "Encryption", value: "SSE-S3 (AES-256)" },
              { label: "Versioning", value: "Enabled" },
              { label: "Lifecycle policy", value: "Incomplete uploads → 7d expiry" },
              { label: "Public access", value: "Block public access OFF (misconfigured — CLD-002)", warn: true },
              { label: "IAM role", value: "clouddrive-app (overprivileged — CLD-001)", warn: true },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-3 gap-3">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={`text-xs font-mono ${(row as any).warn ? "text-amber-600 dark:text-amber-400" : "font-medium"}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admin: user list */}
      {auth.user?.role === "admin" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">User Management (Admin)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {usersLoading ? (
              <div className="flex flex-col gap-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="divide-y">
                {(users || []).map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between py-2.5 gap-2" data-testid={`user-row-${u.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.username}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{u.loginCount} logins</span>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px] h-4 px-1">{u.role}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
