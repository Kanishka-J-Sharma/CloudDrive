import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, like, or, isNull } from "drizzle-orm";
import {
  users, files, shares, auditLogs, presignedUrls,
  type User, type InsertUser,
  type File, type InsertFile,
  type Share, type InsertShare,
  type AuditLog, type InsertAuditLog,
} from "@shared/schema";

const sqlite = new Database("clouddrive.db");
const db = drizzle(sqlite);

// ─── Init tables ──────────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    login_count INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes REAL NOT NULL,
    s3_key TEXT NOT NULL UNIQUE,
    s3_bucket TEXT NOT NULL DEFAULT 'clouddrive-files',
    encryption_status TEXT NOT NULL DEFAULT 'AES-256',
    uploaded_at TEXT NOT NULL,
    last_accessed_at TEXT,
    download_count INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    description TEXT
  );
  CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(id),
    owner_id INTEGER NOT NULL REFERENCES users(id),
    shared_with_id INTEGER REFERENCES users(id),
    permission TEXT NOT NULL DEFAULT 'read',
    share_token TEXT NOT NULL UNIQUE,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    access_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    severity TEXT NOT NULL DEFAULT 'info',
    timestamp TEXT NOT NULL,
    username TEXT
  );
  CREATE TABLE IF NOT EXISTS presigned_urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(id),
    requested_by_id INTEGER NOT NULL REFERENCES users(id),
    url TEXT NOT NULL,
    operation TEXT NOT NULL DEFAULT 'get',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
`);

// ─── Seed demo data if empty ──────────────────────────────────────────────────
const userCount = sqlite.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
if (userCount.c === 0) {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();

  // bcrypt hash for "password123"
  const hash = "$2b$10$ZY0mqftF3Cx.wHLzHOG/z.fjzMhk9eRY.nedxenDMtSRDPBFyOxXu";

  sqlite.prepare(`INSERT INTO users (email,username,password_hash,role,created_at,login_count,last_login_at) VALUES (?,?,?,?,?,?,?)`).run("alice@clouddrive.io","alice",hash,"admin",twoDaysAgo,24,yesterday);
  sqlite.prepare(`INSERT INTO users (email,username,password_hash,role,created_at,login_count,last_login_at) VALUES (?,?,?,?,?,?,?)`).run("bob@clouddrive.io","bob",hash,"user",twoDaysAgo,7,now);
  sqlite.prepare(`INSERT INTO users (email,username,password_hash,role,created_at,login_count,last_login_at) VALUES (?,?,?,?,?,?,?)`).run("mallory@clouddrive.io","mallory",hash,"user",yesterday,2,now);

  const s3Base = "clouddrive-files/";
  const fileSeeds = [
    {oid:1,fn:"Q1_Report_2026.pdf",mn:"application/pdf",sz:2457600,sk:s3Base+"alice/q1report.pdf",ua:yesterday},
    {oid:1,fn:"Architecture_Diagram.png",mn:"image/png",sz:1048576,sk:s3Base+"alice/arch.png",ua:now},
    {oid:1,fn:"deploy.sh",mn:"text/x-shellscript",sz:4096,sk:s3Base+"alice/deploy.sh",ua:twoDaysAgo},
    {oid:1,fn:"iam_policy.json",mn:"application/json",sz:8192,sk:s3Base+"alice/iam_policy.json",ua:twoDaysAgo},
    {oid:2,fn:"meeting_notes.docx",mn:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",sz:102400,sk:s3Base+"bob/meeting.docx",ua:now},
    {oid:2,fn:"budget.xlsx",mn:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",sz:512000,sk:s3Base+"bob/budget.xlsx",ua:yesterday},
    {oid:3,fn:"recon_scan.txt",mn:"text/plain",sz:32768,sk:s3Base+"mallory/scan.txt",ua:now},
  ];

  for (const f of fileSeeds) {
    sqlite.prepare(`INSERT INTO files (owner_id,filename,original_name,mime_type,size_bytes,s3_key,uploaded_at,download_count) VALUES (?,?,?,?,?,?,?,?)`).run(f.oid,f.fn,f.fn,f.mn,f.sz,f.sk,f.ua,Math.floor(Math.random()*50));
  }

  // Shares
  const shareToken1 = "tok_abc123def456";
  const shareToken2 = "tok_xyz789uvw000";
  sqlite.prepare(`INSERT INTO shares (file_id,owner_id,shared_with_id,permission,share_token,created_at,access_count) VALUES (?,?,?,?,?,?,?)`).run(1,1,2,"read",shareToken1,yesterday,3);
  sqlite.prepare(`INSERT INTO shares (file_id,owner_id,shared_with_id,permission,share_token,created_at,access_count) VALUES (?,?,?,?,?,?,?)`).run(2,1,2,"read_write",shareToken2,now,0);

  // Audit logs
  const auditSeeds = [
    {uid:3,act:"login_failed",rt:null,ri:null,sev:"warning",ts:new Date(Date.now()-3600000).toISOString(),uname:"mallory",meta:JSON.stringify({reason:"Invalid password",attempt:1})},
    {uid:3,act:"login_failed",rt:null,ri:null,sev:"warning",ts:new Date(Date.now()-3500000).toISOString(),uname:"mallory",meta:JSON.stringify({reason:"Invalid password",attempt:2})},
    {uid:3,act:"login_failed",rt:null,ri:null,sev:"critical",ts:new Date(Date.now()-3400000).toISOString(),uname:"mallory",meta:JSON.stringify({reason:"Invalid password",attempt:3})},
    {uid:3,act:"login",rt:"user",ri:3,sev:"info",ts:new Date(Date.now()-3300000).toISOString(),uname:"mallory",meta:"{}"},
    {uid:3,act:"download",rt:"file",ri:1,sev:"warning",ts:new Date(Date.now()-3000000).toISOString(),uname:"mallory",meta:JSON.stringify({filename:"Q1_Report_2026.pdf",note:"Unauthorized access attempt via broken access control"})},
    {uid:1,act:"upload",rt:"file",ri:1,sev:"info",ts:twoDaysAgo,uname:"alice",meta:JSON.stringify({filename:"Q1_Report_2026.pdf",size:2457600})},
    {uid:1,act:"share",rt:"share",ri:1,sev:"info",ts:yesterday,uname:"alice",meta:JSON.stringify({sharedWith:"bob",permission:"read"})},
    {uid:2,act:"download",rt:"file",ri:1,sev:"info",ts:yesterday,uname:"bob",meta:JSON.stringify({filename:"Q1_Report_2026.pdf"})},
    {uid:1,act:"login",rt:"user",ri:1,sev:"info",ts:yesterday,uname:"alice",meta:"{}"},
    {uid:2,act:"login",rt:"user",ri:2,sev:"info",ts:now,uname:"bob",meta:"{}"},
    {uid:3,act:"download",rt:"file",ri:3,sev:"warning",ts:new Date(Date.now()-1800000).toISOString(),uname:"mallory",meta:JSON.stringify({filename:"deploy.sh",note:"Sensitive script accessed by unauthorized user"})},
    {uid:3,act:"download",rt:"file",ri:4,sev:"critical",ts:new Date(Date.now()-900000).toISOString(),uname:"mallory",meta:JSON.stringify({filename:"iam_policy.json",note:"IAM policy file accessed — potential credential exfiltration"})},
  ];
  for (const a of auditSeeds) {
    sqlite.prepare(`INSERT INTO audit_logs (user_id,action,resource_type,resource_id,severity,timestamp,username,metadata,ip_address) VALUES (?,?,?,?,?,?,?,?,?)`).run(a.uid,a.act,a.rt,a.ri,a.sev,a.ts,a.uname,a.meta,"192.168.1." + Math.floor(Math.random()*254+1));
  }
}

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IStorage {
  // Users
  getUserById(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  getUserByUsername(username: string): User | undefined;
  getAllUsers(): User[];
  createUser(data: InsertUser & { passwordHash: string; createdAt: string }): User;
  updateUserLogin(id: number, timestamp: string): void;

  // Files
  getFileById(id: number): File | undefined;
  getFilesByOwner(ownerId: number): File[];
  getAllFiles(): File[];
  createFile(data: Omit<File, "id" | "downloadCount" | "isDeleted">): File;
  incrementDownloadCount(id: number, timestamp: string): void;
  deleteFile(id: number): void;
  getFileStats(): { totalFiles: number; totalSizeBytes: number; totalDownloads: number };

  // Shares
  getSharesByFile(fileId: number): Share[];
  getSharesByOwner(ownerId: number): Share[];
  getSharesWithUser(userId: number): Share[];
  getShareByToken(token: string): Share | undefined;
  createShare(data: Omit<Share, "id" | "accessCount">): Share;
  revokeShare(id: number): void;
  incrementShareAccess(id: number): void;

  // Audit Logs
  getAuditLogs(limit?: number): AuditLog[];
  getAuditLogsByUser(userId: number): AuditLog[];
  createAuditLog(data: Omit<AuditLog, "id">): AuditLog;
  getAuditStats(): { totalEvents: number; criticalCount: number; warningCount: number; uniqueUsers: number };
}

export class Storage implements IStorage {
  // Users
  getUserById(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  getUserByUsername(username: string) {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  getAllUsers() {
    return db.select().from(users).all();
  }
  createUser(data: any) {
    return db.insert(users).values(data).returning().get();
  }
  updateUserLogin(id: number, timestamp: string) {
    sqlite.prepare("UPDATE users SET last_login_at=?, login_count=login_count+1 WHERE id=?").run(timestamp, id);
  }

  // Files
  getFileById(id: number) {
    return db.select().from(files).where(and(eq(files.id, id), eq(files.isDeleted, false))).get();
  }
  getFilesByOwner(ownerId: number) {
    return db.select().from(files).where(and(eq(files.ownerId, ownerId), eq(files.isDeleted, false))).all();
  }
  getAllFiles() {
    return db.select().from(files).where(eq(files.isDeleted, false)).all();
  }
  createFile(data: any) {
    return db.insert(files).values({ ...data, downloadCount: 0, isDeleted: false }).returning().get();
  }
  incrementDownloadCount(id: number, timestamp: string) {
    sqlite.prepare("UPDATE files SET download_count=download_count+1, last_accessed_at=? WHERE id=?").run(timestamp, id);
  }
  deleteFile(id: number) {
    sqlite.prepare("UPDATE files SET is_deleted=1 WHERE id=?").run(id);
  }
  getFileStats() {
    const row = sqlite.prepare("SELECT COUNT(*) as total, SUM(size_bytes) as total_size, SUM(download_count) as total_dl FROM files WHERE is_deleted=0").get() as any;
    return { totalFiles: row.total || 0, totalSizeBytes: row.total_size || 0, totalDownloads: row.total_dl || 0 };
  }

  // Shares
  getSharesByFile(fileId: number) {
    return db.select().from(shares).where(and(eq(shares.fileId, fileId), eq(shares.isActive, true))).all();
  }
  getSharesByOwner(ownerId: number) {
    return db.select().from(shares).where(and(eq(shares.ownerId, ownerId), eq(shares.isActive, true))).all();
  }
  getSharesWithUser(userId: number) {
    return db.select().from(shares).where(and(eq(shares.sharedWithId, userId), eq(shares.isActive, true))).all();
  }
  getShareByToken(token: string) {
    return db.select().from(shares).where(and(eq(shares.shareToken, token), eq(shares.isActive, true))).get();
  }
  createShare(data: any) {
    return db.insert(shares).values({ ...data, accessCount: 0 }).returning().get();
  }
  revokeShare(id: number) {
    sqlite.prepare("UPDATE shares SET is_active=0 WHERE id=?").run(id);
  }
  incrementShareAccess(id: number) {
    sqlite.prepare("UPDATE shares SET access_count=access_count+1 WHERE id=?").run(id);
  }

  // Audit Logs
  getAuditLogs(limit = 200) {
    return sqlite.prepare(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?`).all(limit) as AuditLog[];
  }
  getAuditLogsByUser(userId: number) {
    return db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).all();
  }
  createAuditLog(data: any) {
    return db.insert(auditLogs).values(data).returning().get();
  }
  getAuditStats() {
    const total = (sqlite.prepare("SELECT COUNT(*) as c FROM audit_logs").get() as any).c;
    const critical = (sqlite.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE severity='critical'").get() as any).c;
    const warning = (sqlite.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE severity='warning'").get() as any).c;
    const unique = (sqlite.prepare("SELECT COUNT(DISTINCT user_id) as c FROM audit_logs WHERE user_id IS NOT NULL").get() as any).c;
    return { totalEvents: total, criticalCount: critical, warningCount: warning, uniqueUsers: unique };
  }
}

export const storage = new Storage();
