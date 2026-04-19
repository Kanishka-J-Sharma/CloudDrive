import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, AlertTriangle, Info, Clock, User } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useMemo } from "react";
import type { AuthState } from "@/App";

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <ShieldAlert className="w-3.5 h-3.5 text-red-500" />;
  if (severity === "warning") return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
  return <Info className="w-3.5 h-3.5 text-blue-400" />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, "destructive" | "outline" | "secondary"> = {
    critical: "destructive",
    warning: "outline",
    info: "secondary",
  };
  return (
    <Badge variant={map[severity] ?? "secondary"} className="text-[10px] h-4 px-1 capitalize">
      {severity}
    </Badge>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    login: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    login_failed: "bg-red-500/10 text-red-700 dark:text-red-400",
    logout: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    upload: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    download: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    share: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    delete: "bg-red-500/10 text-red-700 dark:text-red-400",
    revoke_share: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    register: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${colors[action] ?? "bg-muted text-muted-foreground"}`}>
      {action}
    </span>
  );
}

export default function AuditPage({ auth }: { auth: AuthState }) {
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const isAdmin = auth.user?.role === "admin";

  const { data: logs, isLoading } = useQuery({
    queryKey: ["/api/audit"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/audit?limit=200");
      return res.json() as Promise<any[]>;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/audit/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/audit/stats");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => {
      const matchSearch = !search || log.action.includes(search) || (log.username?.includes(search)) || (log.metadata?.includes(search));
      const matchSev = filterSeverity === "all" || log.severity === filterSeverity;
      const matchAct = filterAction === "all" || log.action === filterAction;
      return matchSearch && matchSev && matchAct;
    });
  }, [logs, search, filterSeverity, filterAction]);

  // detect anomalies in the data
  const anomalyEvents = useMemo(() => {
    if (!logs) return [];
    return logs.filter(l => l.action === "login_failed" || l.severity === "critical" ||
      (l.action === "download" && l.severity === "warning"));
  }, [logs]);

  return (
    <div className="p-6 flex flex-col gap-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin ? "Full audit trail across all users" : "Your activity log"} · OE dashboard powered by Grafana + Loki
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Events", value: stats?.totalEvents, color: "text-foreground" },
          { label: "Critical", value: stats?.criticalCount, color: "text-red-600 dark:text-red-400" },
          { label: "Warnings", value: stats?.warningCount, color: "text-amber-600 dark:text-amber-400" },
          { label: "Unique Users", value: stats?.uniqueUsers, color: "text-primary" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-bold mt-1 ${s.color}`}>
                {s.value ?? <Skeleton className="h-7 w-10 inline-block" />}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Anomaly callout */}
      {anomalyEvents.length > 0 && (
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-md bg-red-500/8 border border-red-500/20">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-red-600 dark:text-red-400">{anomalyEvents.length} anomalous events detected</span>
            <span className="text-muted-foreground ml-1.5">— login failures, unauthorized downloads, and critical access events. Review below.</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search events, users, metadata…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs text-xs"
          data-testid="input-audit-search"
        />
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-36 text-xs" data-testid="select-severity-filter">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36 text-xs" data-testid="select-action-filter">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="login_failed">Login failed</SelectItem>
            <SelectItem value="upload">Upload</SelectItem>
            <SelectItem value="download">Download</SelectItem>
            <SelectItem value="share">Share</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center ml-1">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Log table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 flex flex-col gap-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No events match your filters</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Time</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Severity</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">User</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Resource</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">IP</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((log: any) => {
                    let meta: any = {};
                    try { meta = JSON.parse(log.metadata || "{}"); } catch {}
                    return (
                      <tr
                        key={log.id}
                        className={`hover:bg-muted/20 transition-colors ${log.severity === "critical" ? "bg-red-500/5" : log.severity === "warning" ? "bg-amber-500/5" : ""}`}
                        data-testid={`audit-row-${log.id}`}
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="text-muted-foreground" title={log.timestamp}>
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <SeverityIcon severity={log.severity} />
                            <SeverityBadge severity={log.severity} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><ActionBadge action={log.action} /></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">{log.username ?? "unknown"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {log.resourceType && <span>{log.resourceType}:{log.resourceId}</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{log.ipAddress}</td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate" title={JSON.stringify(meta)}>
                          {meta.filename && <span className="font-medium text-foreground">{meta.filename}</span>}
                          {meta.note && <span className="ml-1 text-amber-600 dark:text-amber-400">— {meta.note}</span>}
                          {meta.reason && <span className="text-red-500"> {meta.reason}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
