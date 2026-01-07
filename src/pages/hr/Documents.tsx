import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { toast } from "sonner";
import { Upload, FileText, Check, X, Download, AlertTriangle, Search } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const DOCUMENT_TYPES = [
  { value: "id", label: "ID / Passport" },
  { value: "contract", label: "Employment Contract" },
  { value: "certification", label: "Certification" },
  { value: "visa", label: "Visa / Work Permit" },
  { value: "tax", label: "Tax Documents" },
  { value: "other", label: "Other" }
];

export default function Documents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    employee_id: "",
    document_type: "",
    title: "",
    expiry_date: ""
  });

  // Fetch employees for dropdown
  const { data: employees } = useQuery({
    queryKey: ["employees-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ["employee-documents", search, filterType, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("employee_documents")
        .select(`
          *,
          employees (
            full_name,
            department
          )
        `)
        .order("created_at", { ascending: false });

      if (filterType && filterType !== "all") {
        query = query.eq("document_type", filterType);
      }
      if (filterStatus && filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let filtered = data || [];
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter((doc: any) => 
          doc.title.toLowerCase().includes(searchLower) ||
          doc.employees?.full_name?.toLowerCase().includes(searchLower)
        );
      }
      
      return filtered;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadingFile || !uploadForm.employee_id || !uploadForm.document_type || !uploadForm.title) {
        throw new Error("Please fill all required fields");
      }

      // Upload file to storage
      const fileExt = uploadingFile.name.split('.').pop();
      const fileName = `${uploadForm.employee_id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(fileName, uploadingFile);
      
      if (uploadError) throw uploadError;

      // Create document record
      const { error: dbError } = await supabase.from("employee_documents").insert({
        employee_id: uploadForm.employee_id,
        document_type: uploadForm.document_type,
        title: uploadForm.title,
        file_path: fileName,
        file_size: uploadingFile.size,
        expiry_date: uploadForm.expiry_date || null,
        uploaded_by: user?.id,
        status: "pending"
      });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      queryClient.invalidateQueries({ queryKey: ["hr-pending-documents"] });
      toast.success("Document uploaded successfully");
      setIsUploadOpen(false);
      setUploadingFile(null);
      setUploadForm({ employee_id: "", document_type: "", title: "", expiry_date: "" });
    },
    onError: (error) => {
      toast.error("Failed to upload: " + error.message);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("employee_documents").update({
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      queryClient.invalidateQueries({ queryKey: ["hr-pending-documents"] });
      toast.success("Document status updated");
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    }
  });

  const downloadDocument = async (filePath: string, title: string) => {
    const { data, error } = await supabase.storage
      .from("employee-documents")
      .download(filePath);
    
    if (error) {
      toast.error("Failed to download document");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = title;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string, expiryDate: string | null) => {
    const today = new Date();
    const daysUntilExpiry = expiryDate ? differenceInDays(new Date(expiryDate), today) : null;

    if (daysUntilExpiry !== null && daysUntilExpiry <= 0) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (daysUntilExpiry !== null && daysUntilExpiry <= 30) {
      return <Badge variant="secondary" className="bg-yellow-500 text-white">Expiring Soon</Badge>;
    }

    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
        return <Badge variant="outline">Pending Review</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = documents?.filter((d: any) => d.status === "pending").length || 0;
  const expiringCount = documents?.filter((d: any) => {
    if (!d.expiry_date) return false;
    const days = differenceInDays(new Date(d.expiry_date), new Date());
    return days <= 30 && days > 0;
  }).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">Manage employee documents and compliance</p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Employee *</Label>
                <Select 
                  value={uploadForm.employee_id} 
                  onValueChange={(v) => setUploadForm({...uploadForm, employee_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Document Type *</Label>
                <Select 
                  value={uploadForm.document_type} 
                  onValueChange={(v) => setUploadForm({...uploadForm, document_type: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({...uploadForm, title: e.target.value})}
                  placeholder="e.g., Driver's License 2024"
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={uploadForm.expiry_date}
                  onChange={(e) => setUploadForm({...uploadForm, expiry_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>File *</Label>
                <Input
                  type="file"
                  onChange={(e) => setUploadingFile(e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG, DOC up to 10MB</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending}
              >
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{expiringCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DOCUMENT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{doc.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>{doc.employees?.full_name || "Unknown"}</TableCell>
                    <TableCell>
                      {DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type}
                    </TableCell>
                    <TableCell>
                      {doc.expiry_date 
                        ? format(new Date(doc.expiry_date), "MMM d, yyyy")
                        : "-"
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(doc.status, doc.expiry_date)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => downloadDocument(doc.file_path, doc.title)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {doc.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatusMutation.mutate({ id: doc.id, status: "approved" })}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatusMutation.mutate({ id: doc.id, status: "rejected" })}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No documents found. Upload your first document to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}