# CloudDrive OE Dashboard

Grafana-based Operational Excellence dashboard for CloudDrive. All data is **hardcoded** using Grafana's built-in TestData datasource — no live connection to the CloudDrive backend is required.

## Quick Start

```bash
cd oe-dashboard
docker compose up -d
```

Open [http://localhost:3001](http://localhost:3001) and log in with `admin / admin`.

The **CloudDrive OE** dashboard loads automatically as the home dashboard.

## Dashboard Sections

| Section | Panels | Answers |
|---------|--------|---------|
| Service Health | Error rate, p95 latency, DB status, container uptime, request rate chart | Is the API up? Is it fast? |
| User Activity | Login success/failure counts, file upload/download counts, time-series charts | Are users able to log in and use files? |
| Security Anomalies | Unauthorized downloads, brute-force candidates, admin probes, vulnerability table, audit event chart | Is CloudDrive under attack? |
| Data Footprint | File count, storage bytes, user count, share breakdown (donut), file growth chart | How much data is stored? Any sudden spikes? |
| Infrastructure Health | CPU gauge, memory gauge, disk gauge, memory time-series | Is the host healthy? |

## Replacing Hardcoded Data with Live Data

To connect to real CloudDrive metrics:

1. Add `prom-client` to the CloudDrive Express app and expose `/metrics`.
2. Add a Prometheus container to `docker-compose.yml` (scrape `webapp:5000/metrics`).
3. In Grafana, add a Prometheus datasource pointing to `http://prometheus:9090`.
4. Replace `testdata` datasource references in the dashboard JSON with PromQL queries.

See `../docs/oe-metrics.md` for the full metric specification.

## Files

```
oe-dashboard/
├── docker-compose.yml               # Grafana container definition
├── dashboards/
│   └── clouddrive-oe.json           # Main Grafana dashboard (all panels)
└── provisioning/
    ├── datasources/datasource.yml   # Auto-provisions TestData datasource
    └── dashboards/dashboard.yml     # Auto-provisions dashboard from /dashboards/
```
