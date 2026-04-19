import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Download, Trash2, Upload, Lock, Clock, FileText, Image, Film, Music, Archive } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { AuthState } from "@/App";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="w-4 h-4 text-purple-500" />;
  if (mimeType.startsWith("video/")) return <Film className="w-4 h-4 text-blue-500" />;
  if (mimeType.startsWith("audio/")) return <Music className="w-4 h-4 text-green-500" />;
  if (mimeType.includes("pdf")) return <FileText className="w-4 h-4 text-red-500" />;
  if (mimeType.includes("zip") || mimeType.includes("tar")) return <Archive className="w-4 h-4 text-amber-500" />;
  return <FileText className="w-4 h-4 text-muted-foreground" />;
}

function mimeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "text/plain": "TXT",
    "text/x-shellscript": "Shell",
    "application/json": "JSON",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  };
  return map[mimeType] || mimeType.split("/")[1]?.toUpperCase() || "FILE";
}

function UploadDialog({ onUpload }: { onUpload: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState("");
  const [mimeType, setMimeType] = useState("application/pdf");
  const [sizeBytes, setSizeBytes] = useState("1048576");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/files/upload", {
        filename, mimeType, sizeBytes: parseFloat(sizeBytes), description
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/files"] });
      qc.invalidateQueries({ queryKey: ["/api/files/stats"] });
      toast({ title: "File uploaded", description: `${data.file.filename} registered. Presigned PUT URL generated for S3.` });
      setOpen(false);
      setFilename("");
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-upload-file">
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Upload File
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload File to S3</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 leading-relaxed">
            Files are uploaded via AWS S3 presigned PUT URLs. The backend generates a time-limited URL — your browser uploads directly to S3. Users are never exposed to AWS credentials or bucket structure.
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Filename</Label>
            <Input data-testid="input-upload-filename" value={filename} onChange={e => setFilename(e.target.value)} placeholder="report.pdf" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">MIME Type</Label>
            <Input data-testid="input-upload-mime" value={mimeType} onChange={e => setMimeType(e.target.value)} placeholder="application/pdf" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">File size (bytes)</Label>
            <Input data-testid="input-upload-size" type="number" value={sizeBytes} onChange={e => setSizeBytes(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Description (optional)</Label>
            <Input data-testid="input-upload-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" />
          </div>
          <Button data-testid="button-confirm-upload" onClick={() => mutation.mutate()} disabled={!filename || mutation.isPending}>
            {mutation.isPending ? "Uploading…" : "Upload to S3"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FilesPage({ auth }: { auth: AuthState }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = auth.user?.role === "admin";

  const { data: files, isLoading } = useQuery({
    queryKey: ["/api/files"],
    queryFn: async () => {
      const endpoint = isAdmin ? "/api/files/all" : "/api/files";
      const res = await apiRequest("GET", endpoint);
      return res.json();
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await apiRequest("GET", `/api/files/${fileId}/download`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Presigned URL generated",
        description: `Download URL for ${data.filename} created. Expires in ${data.expiresIn}.`,
      });
    },
    onError: (e: any) => toast({ title: "Download failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await apiRequest("DELETE", `/api/files/${fileId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/files"] });
      qc.invalidateQueries({ queryKey: ["/api/files/stats"] });
      toast({ title: "File deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 flex flex-col gap-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My Files</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? "Admin view — all files across all users" : "Files you've uploaded to CloudDrive"}
          </p>
        </div>
        <UploadDialog onUpload={() => {}} />
      </div>

      {/* S3 info banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
        <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
        <span>Files stored in <strong className="text-foreground">s3://clouddrive-files</strong> with AES-256 encryption at rest. Access via presigned URLs only — AWS credentials never exposed to clients.</span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {files && files.length > 0 ? (
              <div className="divide-y">
                {files.map((file: any) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                    data-testid={`file-row-${file.id}`}
                  >
                    <div className="shrink-0">
                      <FileIcon mimeType={file.mimeType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate max-w-xs">{file.filename}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">{mimeLabel(file.mimeType)}</Badge>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">{file.encryptionStatus}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                        <span>{formatBytes(file.sizeBytes)}</span>
                        <span className="flex items-center gap-1">
                          <Download className="w-3 h-3" />{file.downloadCount} downloads
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(file.uploadedAt), { addSuffix: true })}
                        </span>
                        {isAdmin && <span className="text-primary font-mono">owner:{file.ownerId}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadMutation.mutate(file.id)}
                        disabled={downloadMutation.isPending}
                        data-testid={`button-download-${file.id}`}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Get URL
                      </Button>
                      {(file.ownerId === auth.user?.id || isAdmin) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(file.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${file.id}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <div className="text-sm font-medium">No files yet</div>
                <div className="text-xs text-muted-foreground mt-1 mb-4">Upload your first file to get started</div>
                <UploadDialog onUpload={() => {}} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
