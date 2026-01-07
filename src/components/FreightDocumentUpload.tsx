import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";

interface FreightDocumentUploadProps {
  type: "exterior" | "local";
  onDataExtracted: (amount: number) => void;
  uploadKey?: number;
}

export function FreightDocumentUpload({ type, onDataExtracted, uploadKey }: FreightDocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseFreightDocument = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type === "exterior" ? "exterior_agent" : "local_agent");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-parser`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to parse document');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to extract data');
      }

      const extractedAmount = result.data.totalAmount;

      toast.success(`✓ ${type === "exterior" ? "Exterior" : "Local"} freight cost extracted: $${extractedAmount.toFixed(2)}`);
      onDataExtracted(extractedAmount);
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById(`${type}-doc`) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      console.error("Error parsing freight document:", error);
      const errorMessage = error.message || "Failed to parse document";
      toast.error(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const title = type === "exterior" ? "Exterior Agent Invoice" : "Local Agent Invoice";
  const description = type === "exterior" 
    ? "Upload exterior freight invoice to extract the total cost"
    : "Upload local agent invoice to extract the total cost";

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription className="text-sm">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${type}-doc`} className="text-sm">Invoice</Label>
          <Input
            id={`${type}-doc`}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-sm"
            key={uploadKey}
          />
          <p className="text-xs text-muted-foreground mt-1">
            📄 Upload PDF, JPG, PNG, or WEBP
          </p>
          {file && (
            <div className="text-xs text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </div>

        <Button 
          onClick={parseFreightDocument} 
          disabled={!file || uploading}
          className="w-full"
          size="sm"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-3 w-3" />
              Extract Amount
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}