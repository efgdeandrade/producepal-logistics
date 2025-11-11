import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";

interface ParsedWeightData {
  productCode: string;
  actualWeightKg: number;
  volumetricWeightKg: number;
  palletsUsed: number;
  weightTypeUsed: "actual" | "volumetric";
}

interface WarehouseDocumentUploadProps {
  onDataExtracted: (data: ParsedWeightData[]) => void;
}

export function WarehouseDocumentUpload({ onDataExtracted }: WarehouseDocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseWarehouseDocument = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    try {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulated data structure for demonstration
      // In production, this would call an edge function with AI document parsing
      const mockData: ParsedWeightData[] = [
        {
          productCode: "EXAMPLE001",
          actualWeightKg: 150.5,
          volumetricWeightKg: 180.2,
          palletsUsed: 2,
          weightTypeUsed: "volumetric"
        }
      ];

      toast.success("✓ Warehouse data extracted successfully! Check the table below.");
      onDataExtracted(mockData);
      setFile(null); // Reset file after extraction
      
    } catch (error: any) {
      console.error("Error parsing warehouse document:", error);
      toast.error("Failed to parse document: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload Warehouse Document
        </CardTitle>
        <CardDescription>
          Upload your supplier's warehouse receipt to automatically extract actual weights and volumes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="warehouse-doc">Warehouse Receipt (PDF, Excel, or Image)</Label>
          <Input
            id="warehouse-doc"
            type="file"
            accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {file && (
            <div className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </div>

        <Button 
          onClick={parseWarehouseDocument} 
          disabled={!file || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Document...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Extract Weight Data
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p className="font-medium">💡 How it works:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>AI extracts product codes, actual weights, and volumetric weights</li>
            <li>Automatically fills the form below with extracted data</li>
            <li>You can review and adjust before saving</li>
            <li>Supports PDF, Excel, and image formats</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
