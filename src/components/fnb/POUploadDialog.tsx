import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2 } from 'lucide-react';

interface POUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileSelected: (file: File) => void;
  isUploading: boolean;
  isParsing: boolean;
}

export function POUploadDialog({
  open,
  onOpenChange,
  onFileSelected,
  isUploading,
  isParsing,
}: POUploadDialogProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      onFileSelected(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isValidFile(file)) {
      onFileSelected(file);
    }
  };

  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'application/pdf',
      'text/html',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.pdf', '.html', '.htm', '.csv', '.xlsx', '.xls'];
    return (
      validTypes.includes(file.type) ||
      validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
    );
  };

  const isProcessing = isUploading || isParsing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import from Purchase Order</DialogTitle>
        </DialogHeader>

        <div
          className={`
            mt-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">
                {isUploading ? 'Uploading...' : 'Parsing document with AI...'}
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">
                Drop your PO file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports PDF, HTML, CSV, and Excel files
              </p>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.html,.htm,.csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            disabled={isProcessing}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <FileText className="h-3 w-3" />
          <span>The AI will extract customer, items, and delivery date from your PO</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
