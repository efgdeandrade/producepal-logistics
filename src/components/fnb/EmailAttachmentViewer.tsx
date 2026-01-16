import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Eye, File, Image, FileText, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Attachment {
  filename: string;
  content_type: string;
  size: number;
  storage_path: string;
}

interface EmailAttachmentViewerProps {
  attachments: Attachment[];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return Image;
  if (contentType === 'application/pdf') return FileText;
  return File;
}

export function EmailAttachmentViewer({ attachments }: EmailAttachmentViewerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');
  const [previewName, setPreviewName] = useState<string>('');
  const { toast } = useToast();

  const getSignedUrl = async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('email-attachments')
        .createSignedUrl(storagePath, 3600); // 1 hour

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to access attachment',
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    const url = await getSignedUrl(attachment.storage_path);
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePreview = async (attachment: Attachment) => {
    const url = await getSignedUrl(attachment.storage_path);
    if (!url) return;

    setPreviewUrl(url);
    setPreviewType(attachment.content_type);
    setPreviewName(attachment.filename);
  };

  const canPreview = (contentType: string): boolean => {
    return (
      contentType.startsWith('image/') ||
      contentType === 'application/pdf'
    );
  };

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="h-4 w-4" />
          <span>{attachments.length} Attachment{attachments.length > 1 ? 's' : ''}</span>
        </div>
        <div className="grid gap-2">
          {attachments.map((attachment, index) => {
            const Icon = getFileIcon(attachment.content_type);
            return (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-md border bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canPreview(attachment.content_type) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePreview(attachment)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewType.startsWith('image/') ? (
              <img
                src={previewUrl || ''}
                alt={previewName}
                className="max-w-full h-auto mx-auto"
              />
            ) : previewType === 'application/pdf' ? (
              <iframe
                src={previewUrl || ''}
                className="w-full h-[70vh]"
                title={previewName}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
