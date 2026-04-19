import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, Shield, AlertTriangle, Cloud, Server, Code, CheckCircle, XCircle } from "lucide-react";
import type { AuthState } from "@/App";

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    Critical: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    High: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    Medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    Low: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colors[severity] ?? "bg-muted"}`}>
      {severity}
    </span>
  );
}

function LayerIcon({ layer }: { layer: string }) {
  if (layer === "Application") return <Code className="w-4 h-4 text-primary" />;
  if (layer === "Cloud / IAM") return <Cloud className="w-4 h-4 text-violet-500" />;
  return <Server className="w-4 h-4 text-amber-500" />;
}

function layerColor(layer: string) {
  if (layer === "Application") return "border-primary/30 bg-primary/5";
  if (layer === "Cloud / IAM") return "border-violet-500/30 bg-violet-500/5";
  return "border-amber-500/30 bg-amber-500/5";
}

export default function SecurityPage({ auth }: { auth: AuthState }) {
  const { data: report, isLoading } = useQuery({
    queryKey: ["/api/security/report"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/security/report");
      return res.json();
    },
  });

  const criticalCount = report?.vulnerabilities?.filter((v: any) => v.severity === "Critical").length ?? 0;
  const highCount = report?.vulnerabilities?.filter((v: any) => v.severity === "High").length ?? 0;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Security Report</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Threat model and intentional security weaknesses — CloudDrive learning project</p>
      </div>

      {/* Summary banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/8 border border-red-500/20">
        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-red-600 dark:text-red-400">
            {isLoading ? "…" : `${criticalCount} Critical · ${highCount} High`} — Intentional vulnerabilities active
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            These weaknesses are planted for security testing, threat modelling, and compliance exercise purposes.
            They form the basis for pen-testing, SAST findings, and incident response walkthroughs.
          </div>
        </div>
      </div>

      {/* Vulnerability cards */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(report?.vulnerabilities ?? []).map((vuln: any) => (
            <Card key={vuln.id} className={`border ${layerColor(vuln.layer)}`} data-testid={`vuln-card-${vuln.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="shrink-0 mt-0.5"><LayerIcon layer={vuln.layer} /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[11px] text-muted-foreground">{vuln.id}</span>
                        <span className="font-semibold text-sm">{vuln.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{vuln.description}</p>
                      <div className="mt-2 flex items-start gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">{vuln.remediation}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <SeverityBadge severity={vuln.severity} />
                    <Badge variant="outline" className="text-[10px] h-4 px-1">{vuln.layer}</Badge>
                    <div className="text-[10px] text-muted-foreground">CVSS {vuln.cvss}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{vuln.cwe}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* IAM Policy diff */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <CardTitle className="text-sm font-semibold">Current IAM Policy (Overprivileged)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <pre className="text-[11px] bg-muted/50 rounded-md p-3 overflow-x-auto font-mono leading-relaxed">
                {JSON.stringify(report.iamPolicy.current, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-sm font-semibold">Recommended IAM Policy (Least Privilege)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <pre className="text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-md p-3 overflow-x-auto font-mono leading-relaxed">
                {JSON.stringify(report.iamPolicy.recommended, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bucket Policy diff */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <CardTitle className="text-sm font-semibold">Current Bucket Policy (Public Read)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <pre className="text-[11px] bg-red-500/5 border border-red-500/20 rounded-md p-3 overflow-x-auto font-mono leading-relaxed">
                {JSON.stringify(report.bucketPolicy.current, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-sm font-semibold">Recommended Bucket Policy (Scoped)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <pre className="text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-md p-3 overflow-x-auto font-mono leading-relaxed">
                {JSON.stringify(report.bucketPolicy.recommended, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CI/CD & monitoring */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">CI/CD Pipeline & Monitoring</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {[
              {
                title: "GitHub Actions",
                icon: Code,
                items: ["Runs on every push", "SAST with Semgrep", "Container scan with Trivy", "Test suite gate"],
                color: "text-slate-600 dark:text-slate-400",
                bg: "bg-slate-500/10",
              },
              {
                title: "OE Dashboard (Grafana + Loki)",
                icon: Shield,
                items: ["Login anomaly detection", "Unusual file access patterns", "Download spike alerts", "Real-time log streaming"],
                color: "text-violet-600 dark:text-violet-400",
                bg: "bg-violet-500/10",
              },
              {
                title: "Docker Compose Stack",
                icon: Server,
                items: ["web-app container", "PostgreSQL container", "Grafana + Loki container", "Known weakness: runs as root (INF-001)"],
                color: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-500/10",
              },
            ].map(section => (
              <div key={section.title} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded ${section.bg} flex items-center justify-center`}>
                    <section.icon className={`w-3.5 h-3.5 ${section.color}`} />
                  </div>
                  <span className="font-semibold text-xs">{section.title}</span>
                </div>
                <ul className="flex flex-col gap-1 pl-1">
                  {section.items.map(item => (
                    <li key={item} className="flex items-start gap-1.5 text-muted-foreground">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
