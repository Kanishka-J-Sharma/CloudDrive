import React, { useState, useEffect, useRef } from "react";
import { api, useAuth } from "./App";
import ShareModal from "./ShareModal";

const styles = {
  page:     { minHeight: "100vh", background: "#f5f7fa" },
  nav: {
    background: "#fff", padding: "0 2rem", height: 56,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    boxShadow: "0 1px 0 #e5e7eb",
  },
  navTitle: { fontWeight: 700, fontSize: 18, color: "#4f46e5" },
  navRight: { display: "flex", alignItems: "center", gap: 16, fontSize: 14 },
  body:     { maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" },
  section:  { background: "#fff", borderRadius: 12, padding: "1.5rem", marginBottom: 24,
               boxShadow: "0 2px 8px rgba(0,0,0,.06)" },
  h2:       { fontSize: 16, fontWeight: 700, marginBottom: 16 },
  uploadZone: {
    border: "2px dashed #c7d2fe", borderRadius: 10, padding: "1.5rem",
    textAlign: "center", cursor: "pointer", color: "#6b7280", fontSize: 14,
    transition: "border-color .2s",
  },
  table:    { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: {
    textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #f0f0f0",
    fontWeight: 600, fontSize: 12, color: "#6b7280", textTransform: "uppercase",
  },
  td:       { padding: "10px 10px", borderBottom: "1px solid #f9f9f9" },
  btnSm: (variant) => ({
    padding: "4px 12px", borderRadius: 6, border: "none", fontSize: 12,
    fontWeight: 600, cursor: "pointer", marginRight: 6,
    background: variant === "primary" ? "#4f46e5"
              : variant === "danger"  ? "#fee2e2"
              : "#f3f4f6",
    color:      variant === "primary" ? "#fff"
              : variant === "danger"  ? "#dc2626"
              : "#374151",
  }),
  logoutBtn: {
    padding: "6px 14px", background: "transparent", border: "1px solid #e5e7eb",
    borderRadius: 8, cursor: "pointer", fontSize: 13,
  },
  sharedBadge: {
    display: "inline-block", marginLeft: 8,
    padding: "1px 7px", borderRadius: 10,
    background: "#e0e7ff", color: "#4338ca",
    fontSize: 11, fontWeight: 600, verticalAlign: "middle",
  },
};

function formatBytes(b) {
  if (b === 0) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function Dashboard() {
  const { user, logout }            = useAuth();
  const [owned, setOwned]           = useState([]);
  const [shared, setShared]         = useState([]);
  const [uploading, setUploading]   = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [error, setError]           = useState("");
  const fileInput                   = useRef();

  const fetchFiles = () => {
    api.get("/files/")
      .then(res => { setOwned(res.data.owned); setShared(res.data.shared); })
      .catch(() => setError("Failed to load files"));
  };

  useEffect(fetchFiles, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    setError("");
    try {
      await api.post("/files/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchFiles();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      fileInput.current.value = "";
    }
  };

  const handleDownload = async (file) => {
    try {
      const res = await api.get(`/files/${file.id}/download`);
      window.open(res.data.download_url, "_blank", "noopener");
    } catch {
      setError("Download failed");
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.filename}"?`)) return;
    try {
      await api.delete(`/files/${file.id}`);
      fetchFiles();
    } catch {
      setError("Delete failed");
    }
  };

  const FileTable = ({ files, showDelete }) => (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Name</th>
          <th style={styles.th}>Size</th>
          <th style={styles.th}>Uploaded</th>
          <th style={styles.th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {files.length === 0 ? (
          <tr>
            <td colSpan={4} style={{ ...styles.td, color: "#9ca3af", textAlign: "center" }}>
              No files yet
            </td>
          </tr>
        ) : files.map(f => (
          <tr key={f.id}>
            <td style={styles.td}>
              {f.filename}
              {f.is_shared && <span style={styles.sharedBadge}>Shared</span>}
            </td>
            <td style={styles.td}>{formatBytes(f.size_bytes)}</td>
            <td style={styles.td}>{new Date(f.uploaded_at).toLocaleDateString()}</td>
            <td style={styles.td}>
              <button style={styles.btnSm("primary")} onClick={() => handleDownload(f)}>
                Download
              </button>
              {showDelete && (
                <>
                  <button style={styles.btnSm()} onClick={() => setShareTarget(f)}>
                    Share
                  </button>
                  <button style={styles.btnSm("danger")} onClick={() => handleDelete(f)}>
                    Delete
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={styles.page}>
      {/* Nav */}
      <nav style={styles.nav}>
        <span style={styles.navTitle}>CloudDrive</span>
        <div style={styles.navRight}>
          <span>{user?.email}</span>
          <button style={styles.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </nav>

      <div style={styles.body}>
        {error && (
          <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 16px",
                        borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Upload */}
        <div style={styles.section}>
          <h2 style={styles.h2}>Upload File</h2>
          <div
            style={styles.uploadZone}
            onClick={() => fileInput.current.click()}
          >
            {uploading
              ? "Uploading…"
              : "Click to select a file (up to 100 MB)"}
          </div>
          <input
            ref={fileInput}
            type="file"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </div>

        {/* My files */}
        <div style={styles.section}>
          <h2 style={styles.h2}>My Files</h2>
          <FileTable files={owned} showDelete />
        </div>

        {/* Shared with me */}
        <div style={styles.section}>
          <h2 style={styles.h2}>Shared with Me</h2>
          <FileTable files={shared} showDelete={false} />
        </div>
      </div>

      {/* Share modal */}
      {shareTarget && (
        <ShareModal
          file={shareTarget}
          onClose={() => { setShareTarget(null); fetchFiles(); }}
        />
      )}
    </div>
  );
}
