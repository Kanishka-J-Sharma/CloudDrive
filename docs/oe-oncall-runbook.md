# CloudDrive — On-Call OE Dashboard Runbook

> **Audience:** On-call engineer who receives an alert or a ping saying something is wrong with CloudDrive.
> **Assumption:** The OE dashboard is open in the browser. This runbook walks through how to use it to diagnose and respond.

---

## How to Open the Dashboard

1. Navigate to `http://localhost:3001` (or the deployed Grafana URL).
2. Log in with `admin / admin` (change this in production).
3. Open the **CloudDrive OE** dashboard from the Dashboards menu.
4. Set the time range to **Last 1 hour** as the default starting point. Zoom in or out as needed.

---

## Triage Flowchart

When paged or alerted, work top-to-bottom through the six dashboard sections in order. Each section answers a specific class of question. Stop when you find the problem.

```
Is the service up?
       │
       ├── NO  → [Section 1] Service is down or degraded. See §1 below.
       │
       └── YES → Are users able to use it?
                       │
                       ├── NO  → [Section 2] Auth or file ops broken. See §2 below.
                       │
                       └── YES → Is there a security event?
                                       │
                                       ├── YES → [Section 3] Active attack or violation. See §3 below.
                                       │
                                       └── NO  → Is the data footprint anomalous?
                                                       │
                                                       ├── YES → [Section 4] Storage/user spike. See §4.
                                                       │
                                                       └── NO  → Is infra healthy?
                                                                       │
                                                                       └── [Section 5/6] See §5.
```

---

## Section 1 — Service Health

### Panel: API Error Rate

**What you see:** Percentage of HTTP responses with status 5xx over total requests.

**Thresholds:**
- Green: < 1%
- Yellow: 1–5% — investigate, may be transient
- Red: > 5% — active incident

**If red:**
1. Look at the **Top Error Routes** panel — which endpoint is throwing 5xx?
2. If `/api/auth/login` is erroring → database may be down (check Section 6, DB panel).
3. If `/api/files/:id/download` is erroring → S3/presigned URL generation is failing.
4. If all routes are erroring → app container may be OOM or CPU-starved (check Section 6).
5. **Action:** `docker compose logs webapp --tail=100` to read stack traces.

### Panel: API Latency (p95)

**What you see:** p95 request duration in milliseconds.

**Thresholds:**
- Green: < 200 ms
- Yellow: 200–500 ms
- Red: > 500 ms

**If red:**
1. Check **DB Query Latency** panel in Section 6. If DB is slow → SQLite lock contention (too many concurrent writes).
2. If DB is fine → CPU pressure (check CPU panel in Section 6).
3. **Action:** Review slow route in the **Latency by Route** heatmap.

### Panel: Container Uptime

**What you see:** How long each container has been running (webapp, grafana, prometheus).

**If webapp uptime is < 10 minutes:** Container restarted recently.
- **Action:** `docker compose ps` and `docker compose logs webapp --tail=50` to find exit reason.

---

## Section 2 — User Activity

### Panel: Login Success vs. Failure Rate

**What you see:** Two time-series lines — successful and failed logins per minute.

**Normal pattern:** Failures are typically < 5% of attempts.

**Scenario A — Login failures spike with no success spike:**
- Users are trying to log in but failing. Either:
  - Auth endpoint is broken (check Section 1 error rate on `/api/auth/login`)
  - A bot is credential-stuffing (cross-reference Section 3 brute-force panel)
- **Action:** Check `clouddrive_auth_events_total{event_type="login_failure"}` raw count. If > 50 in 10 min, escalate to security.

**Scenario B — All activity drops to zero:**
- Service is unavailable or load dropped suddenly.
- **Action:** Verify Section 1 is green. If green, check if this is expected (maintenance window, low-traffic time).

### Panel: File Upload / Download Success Rate

**What you see:** Success vs. failure counts for upload and download operations.

**If download failures spike:**
- Most likely cause: presigned URL generation failure.
- **Action:** Check `clouddrive_presigned_url_generations_total{result="failure"}`. If elevated, check S3/storage backend config.

**If upload failures spike:**
- Could be disk full (check Section 6 disk panel) or a server-side validation bug.
- **Action:** `docker compose logs webapp 2>&1 | grep -i "upload\|error"`.

---

## Section 3 — Security Anomalies

> **Important context for CloudDrive:** Three intentional vulnerabilities are active in this deployment (APP-001 broken access control, APP-002 missing rate limits, CLD-002 public bucket). The panels in this section reflect these known risks. Any spike is a real event even though the vulnerability is known.

### Panel: Unauthorized Download Attempts

**What you see:** Count of audit log entries with `action = UNAUTHORIZED_DOWNLOAD`.

**Any non-zero value is a security event.** This means a user requested a file that does not belong to them, and the broken access control (APP-001) may have served it anyway.

**Triage steps:**
1. Note the count. Is it 1–2 (probing) or hundreds (active exploitation)?
2. Cross-reference the **Top Offending Users** panel — which `userId` is responsible?
3. Check the audit log directly: `GET /api/audit` (as admin) filtered by `UNAUTHORIZED_DOWNLOAD`.
4. **Action — active exploitation:** Disable the affected user account immediately via the admin API (`DELETE /api/users/:id` or set `active = false` in DB). File a security incident.
5. **Action — single probe:** Log the event. If the same user repeats, escalate.

### Panel: Brute-Force Login Candidates

**What you see:** IP addresses or usernames with ≥ 5 failed logins in the last 10 minutes.

**Because APP-002 (missing rate limits) is not remediated**, there is no automatic blocking. This panel is the only defense.

**Triage steps:**
1. Identify the source IP from the audit log or server logs.
2. If targeting a specific username → that account may be compromised if a success follows.
3. **Action:** Add an IP block at the reverse proxy / firewall level (outside CloudDrive, since the app has no enforcement). Alert on any subsequent `login_success` from the same source.

### Panel: Admin Endpoint Access by Non-Admins

**What you see:** Count of 403 responses on `/api/users` and `/api/files/all`.

**If non-zero:** A non-admin user is probing admin endpoints.
- **Action:** Check the audit log for the userId behind the 403s. If repeated, this is privilege escalation reconnaissance.

### Panel: Known Open Vulnerabilities

**What you see:** A stat panel with counts by severity (Critical / High / Medium / Low).

**This panel does not alert on new attacks — it shows the current security debt.**

**If a count changes unexpectedly:**
- Increase: a new vulnerability was discovered (check last CI/CD Semgrep/Trivy run).
- Decrease to zero incorrectly: the data source was reset; verify the actual security posture.

---

## Section 4 — Data Footprint

### Panel: File Count and Storage Volume

**What you see:** Total files stored and total bytes consumed over time.

**Normal:** Gradual linear growth.

**Anomaly — sudden spike in files or storage:**
- Could be an upload abuse attack (bulk uploading to exhaust storage).
- **Action:** Check `clouddrive_file_operations_total{operation="upload"}` — is one user responsible? Check the audit log.

### Panel: New User Registrations (24h)

**Anomaly — spike in new accounts (e.g., > 10x baseline):**
- Could be bot account creation (account farming, credential warehouse).
- **Action:** Query `SELECT username, createdAt FROM users ORDER BY createdAt DESC LIMIT 50` and look for patterns (sequential names, same email domain).

### Panel: Active Shares by Permission

**What you see:** Count of read-only vs. read-write shares.

**Concern:** A sudden jump in read-write shares is a data integrity risk (more users can modify files).
- **Action:** Review recent share-creation events in the audit log.

---

## Section 5 — Security Posture (Static Checks)

| Check | Dashboard Indicator | Remediation |
|-------|--------------------|-|
| Container running as root (INF-001) | Red badge in Security panel | Add `user: "1000:1000"` to docker-compose.yml |
| S3 bucket publicly readable (CLD-002) | Red badge | Remove `Principal: "*"` from bucket policy |
| IAM role has `s3:*` on `*` (CLD-001) | Red badge | Scope to specific bucket ARN and required actions only |
| Broken access control active (APP-001) | Warning badge | Add `userId` ownership check in download route |
| Rate limiting absent (APP-002) | Warning badge | Add express-rate-limit middleware to `/api/auth/login` |

---

## Section 6 — Infrastructure Health

### Panel: CPU Utilization

**Threshold:** Alert if > 80% sustained for 5 minutes.
- **Action:** Check which process is consuming CPU: `docker stats`. If it's the webapp, look for a request loop or a costly DB query.

### Panel: Memory (RSS / Heap Used)

**Threshold:** Alert if heap_used > 80% of heap_total, or if RSS grows unboundedly.
- **Action:** Look for memory leaks — objects accumulating in the presigned URL cache or audit log buffer. Restart container as a last resort.

### Panel: Disk Utilization

**Threshold:** Alert if > 85% full.
- **Action:** The SQLite database (`clouddrive.db`) and uploaded file metadata are on disk. Run `du -sh /data/*` inside the container. Delete orphaned upload records if needed.

---

## Common Incident Scenarios

### Scenario 1: "The site is down"

1. Check **Service Health** panel — is error rate 100%?
2. `docker compose ps` — is the webapp container running?
3. If container exited: `docker compose logs webapp --tail=50` → find the error.
4. Most common causes: SQLite file permission error, port 5000 already in use, OOM kill.
5. Restart: `docker compose up -d webapp`.

### Scenario 2: "Users can't log in"

1. Confirm login failure rate is elevated in Section 2.
2. Test manually: `curl -X POST http://localhost:5000/api/auth/login -d '{"username":"alice","password":"password123"}'`.
3. If 500 → database error (check `/api/audit` endpoint or DB health panel).
4. If 401 on correct credentials → JWT secret may have changed or bcrypt comparison is broken.

### Scenario 3: "Mallory is downloading other users' files"

1. Section 3 — Unauthorized Download Attempts panel will show a spike.
2. Check audit log: `GET /api/audit` as alice (admin) — filter for `UNAUTHORIZED_DOWNLOAD`.
3. Confirm which files were accessed and whether they were actually served (HTTP 200 on download route = served, HTTP 403 = blocked — note: APP-001 means they ARE served).
4. Notify file owner(s). Disable mallory's account. Document the incident.
5. Long-term fix: implement ownership check in `GET /api/files/:id/download`.

### Scenario 4: "Performance is degraded"

1. Section 1 — API Latency p95 > 500 ms.
2. Check DB Query Latency panel — is SQLite slow?
3. Check CPU/Memory panels in Section 6.
4. If DB is slow: look for a missing index or a large table scan. Run `EXPLAIN QUERY PLAN` on the slow query.
5. If CPU is high: check for a runaway loop or a burst of concurrent requests.

---

## Escalation Contacts

| Situation | Escalate To |
|-----------|-------------|
| Active security exploit (unauthorized downloads > 10/hr) | Security team + product owner immediately |
| Service down > 5 minutes | Engineering lead |
| Data loss suspected | Engineering lead + legal/compliance |
| Brute-force attack in progress | Security team; consider firewall block |

---

## Useful Commands

```bash
# View live container logs
docker compose logs -f webapp

# Check all container status
docker compose ps

# Restart a single container
docker compose restart webapp

# Open a shell in the webapp container
docker compose exec webapp sh

# Query the audit log directly
sqlite3 clouddrive.db "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20;"

# Check disk usage inside container
docker compose exec webapp df -h

# Tail Prometheus metrics endpoint
curl http://localhost:5000/metrics | grep clouddrive_
```
