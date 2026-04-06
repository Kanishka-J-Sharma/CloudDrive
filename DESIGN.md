Technical Design Document: CloudDrive
Project Name: CloudDrive- Secure Cloud File Storage Platform
Author: Kanishka Joshi
Status: Draft / In-Review

1. EXECUTIVE SUMMARY
CloudDrive is a cloud-native file storage platform providing secure, abstracted access to AWS S3.
It allows users to manage files via a multi-container architecture without interacting with the AWS Console directly. The project specifically focuses on security hardening across the application, infrastructure, and cloud layers.

2. SYSTEM ARCHITECURE
CloudDrive uses a containerized microservices approach managed by Docker Compose.

Components:
1. Web App (Node.js/Python): Handles routing JWT authentication, and generation of S3 presigned URLs.
2. Database (PostgreSQL): Stores user metadata, file metadata, and permission records.
3. Storaage (AWS S3): Physical storage layer for binary data.
4. Monitoring (Grafana/Loki): Observability stack for security auditing.

3. REQUIREMENTS & USE CASES
  3.1 Functional Requirements
   - User Management: Secure signup/login using bcrypt hashing.
   - File Operations: Upload and download files via presigned URLs.
   - Sharing System: Assign read or read/write permissions to other users.
   - CI/CD: Automated security scanning on every scanning on every code push.

   3.2 Non-functional Requirements:
   - Security: Data encryption at rest and least-privilege IAM access.
   - Observability: Real-time logging of acces patterns and anomalies.

4. SECURITY DESIGN (The "Honey-Pot" strategy)
This project intentionally includes security vulnerabilities to demonstrate threat modeliing and mitigration.

  4.1 Known Vulnerabities
  - App Layer: Broken access control and lack of rate limiting
  - Cloud Layer: Overprivileged IAM roles and public bucket exposure risks.
  - Infra Layer: Containers running as the root user.

  4.2 Mitigations
  - IAM Scoping: Refining roles to specific S3 prefizes
  - Scanning Semgrep (SAST) and Trivy (Container Scanning) integrated into GitHub Actions.

5. DATA MODELS
- Users: id, username, password_hash, create_at
- Files: id, s3_key, owner_id, file_name, file_size
- Permissions: id, file_id, user_id, access_level (READ/WRITE)

6. OBSERVABILITY (OE)
The dashboard tracks:
- Login Anolamlies: Brute Force attempts.
- Access Patterns: Unusual spikes in file downloads.
- System Health: Docker container resource usage.

