# CloudDrive — OE Metrics Specification

> **Purpose:** This document defines every metric CloudDrive must emit for the OE dashboard to answer the operational state questions defined in `oe-questions.md`. Each metric includes its name, type, labels, collection source, and the dashboard question it answers.

---

## Metric Types (Prometheus Conventions)

| Type | Description |
|------|-------------|
| **Counter** | Monotonically increasing integer. Use for counts of events (requests, errors). |
| **Gauge** | A value that can go up or down. Use for current state (active users, file count). |
| **Histogram** | Sampled observations with configurable buckets. Use for latency and size. |

---

## Section 1 — Service Health

### `clouddrive_http_requests_total`
- **Type:** Counter
- **Labels:** `method`, `route`, `status_code`
- **Description:** Total HTTP requests handled by the Express server, by method, route, and response status code.
- **Answers:** Q1.2 (error rate = sum of 5xx / total), Q1.3 (request rate baseline)
- **Collection:** Express middleware on every route handler (increment on response)
- **Example:** `clouddrive_http_requests_total{method="POST",route="/api/auth/login",status_code="200"} 847`

### `clouddrive_http_request_duration_seconds`
- **Type:** Histogram
- **Labels:** `method`, `route`
- **Buckets:** `[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]`
- **Description:** Latency of each HTTP request from receipt to response flush.
- **Answers:** Q1.3 (p50/p95/p99 latency)
- **Collection:** Express middleware using `process.hrtime()`
- **Example:** `clouddrive_http_request_duration_seconds_bucket{method="GET",route="/api/files",le="0.1"} 412`

### `clouddrive_db_query_duration_seconds`
- **Type:** Histogram
- **Labels:** `operation` (`select`, `insert`, `update`, `delete`)
- **Buckets:** `[0.001, 0.005, 0.01, 0.05, 0.1, 0.5]`
- **Description:** Duration of SQLite/Drizzle ORM queries.
- **Answers:** Q1.5 (database health — slow queries indicate pressure)
- **Collection:** Drizzle ORM query wrapper or sqlite3 `trace()` callback

### `clouddrive_db_up`
- **Type:** Gauge
- **Labels:** _(none)_
- **Values:** `1` (reachable), `0` (error)
- **Description:** Whether the database is reachable and can execute a health-check query (`SELECT 1`).
- **Answers:** Q1.5
- **Collection:** Background health-check loop every 15 seconds

### `clouddrive_container_uptime_seconds`
- **Type:** Gauge
- **Labels:** `container` (`webapp`, `grafana`, `prometheus`)
- **Description:** Seconds since the container process started (`Date.now() - startTime`).
- **Answers:** Q6.4 (container uptime / recent restarts)
- **Collection:** Emitted at process start and updated every 60 seconds

---

## Section 2 — User Activity

### `clouddrive_auth_events_total`
- **Type:** Counter
- **Labels:** `event_type` (`login_success`, `login_failure`, `register`, `logout`)
- **Description:** Count of authentication events by outcome.
- **Answers:** Q2.1 (successful logins), Q2.2 (failed logins)
- **Collection:** Increment in `/api/auth/login` handler based on result
- **Example:** `clouddrive_auth_events_total{event_type="login_failure"} 143`

### `clouddrive_file_operations_total`
- **Type:** Counter
- **Labels:** `operation` (`upload`, `download`, `delete`), `result` (`success`, `failure`)
- **Description:** Count of file operations by type and result.
- **Answers:** Q2.3 (upload success/failure), Q2.4 (download success/failure)
- **Collection:** Increment in `/api/files/upload`, `/api/files/:id/download`, and `DELETE /api/files/:id` handlers
- **Example:** `clouddrive_file_operations_total{operation="upload",result="success"} 302`

### `clouddrive_presigned_url_generations_total`
- **Type:** Counter
- **Labels:** `operation` (`put`, `get`), `result` (`success`, `failure`)
- **Description:** Presigned URL generation attempts and outcomes.
- **Answers:** Q2.5
- **Collection:** Increment in presigned URL generation helper

### `clouddrive_active_sessions_total`
- **Type:** Gauge
- **Labels:** _(none)_
- **Description:** Approximate count of active authenticated sessions (estimated by counting unique JWTs issued in the last 24 hours that have not expired).
- **Answers:** Q2.1 (user activity level baseline)
- **Collection:** Maintained in-memory map or SQLite query at scrape time

---

## Section 3 — Security Anomalies

### `clouddrive_unauthorized_access_attempts_total`
- **Type:** Counter
- **Labels:** `violation_type` (`unauthorized_download`, `admin_endpoint_access`, `invalid_token`, `expired_token`)
- **Description:** Count of access control violations detected by the application layer.
- **Answers:** Q3.2, Q3.3, Q3.5 (unauthorized downloads, privilege escalation attempts)
- **Collection:** Increment in auth middleware and route handlers when access is denied; mirrors audit log entries
- **Example:** `clouddrive_unauthorized_access_attempts_total{violation_type="unauthorized_download"} 7`

### `clouddrive_brute_force_candidates_total`
- **Type:** Counter
- **Labels:** `source` (`ip`, `username`)
- **Description:** Count of accounts or IPs that have exceeded a login-failure threshold (≥ 5 failures in 10 minutes) — even though no rate limiting is enforced, this metric flags candidates for detection.
- **Answers:** Q3.1 (brute-force detection without enforcement)
- **Collection:** Rolling window counter keyed on IP/username in login handler

### `clouddrive_audit_events_total`
- **Type:** Counter
- **Labels:** `action` (mirrors `auditLogs.action` values: `LOGIN`, `LOGOUT`, `FILE_UPLOAD`, `FILE_DOWNLOAD`, `FILE_DELETE`, `SHARE_CREATE`, `UNAUTHORIZED_DOWNLOAD`, `FAILED_LOGIN`, etc.)
- **Description:** Total count of audit log entries by action type. The canonical source of truth for what happened in the system.
- **Answers:** Q3.1–Q3.5, Q2.1–Q2.4
- **Collection:** Increment every time a row is inserted into the `auditLogs` table

### `clouddrive_known_vulnerabilities_open`
- **Type:** Gauge
- **Labels:** `severity` (`critical`, `high`, `medium`, `low`), `layer` (`app`, `cloud`, `infrastructure`)
- **Description:** Count of known intentional or discovered vulnerabilities currently open.
- **Answers:** Q5.1, Q5.2, Q5.3 (security posture snapshot)
- **Collection:** Static configuration updated by CI/CD security scan (Semgrep/Trivy output); hardcoded in MVP

---

## Section 4 — Data Footprint

### `clouddrive_files_total`
- **Type:** Gauge
- **Labels:** _(none)_
- **Description:** Total number of file records in the database.
- **Answers:** Q4.1
- **Collection:** `SELECT COUNT(*) FROM files` at scrape time

### `clouddrive_files_storage_bytes`
- **Type:** Gauge
- **Labels:** _(none)_
- **Description:** Sum of `files.size` across all records (bytes).
- **Answers:** Q4.3
- **Collection:** `SELECT SUM(size) FROM files` at scrape time

### `clouddrive_shares_total`
- **Type:** Gauge
- **Labels:** `permission` (`read`, `read_write`)
- **Description:** Count of active file shares by permission level.
- **Answers:** Q4.2
- **Collection:** `SELECT permission, COUNT(*) FROM shares GROUP BY permission` at scrape time

### `clouddrive_users_total`
- **Type:** Gauge
- **Labels:** `role` (`admin`, `user`)
- **Description:** Total registered users by role.
- **Answers:** Q4.4
- **Collection:** `SELECT role, COUNT(*) FROM users GROUP BY role` at scrape time

### `clouddrive_new_users_24h`
- **Type:** Gauge
- **Labels:** _(none)_
- **Description:** Users created in the last 24 hours (account creation spike detection).
- **Answers:** Q4.4
- **Collection:** `SELECT COUNT(*) FROM users WHERE createdAt > now() - 86400` at scrape time

---

## Section 5 — Infrastructure

### `clouddrive_process_cpu_usage_ratio`
- **Type:** Gauge
- **Labels:** `container`
- **Description:** CPU utilization of the Node.js process (0.0–1.0 ratio).
- **Answers:** Q6.1
- **Collection:** `process.cpuUsage()` delta between scrapes, divided by elapsed wall-clock time

### `clouddrive_process_memory_bytes`
- **Type:** Gauge
- **Labels:** `type` (`rss`, `heap_used`, `heap_total`)
- **Description:** Node.js memory metrics from `process.memoryUsage()`.
- **Answers:** Q6.2
- **Collection:** `process.memoryUsage()` at scrape time

### `clouddrive_disk_usage_bytes`
- **Type:** Gauge
- **Labels:** `path` (`/data`, `/`)
- **Description:** Disk bytes used at the given mount path.
- **Answers:** Q6.3
- **Collection:** `df` syscall or `statvfs` via Node.js `fs.statfs()`

---

## Instrumentation Architecture

```
CloudDrive Express App
        │
        ▼
 /metrics endpoint (Prometheus text format)
        │
        ▼
   Prometheus scrape (every 15s)
        │
        ▼
     Grafana
  (dashboard panels)
```

### Implementation Notes

1. **Use `prom-client` npm package** — the de-facto Prometheus client for Node.js. Add to `server/index.ts`:
   ```ts
   import client from 'prom-client';
   const register = new client.Registry();
   client.collectDefaultMetrics({ register }); // adds Node.js process metrics automatically
   app.get('/metrics', async (req, res) => {
     res.set('Content-Type', register.contentType);
     res.end(await register.metrics());
   });
   ```

2. **`collectDefaultMetrics()`** automatically provides `process_cpu_seconds_total`, `process_resident_memory_bytes`, `nodejs_heap_size_bytes`, and more — these cover Section 5 without custom code.

3. **Audit log → metric bridge:** The audit log table already captures most security events. A scrape-time query converts audit log counts into Prometheus gauges without instrumenting every code path individually.

4. **Cardinality warning:** Do not add `user_id` as a label — this creates unbounded cardinality. Use the audit log for per-user queries.

---

## Metric Naming Conventions

- **Prefix:** all metrics use `clouddrive_` namespace
- **Units:** include unit in name (`_seconds`, `_bytes`, `_total`, `_ratio`)
- **Counters:** always end in `_total`
- **Histograms:** Prometheus auto-generates `_bucket`, `_count`, `_sum` suffixes
- **Booleans:** use a Gauge with value `0` or `1`, named `clouddrive_<thing>_up` or `clouddrive_<thing>_enabled`
