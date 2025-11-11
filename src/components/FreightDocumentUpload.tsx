import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";

interface FreightDocumentUploadProps {
  type: "exterior" | "local";
  onDataExtracted: (amount: number) => void;
}

export function FreightDocumentUpload({ type, onDataExtracted }: FreightDocumentUploadProps) {
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
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulated extraction - in production, this would use AI to extract invoice amounts
      const mockAmount = type === "exterior" ? 2500.75 : 450.50;

      toast.success(`✓ ${type === "exterior" ? "Exterior" : "Local"} freight cost extracted: $${mockAmount.toFixed(2)}`);
      onDataExtracted(mockAmount);
      setFile(null); // Reset file after extraction
      
    } catch (error: any) {
      console.error("Error parsing freight document:", error);
      toast.error("Failed to parse document: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const title = type === "exterior" ? "Exterior Agent Invoice" : "Local Agent Invoice";
  const description = type === "exterior" 
    ? "Upload the exterior freight agent invoice to extract actual freight charges"
    : "Upload the local agent invoice to extract local freight charges";

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
          <Label htmlFor={`${type}-doc`} className="text-sm">Invoice (PDF, Excel, or Image)</Label>
          <Input
            id={`${type}-doc`}
            type="file"
            accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-sm"
          />
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
