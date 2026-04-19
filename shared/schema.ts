import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // "user" | "admin"
  createdAt: text("created_at").notNull(),
  lastLoginAt: text("last_login_at"),
  loginCount: integer("login_count").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
  loginCount: true,
  isActive: true,
  role: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Files ────────────────────────────────────────────────────────────────────
export const files = sqliteTable("files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: real("size_bytes").notNull(),
  s3Key: text("s3_key").notNull().unique(),
  s3Bucket: text("s3_bucket").notNull().default("clouddrive-files"),
  encryptionStatus: text("encryption_status").notNull().default("AES-256"),
  uploadedAt: text("uploaded_at").notNull(),
  lastAccessedAt: text("last_accessed_at"),
  downloadCount: integer("download_count").notNull().default(0),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
  tags: text("tags").notNull().default("[]"), // JSON array
  description: text("description"),
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  uploadedAt: true,
  lastAccessedAt: true,
  downloadCount: true,
  isDeleted: true,
});
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// ─── Shares ───────────────────────────────────────────────────────────────────
export const shares = sqliteTable("shares", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileId: integer("file_id").notNull().references(() => files.id),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  sharedWithId: integer("shared_with_id").references(() => users.id), // null = public link
  permission: text("permission").notNull().default("read"), // "read" | "read_write"
  shareToken: text("share_token").notNull().unique(),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  accessCount: integer("access_count").notNull().default(0),
});

export const insertShareSchema = createInsertSchema(shares).omit({
  id: true,
  createdAt: true,
  accessCount: true,
});
export type InsertShare = z.infer<typeof insertShareSchema>;
export type Share = typeof shares.$inferSelect;

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // "login" | "logout" | "upload" | "download" | "share" | "delete" | "login_failed"
  resourceType: text("resource_type"), // "file" | "share" | "user"
  resourceId: integer("resource_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata").notNull().default("{}"), // JSON
  severity: text("severity").notNull().default("info"), // "info" | "warning" | "critical"
  timestamp: text("timestamp").notNull(),
  username: text("username"), // denormalized for faster lookup
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ─── Presigned URL Cache ───────────────────────────────────────────────────────
export const presignedUrls = sqliteTable("presigned_urls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileId: integer("file_id").notNull().references(() => files.id),
  requestedById: integer("requested_by_id").notNull().references(() => users.id),
  url: text("url").notNull(),
  operation: text("operation").notNull().default("get"), // "get" | "put"
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  used: integer("used", { mode: "boolean" }).notNull().default(false),
});

export type PresignedUrl = typeof presignedUrls.$inferSelect;
