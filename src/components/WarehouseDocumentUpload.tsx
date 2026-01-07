import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";

interface ParsedWeightData {
  supplierName: string;
  actualWeightKg: number;
  volumetricWeightKg: number;
  palletsUsed: number;
  weightTypeUsed: "actual" | "volumetric";
}

interface WarehouseDocumentUploadProps {
  onDataExtracted: (data: ParsedWeightData[]) => void;
  uploadKey?: number;
  consolidated?: boolean;
}

export function WarehouseDocumentUpload({ onDataExtracted, uploadKey, consolidated = false }: WarehouseDocumentUploadProps) {
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'warehouse');

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

      const extractedData: ParsedWeightData[] = consolidated 
        ? result.data.suppliers.map((s: any) => ({
            supplierName: s.supplierName,
            actualWeightKg: s.actualWeightKg,
            volumetricWeightKg: s.volumetricWeightKg,
            palletsUsed: s.palletsUsed,
            weightTypeUsed: s.weightTypeUsed
          }))
        : result.data.products?.map((p: any) => ({
            supplierName: p.productCode, // Legacy support
            actualWeightKg: p.actualWeightKg,
            volumetricWeightKg: p.volumetricWeightKg,
            palletsUsed: p.palletsUsed,
            weightTypeUsed: p.weightTypeUsed
          })) || [];

      const countLabel = consolidated ? 'suppliers' : 'products';
      toast.success(`✓ Data replaced! Extracted ${extractedData.length} ${countLabel} from new document.`);
      onDataExtracted(extractedData);
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('warehouse-doc') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      console.error("Error parsing warehouse document:", error);
      const errorMessage = error.message || "Failed to parse document";
      toast.error(`Upload failed: ${errorMessage}`);
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
          {consolidated 
            ? "Upload the consolidated warehouse receipt containing all suppliers to automatically extract weight and pallet data"
            : "Upload the warehouse receipt for this supplier to automatically extract weight and pallet data"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="warehouse-doc">Warehouse Receipt</Label>
          <Input
            id="warehouse-doc"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileChange}
            disabled={uploading}
            key={uploadKey}
          />
          <p className="text-xs text-muted-foreground mt-1">
            📄 Upload PDF, JPG, PNG, or WEBP files
          </p>
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
            {consolidated ? (
              <>
                <li>AI extracts ALL suppliers with their weights from the consolidated warehouse receipt</li>
                <li>All supplier weights are populated automatically in one upload</li>
                <li>Fuzzy matching links document data to your order suppliers</li>
                <li>Both actual and volumetric weights are captured per supplier</li>
              </>
            ) : (
              <>
                <li>AI extracts all products with their weights from the supplier's warehouse receipt</li>
                <li>Totals are calculated automatically for this supplier</li>
                <li>Both actual and volumetric weights are captured</li>
              </>
            )}
            <li>Supports PDF, JPG, PNG, and WEBP formats</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
