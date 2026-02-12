import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, Loader2, Check, X, Eye, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { COMPONENT_TYPES } from "@/lib/cifEngine";

interface CifDocumentUploadProps {
  orderId?: string;
  onComponentExtracted?: (fields: any) => void;
}

export function CifDocumentUpload({ orderId, onComponentExtracted }: CifDocumentUploadProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("invoice");
  const [reviewDoc, setReviewDoc] = useState<any>(null);

  const { data: documents } = useQuery({
    queryKey: ["cif-documents", orderId],
    queryFn: async () => {
      let query = supabase
        .from("cif_documents")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (orderId) {
        query = query.eq("import_order_id", orderId);
      }
      
      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", docType);
      if (orderId) formData.append("import_order_id", orderId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cif-document-extract`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!result.success) throw new Error(result.error);

      if (result.extracted && result.fields) {
        toast.success(`Document processed: ${result.fields.vendor_name || 'Unknown'} - ${result.fields.currency} ${result.fields.total_amount?.toFixed(2)}`);
        onComponentExtracted?.(result.fields);
      } else {
        toast.warning("Document uploaded but extraction failed. Please review manually.");
      }

      queryClient.invalidateQueries({ queryKey: ["cif-documents", orderId] });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleApprove = async (doc: any) => {
    const { error } = await supabase
      .from("cif_documents")
      .update({ approved_by: (await supabase.auth.getUser()).data.user?.id, approved_at: new Date().toISOString() })
      .eq("id", doc.id);

    if (error) {
      toast.error("Failed to approve");
      return;
    }
    toast.success("Document approved");
    setReviewDoc(null);
    queryClient.invalidateQueries({ queryKey: ["cif-documents", orderId] });
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload CIF Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="customs">Customs Declaration</SelectItem>
                <SelectItem value="freight">Freight Bill</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleUpload}
                disabled={uploading}
                className="h-9"
              />
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      {documents && documents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Uploaded Documents ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Extracted</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const fields = doc.extracted_fields_json as any;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="text-sm font-medium max-w-[200px] truncate">
                        {doc.original_filename}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {doc.document_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {doc.extraction_status === "extracted" ? (
                          <Badge className="bg-green-600 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <X className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {fields?.currency} {fields?.total_amount?.toFixed(2) || "—"}
                      </TableCell>
                      <TableCell>
                        {doc.approved_at ? (
                          <Badge className="bg-primary text-xs">Approved</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setReviewDoc(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewDoc} onOpenChange={() => setReviewDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Extracted Data</DialogTitle>
          </DialogHeader>
          {reviewDoc && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{reviewDoc.original_filename}</div>
              {reviewDoc.extracted_fields_json ? (
                <div className="space-y-2 text-sm">
                  {Object.entries(reviewDoc.extracted_fields_json as Record<string, any>).map(([key, value]) => {
                    if (key === "line_items" && Array.isArray(value)) {
                      return (
                        <div key={key}>
                          <div className="font-medium mb-1">Line Items:</div>
                          {value.map((item: any, i: number) => (
                            <div key={i} className="pl-3 text-xs text-muted-foreground">
                              {item.description}: {item.amount}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No extracted data available</div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDoc(null)}>Close</Button>
            {reviewDoc && !reviewDoc.approved_at && reviewDoc.extracted_fields_json && (
              <Button onClick={() => handleApprove(reviewDoc)}>
                <Check className="h-4 w-4 mr-1" />
                Approve & Apply
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
