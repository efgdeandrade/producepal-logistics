import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderOpen, ExternalLink, RefreshCw, FileText, Image, FileSpreadsheet, Loader2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface GoogleDriveFileBrowserProps {
  orderId: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink: string;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'application/vnd.google-apps.spreadsheet': FileSpreadsheet,
};

function getFileIcon(mimeType: string) {
  const Icon = FILE_ICONS[mimeType] || FileText;
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

function formatFileSize(bytes?: string) {
  if (!bytes) return "—";
  const b = parseInt(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function GoogleDriveFileBrowser({ orderId }: GoogleDriveFileBrowserProps) {
  const [folderUrl, setFolderUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch existing drive link
  const { data: driveLink, refetch: refetchLink } = useQuery({
    queryKey: ["cif-drive-link", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cif_drive_links")
        .select("*")
        .eq("import_order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch files from the linked folder
  const { data: files, isLoading: loadingFiles, refetch: refetchFiles } = useQuery({
    queryKey: ["drive-files", driveLink?.google_drive_folder_id],
    queryFn: async () => {
      if (!driveLink?.google_drive_folder_id) return [];
      const { data, error } = await supabase.functions.invoke("list-drive-files", {
        body: { folderId: driveLink.google_drive_folder_id },
      });
      if (error) throw error;
      return (data?.files || []) as DriveFile[];
    },
    enabled: !!driveLink?.google_drive_folder_id,
  });

  const handleLinkFolder = async () => {
    if (!folderUrl.trim()) return;
    
    // Extract folder ID from URL
    const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      toast.error("Invalid Google Drive folder URL");
      return;
    }

    const folderId = match[1];
    setSaving(true);
    try {
      const { error } = await supabase
        .from("cif_drive_links")
        .upsert({
          import_order_id: orderId,
          google_drive_folder_id: folderId,
          google_drive_folder_url: folderUrl.trim(),
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "import_order_id" });

      if (error) throw error;
      toast.success("Drive folder linked");
      setFolderUrl("");
      refetchLink();
    } catch (err) {
      toast.error("Failed to link folder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Link Folder */}
      {!driveLink ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Link Google Drive Folder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Paste Google Drive folder URL..."
                value={folderUrl}
                onChange={e => setFolderUrl(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={handleLinkFolder} disabled={saving || !folderUrl.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                Link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Paste a Google Drive folder URL to browse its files here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Google Drive Files
                {files && <Badge variant="secondary" className="text-xs">{files.length}</Badge>}
              </CardTitle>
              <div className="flex gap-2">
                {driveLink.google_drive_folder_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={driveLink.google_drive_folder_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => refetchFiles()}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sync
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingFiles ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading files...
              </div>
            ) : files && files.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Modified</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map(file => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.mimeType)}
                          <span className="text-sm font-medium max-w-[250px] truncate">{file.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(file.modifiedTime), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No files in the linked folder yet, or Google Drive access not configured.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
