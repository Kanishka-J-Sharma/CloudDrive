import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "clouddrive-dev-secret-change-in-prod";
const JWT_EXPIRES = "24h";

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(req: Request, res: Response, next: Function) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).userId = decoded.userId;
    (req as any).userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function auditLog(userId: number | null, action: string, resourceType: string | null, resourceId: number | null, severity: string, metadata: object, username: string | null, req?: Request) {
  storage.createAuditLog({
    userId,
    action,
    resourceType,
    resourceId,
    severity,
    metadata: JSON.stringify(metadata),
    timestamp: new Date().toISOString(),
    username,
    ipAddress: req?.ip || "0.0.0.0",
    userAgent: req?.headers["user-agent"] || null,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
}

function generatePresignedUrl(s3Key: string, operation: "get" | "put", expiresInSeconds = 3600): string {
  // Simulated presigned URL — in production would call AWS SDK
  const expiry = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(s3Key + expiry).digest("hex").slice(0, 16);
  return `https://clouddrive-files.s3.amazonaws.com/${s3Key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=${sig}&operation=${operation}`;
}

export async function registerRoutes(httpServer: Server, app: Express) {

  // ─── Auth ────────────────────────────────────────────────────────────────────

  // POST /api/auth/register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, username, password } = req.body;
      if (!email || !username || !password) return res.status(400).json({ error: "Missing fields" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const exists = storage.getUserByEmail(email) || storage.getUserByUsername(username);
      if (exists) return res.status(409).json({ error: "Email or username already in use" });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = storage.createUser({ email, username, passwordHash, createdAt: new Date().toISOString() } as any);
      auditLog(user.id, "register", "user", user.id, "info", { email }, username, req);
      res.json({ id: user.id, email: user.email, username: user.username, role: user.role });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = req.body; // identifier = email or username
      if (!identifier || !password) return res.status(400).json({ error: "Missing credentials" });

      const user = storage.getUserByEmail(identifier) || storage.getUserByUsername(identifier);
      if (!user) {
        auditLog(null, "login_failed", null, null, "warning", { identifier, reason: "User not found" }, identifier, req);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        auditLog(user.id, "login_failed", "user", user.id, "warning", { reason: "Wrong password" }, user.username, req);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const now = new Date().toISOString();
      storage.updateUserLogin(user.id, now);
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      auditLog(user.id, "login", "user", user.id, "info", {}, user.username, req);
      res.json({ token, user: { id: user.id, email: user.email, username: user.username, role: user.role } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/auth/me
  app.get("/api/auth/me", authMiddleware, (req, res) => {
    const user = storage.getUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, email: user.email, username: user.username, role: user.role, loginCount: user.loginCount, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt });
  });

  // ─── Files ───────────────────────────────────────────────────────────────────

  // GET /api/files — get my files
  app.get("/api/files", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const myFiles = storage.getFilesByOwner(userId);
    res.json(myFiles);
  });

  // GET /api/files/all — admin only
  app.get("/api/files/all", authMiddleware, (req, res) => {
    if ((req as any).userRole !== "admin") return res.status(403).json({ error: "Admin only" });
    res.json(storage.getAllFiles());
  });

  // GET /api/files/stats
  app.get("/api/files/stats", authMiddleware, (req, res) => {
    const stats = storage.getFileStats();
    const userCount = storage.getAllUsers().length;
    const auditStats = storage.getAuditStats();
    res.json({ ...stats, userCount, ...auditStats });
  });

  // POST /api/files/upload — simulate upload (create record + generate presigned PUT URL)
  app.post("/api/files/upload", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const user = storage.getUserById(userId)!;
    const { filename, mimeType, sizeBytes, description } = req.body;
    if (!filename || !mimeType || !sizeBytes) return res.status(400).json({ error: "Missing file metadata" });

    const s3Key = `${user.username}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const presignedPutUrl = generatePresignedUrl(s3Key, "put");
    const now = new Date().toISOString();

    const file = storage.createFile({
      ownerId: userId,
      filename,
      originalName: filename,
      mimeType,
      sizeBytes,
      s3Key,
      s3Bucket: "clouddrive-files",
      encryptionStatus: "AES-256",
      uploadedAt: now,
      lastAccessedAt: null,
      tags: "[]",
      description: description || null,
    });

    auditLog(userId, "upload", "file", file.id, "info", { filename, size: sizeBytes, s3Key }, user.username, req);

    res.json({ file, presignedPutUrl, message: "File record created. Use presigned URL to upload to S3." });
  });

  // GET /api/files/:id/download — generate presigned GET URL
  app.get("/api/files/:id/download", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const fileId = parseInt(req.params.id);
    const file = storage.getFileById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    const user = storage.getUserById(userId)!;

    // Access control check — intentionally broken: only checks ownership, not shares
    // SECURITY WEAKNESS: Missing check for shared access allows any authenticated user to download
    if (file.ownerId !== userId) {
      // Intentional broken access control — logs warning but proceeds
      auditLog(userId, "download", "file", fileId, "warning", {
        filename: file.filename,
        note: "Unauthorized access attempt via broken access control",
        ownerId: file.ownerId,
        requesterId: userId
      }, user.username, req);
      // In a secure implementation this would return 403
      // return res.status(403).json({ error: "Access denied" });
    } else {
      auditLog(userId, "download", "file", fileId, "info", { filename: file.filename }, user.username, req);
    }

    storage.incrementDownloadCount(fileId, new Date().toISOString());
    const presignedUrl = generatePresignedUrl(file.s3Key, "get");
    res.json({ presignedUrl, filename: file.filename, expiresIn: "1 hour", note: "URL abstracts AWS S3 — clients never access S3 directly." });
  });

  // DELETE /api/files/:id
  app.delete("/api/files/:id", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const fileId = parseInt(req.params.id);
    const file = storage.getFileById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });
    if (file.ownerId !== userId && (req as any).userRole !== "admin") return res.status(403).json({ error: "Access denied" });
    storage.deleteFile(fileId);
    const user = storage.getUserById(userId)!;
    auditLog(userId, "delete", "file", fileId, "info", { filename: file.filename }, user.username, req);
    res.json({ success: true });
  });

  // ─── Shares ──────────────────────────────────────────────────────────────────

  // GET /api/shares — get all my outgoing shares
  app.get("/api/shares", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const outgoing = storage.getSharesByOwner(userId);
    const incoming = storage.getSharesWithUser(userId);
    // Enrich with file and user data
    const enrichShare = (s: any) => {
      const file = storage.getFileById(s.fileId);
      const sharedWith = s.sharedWithId ? storage.getUserById(s.sharedWithId) : null;
      return { ...s, file: file ? { id: file.id, filename: file.filename, mimeType: file.mimeType, sizeBytes: file.sizeBytes } : null, sharedWithUser: sharedWith ? { id: sharedWith.id, username: sharedWith.username, email: sharedWith.email } : null };
    };
    res.json({ outgoing: outgoing.map(enrichShare), incoming: incoming.map(enrichShare) });
  });

  // POST /api/shares — create a share
  app.post("/api/shares", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const { fileId, sharedWithUsername, permission, expiresAt } = req.body;
    if (!fileId || !permission) return res.status(400).json({ error: "Missing fields" });

    const file = storage.getFileById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });
    if (file.ownerId !== userId) return res.status(403).json({ error: "Not your file" });

    let sharedWithId: number | null = null;
    if (sharedWithUsername) {
      const targetUser = storage.getUserByUsername(sharedWithUsername);
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      sharedWithId = targetUser.id;
    }

    const shareToken = "tok_" + crypto.randomBytes(12).toString("hex");
    const now = new Date().toISOString();
    const share = storage.createShare({
      fileId,
      ownerId: userId,
      sharedWithId,
      permission,
      shareToken,
      expiresAt: expiresAt || null,
      createdAt: now,
      isActive: true,
    });

    const user = storage.getUserById(userId)!;
    auditLog(userId, "share", "share", share.id, "info", { fileId, sharedWith: sharedWithUsername || "public", permission }, user.username, req);
    res.json(share);
  });

  // DELETE /api/shares/:id
  app.delete("/api/shares/:id", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const shareId = parseInt(req.params.id);
    storage.revokeShare(shareId);
    const user = storage.getUserById(userId)!;
    auditLog(userId, "revoke_share", "share", shareId, "info", {}, user.username, req);
    res.json({ success: true });
  });

  // ─── Audit Logs ──────────────────────────────────────────────────────────────

  // GET /api/audit — admin or get own logs
  app.get("/api/audit", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const role = (req as any).userRole;
    const limit = parseInt(req.query.limit as string) || 100;
    if (role === "admin") {
      res.json(storage.getAuditLogs(limit));
    } else {
      res.json(storage.getAuditLogsByUser(userId));
    }
  });

  // GET /api/audit/stats
  app.get("/api/audit/stats", authMiddleware, (req, res) => {
    res.json(storage.getAuditStats());
  });

  // ─── Users ───────────────────────────────────────────────────────────────────

  // GET /api/users — admin only
  app.get("/api/users", authMiddleware, (req, res) => {
    if ((req as any).userRole !== "admin") return res.status(403).json({ error: "Admin only" });
    const users = storage.getAllUsers().map(u => ({ id: u.id, email: u.email, username: u.username, role: u.role, loginCount: u.loginCount, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, isActive: u.isActive }));
    res.json(users);
  });

  // GET /api/security/report — intentional vulnerabilities summary
  app.get("/api/security/report", authMiddleware, (req, res) => {
    res.json({
      reportedAt: new Date().toISOString(),
      vulnerabilities: [
        {
          layer: "Application",
          id: "APP-001",
          title: "Broken Access Control",
          severity: "Critical",
          description: "Any authenticated user can download files they do not own by hitting /api/files/:id/download with a valid JWT. The check is bypassed instead of enforcing 403.",
          cvss: "9.1",
          cwe: "CWE-284",
          remediation: "Enforce file ownership or share permission check before issuing presigned URL."
        },
        {
          layer: "Application",
          id: "APP-002",
          title: "Missing Rate Limiting",
          severity: "High",
          description: "Login endpoint /api/auth/login has no brute-force protection. Mallory's 3 failed attempts in 90 seconds triggered no lockout.",
          cvss: "7.5",
          cwe: "CWE-307",
          remediation: "Implement rate limiting (e.g., 5 attempts / 15 min per IP) with exponential backoff."
        },
        {
          layer: "Cloud / IAM",
          id: "CLD-001",
          title: "Overprivileged IAM Role",
          severity: "High",
          description: "The EC2 instance IAM role has s3:* on * instead of scoped read/write on clouddrive-files/* only. Credential leak would expose all S3 buckets.",
          cvss: "8.2",
          cwe: "CWE-272",
          remediation: "Scope IAM policy to s3:GetObject and s3:PutObject on arn:aws:s3:::clouddrive-files/* only."
        },
        {
          layer: "Cloud / IAM",
          id: "CLD-002",
          title: "Misconfigured Bucket Policy",
          severity: "Critical",
          description: "The S3 bucket policy grants s3:GetObject to Principal:* (public read) without requiring authenticated access, exposing all stored files.",
          cvss: "9.8",
          cwe: "CWE-732",
          remediation: "Remove public principal. Require presigned URL auth or restrict to the application IAM role only."
        },
        {
          layer: "Infrastructure",
          id: "INF-001",
          title: "Container Running as Root",
          severity: "High",
          description: "The web app Docker container runs as UID 0 (root). Container breakout would give full host privileges.",
          cvss: "8.6",
          cwe: "CWE-250",
          remediation: "Add USER 1001:1001 to Dockerfile and run with --security-opt no-new-privileges."
        }
      ],
      iamPolicy: {
        current: { "Effect": "Allow", "Action": "s3:*", "Resource": "*" },
        recommended: { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::clouddrive-files/*" }
      },
      bucketPolicy: {
        current: { "Principal": "*", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::clouddrive-files/*" },
        recommended: { "Principal": { "AWS": "arn:aws:iam::123456789:role/clouddrive-app" }, "Action": "s3:GetObject", "Resource": "arn:aws:s3:::clouddrive-files/*" }
      }
    });
  });
}
