# CloudDrive — Operational State Questions

> **Purpose:** These are the questions an on-call engineer or engineering manager must be able to answer immediately — within seconds — when asked "Is CloudDrive healthy right now?" Good data answers these questions clearly and unambiguously. The OE dashboard exists to make these answers visible at a glance.

---

## 1. Is the Service Up?

| # | Question | Why It Matters |
|---|----------|---------------|
| 1.1 | Is the CloudDrive API responding? | A dead API means zero users can log in or access files. |
| 1.2 | What is the current HTTP error rate (5xx / total)? | Elevated 5xx means requests are failing even if the service appears "up". |
| 1.3 | What is the p50 / p95 / p99 API latency right now? | Slow responses degrade UX and signal backend pressure. |
| 1.4 | How many active containers are running? | Container crashes shrink capacity without taking the service fully down. |
| 1.5 | Is the database reachable and accepting queries? | SQLite/PostgreSQL unavailability makes the entire app non-functional. |

---

## 2. Are Users Able to Use It?

| # | Question | Why It Matters |
|---|----------|---------------|
| 2.1 | How many users logged in successfully in the last 60 minutes? | Low logins when activity is expected signals auth failures or an outage. |
| 2.2 | How many login attempts failed in the last 60 minutes? | Elevated failures indicate credential stuffing, brute-force, or a broken auth flow. |
| 2.3 | How many file uploads succeeded vs. failed in the last hour? | Failed uploads are the core user action failing — direct user impact. |
| 2.4 | How many file downloads completed vs. failed? | Download failures block users from retrieving their data. |
| 2.5 | Are presigned URL generations succeeding? | Presigned URL failures silently break uploads/downloads for users. |

---

## 3. Is Anything Under Attack or Abused?

| # | Question | Why It Matters |
|---|----------|---------------|
| 3.1 | Is any single IP or user account generating an unusual volume of login attempts? | Brute-force attacks exploit the missing rate-limit vulnerability (APP-002). |
| 3.2 | Are there file download requests for files that don't belong to the requesting user? | Broken access control (APP-001) means unauthorized downloads are possible — detecting them is critical. |
| 3.3 | How many audit log entries of type `UNAUTHORIZED_DOWNLOAD` exist in the last hour? | Tracks active exploitation of the access control bug. |
| 3.4 | Are there anomalous spikes in API request volume from a single source? | Could indicate enumeration, scraping, or a denial-of-service attempt. |
| 3.5 | Have any admin-only endpoints (`/api/users`, `/api/files/all`) been hit by non-admin accounts? | Privilege escalation attempts should be detected immediately. |

---

## 4. What Is the Data Footprint?

| # | Question | Why It Matters |
|---|----------|---------------|
| 4.1 | How many total files are stored across all users? | Growth rate tells us when storage will become a concern. |
| 4.2 | How many active shares exist, and how many are read/write vs. read-only? | Overly permissive shares are a data-leak risk. |
| 4.3 | What is the total storage volume consumed (GB)? | Drives capacity planning and cost forecasting. |
| 4.4 | How many user accounts exist, and how many were created in the last 24 hours? | Sudden account creation spikes may indicate abuse or a viral growth event. |

---

## 5. Are Security Controls Working?

| # | Question | Why It Matters |
|---|----------|---------------|
| 5.1 | How many known security vulnerabilities are currently open? | Regression check — vulnerabilities should not silently re-appear after remediation. |
| 5.2 | Is the container running as root? | INF-001 is a known intentional finding — the dashboard should flag if it changes. |
| 5.3 | Is the S3 bucket policy still public? | CLD-002 means any file is publicly accessible — this must be visible at all times. |
| 5.4 | Are JWT tokens being accepted that were issued before the last secret rotation? | Token replay attacks after a key rotation event. |
| 5.5 | How many `SECURITY_SCAN` or `POLICY_VIOLATION` events are in the audit log today? | Upstream CI/CD security scan results surfaced at the ops layer. |

---

## 6. Is the Infrastructure Healthy?

| # | Question | Why It Matters |
|---|----------|---------------|
| 6.1 | What is CPU utilization across the app container? | Sustained high CPU means the app is struggling under load. |
| 6.2 | What is memory utilization? | Memory leaks cause container OOM-kills, which look like random restarts. |
| 6.3 | What is disk utilization on the host? | SQLite is stored on disk — a full disk kills writes silently. |
| 6.4 | How long has the app container been running (uptime)? | Recent restarts indicate crashes or forced deploys. |
| 6.5 | Are there any recent Docker container exits logged? | Exit codes reveal whether restarts were intentional or crash-induced. |

---

## Summary

The six categories above map to the **six dashboard sections** in the OE dashboard. An on-call engineer should be able to answer all questions above within 30 seconds of opening the dashboard. If any question requires digging into logs or running ad-hoc queries, that question needs a panel added to the dashboard.
