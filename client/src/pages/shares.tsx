import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Share2, Eye, Edit, X, Plus, ArrowUpRight, ArrowDownLeft, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { AuthState } from "@/App";

function CreateShareDialog() {
  const [open, setOpen] = useState(false);
  const [fileId, setFileId] = useState("");
  const [sharedWithUsername, setSharedWithUsername] = useState("");
  const [permission, setPermission] = useState("read");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: myFiles } = useQuery({
    queryKey: ["/api/files"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/files");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shares", {
        fileId: parseInt(fileId),
        sharedWithUsername: sharedWithUsername || undefined,
        permission,
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/shares"] });
      toast({
        title: "Share created",
        description: `Token: ${data.shareToken}`,
      });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Failed to create share", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-create-share">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Create Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share a File</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Select file</Label>
            <Select value={fileId} onValueChange={setFileId}>
              <SelectTrigger data-testid="select-file-to-share">
                <SelectValue placeholder="Choose a file…" />
              </SelectTrigger>
              <SelectContent>
                {(myFiles || []).map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.filename}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Share with (username, optional)</Label>
            <Input
              data-testid="input-share-username"
              value={sharedWithUsername}
              onChange={e => setSharedWithUsername(e.target.value)}
              placeholder="Leave blank for public link"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Permission</Label>
            <Select value={permission} onValueChange={setPermission}>
              <SelectTrigger data-testid="select-permission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read only</SelectItem>
                <SelectItem value="read_write">Read + Write</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            data-testid="button-confirm-share"
            onClick={() => mutation.mutate()}
            disabled={!fileId || mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create Share Link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PermBadge({ perm }: { perm: string }) {
  return perm === "read_write" ? (
    <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
      <Edit className="w-2.5 h-2.5" />Read+Write
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-[10px] h-4 px-1 gap-0.5">
      <Eye className="w-2.5 h-2.5" />Read
    </Badge>
  );
}

export default function SharesPage({ auth }: { auth: AuthState }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: sharesData, isLoading } = useQuery({
    queryKey: ["/api/shares"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/shares");
      return res.json();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (shareId: number) => {
      const res = await apiRequest("DELETE", `/api/shares/${shareId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/shares"] });
      toast({ title: "Share revoked" });
    },
    onError: (e: any) => toast({ title: "Failed to revoke", description: e.message, variant: "destructive" }),
  });

  const outgoing: any[] = sharesData?.outgoing || [];
  const incoming: any[] = sharesData?.incoming || [];

  const copyToken = (token: string) => {
    navigator.clipboard?.writeText(token).catch(() => {});
    toast({ title: "Share token copied", description: token });
  };

  return (
    <div className="p-6 flex flex-col gap-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Shared Files</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage outgoing and incoming file shares</p>
        </div>
        <CreateShareDialog />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Outgoing */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Outgoing Shares ({outgoing.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {outgoing.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No outgoing shares yet</div>
              ) : (
                <div className="divide-y">
                  {outgoing.map((share: any) => (
                    <div key={share.id} className="flex items-center gap-3 py-3 flex-wrap" data-testid={`share-out-${share.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate max-w-[200px]">{share.file?.filename ?? `File #${share.fileId}`}</span>
                          <PermBadge perm={share.permission} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                          <span>To: <strong className="text-foreground">{share.sharedWithUser?.username ?? "Public"}</strong></span>
                          <span>{share.accessCount} accesses</span>
                          <span>{formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => copyToken(share.shareToken)} data-testid={`button-copy-token-${share.id}`}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => revokeMutation.mutate(share.id)}
                          data-testid={`button-revoke-${share.id}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Incoming */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-sm font-semibold">Incoming Shares ({incoming.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {incoming.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No files shared with you yet</div>
              ) : (
                <div className="divide-y">
                  {incoming.map((share: any) => (
                    <div key={share.id} className="flex items-center gap-3 py-3 flex-wrap" data-testid={`share-in-${share.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate max-w-[200px]">{share.file?.filename ?? `File #${share.fileId}`}</span>
                          <PermBadge perm={share.permission} />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Shared by owner #{share.ownerId} · {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
