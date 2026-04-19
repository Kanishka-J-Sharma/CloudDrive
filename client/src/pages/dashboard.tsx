import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Download, Users, ShieldAlert, AlertTriangle, Cloud, Lock, Server } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AuthState } from "@/App";
import { authToken } from "@/lib/auth";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
}

export default function DashboardPage({ auth }: { auth: AuthState }) {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/files/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/files/stats");
      return res.json();
    },
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["/api/audit"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/audit?limit=5");
      return res.json();
    },
  });

  const statCards = [
    {
      title: "Total Files",
      value: statsLoading ? null : stats?.totalFiles ?? "—",
      icon: FolderOpen,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Total Storage",
      value: statsLoading ? null : (stats ? formatBytes(stats.totalSizeBytes) : "—"),
      icon: Cloud,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Total Downloads",
      value: statsLoading ? null : stats?.totalDownloads ?? "—",
      icon: Download,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      title: "Active Users",
      value: statsLoading ? null : stats?.userCount ?? "—",
      icon: Users,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-500/10",
    },
  ];

  const securityCards = [
    {
      title: "Critical Events",
      value: statsLoading ? null : stats?.criticalCount ?? 0,
      icon: ShieldAlert,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
    },
    {
      title: "Warnings",
      value: statsLoading ? null : stats?.warningCount ?? 0,
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      title: "Audit Events",
      value: statsLoading ? null : stats?.totalEvents ?? 0,
      icon: Lock,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      title: "Unique Users",
      value: statsLoading ? null : stats?.uniqueUsers ?? 0,
      icon: Server,
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-500/10",
    },
  ];

  const intentionalVulns = [
    { id: "APP-001", label: "Broken Access Control", layer: "App", severity: "Critical" },
    { id: "APP-002", label: "Missing Rate Limiting", layer: "App", severity: "High" },
    { id: "CLD-001", label: "Overprivileged IAM Role", layer: "Cloud", severity: "High" },
    { id: "CLD-002", label: "Misconfigured Bucket Policy", layer: "Cloud", severity: "Critical" },
    { id: "INF-001", label: "Container Running as Root", layer: "Infra", severity: "High" },
  ];

  const severityColor = (s: string) =>
    s === "Critical" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400";

  function severityBadge(s: string) {
    if (s === "critical") return "destructive";
    if (s === "warning") return "outline";
    return "secondary";
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back, <span className="font-medium text-foreground">{auth.user?.username}</span> — here's your CloudDrive overview.
        </p>
      </div>

      {/* Storage Stats */}
      <section>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Storage Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <Card key={card.title} data-testid={`stat-${card.title.toLowerCase().replace(/ /g, "-")}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">{card.title}</div>
                    {card.value === null ? (
                      <Skeleton className="h-7 w-16 mt-1" />
                    ) : (
                      <div className="text-2xl font-bold mt-1">{card.value}</div>
                    )}
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Security Stats */}
      <section>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Security Posture</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {securityCards.map((card) => (
            <Card key={card.title} data-testid={`security-stat-${card.title.toLowerCase().replace(/ /g, "-")}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">{card.title}</div>
                    {card.value === null ? (
                      <Skeleton className="h-7 w-12 mt-1" />
                    ) : (
                      <div className="text-2xl font-bold mt-1">{card.value}</div>
                    )}
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Intentional Vulnerabilities */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Planted Vulnerabilities</CardTitle>
              <Badge variant="destructive" className="text-[10px]">5 intentional</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-2">
              {intentionalVulns.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">{v.id}</span>
                    <span className="text-xs truncate">{v.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px] h-4 px-1">{v.layer}</Badge>
                    <span className={`text-[10px] font-medium ${severityColor(v.severity)}`}>{v.severity}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Audit Events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Audit Events</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {auditLoading ? (
              <div className="flex flex-col gap-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {(auditLogs || []).slice(0, 6).map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between py-1.5 border-b last:border-0 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={severityBadge(log.severity) as any} className="text-[10px] h-4 px-1 shrink-0 capitalize">
                        {log.severity}
                      </Badge>
                      <div className="min-w-0">
                        <span className="text-xs font-mono">{log.action}</span>
                        {log.username && <span className="text-xs text-muted-foreground ml-1">by {log.username}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Architecture notes */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Server className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <span className="font-medium text-foreground">Architecture</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span>Web app (Node/Express)</span>
                <span>PostgreSQL (simulated via SQLite)</span>
                <span>AWS S3 · AES-256 encryption at rest</span>
                <span>Presigned URLs — users never access S3 directly</span>
                <span>Grafana + Loki monitoring (OE dashboard)</span>
                <span>GitHub Actions CI/CD · Semgrep SAST · Trivy scanning</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
