import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FolderOpen, 
  FileText, 
  Upload, 
  Search,
  File,
  FileSpreadsheet,
  Image as ImageIcon
} from "lucide-react";

// Placeholder document types for import operations
const documentCategories = [
  { id: 'customs', name: 'Customs Declarations', count: 0 },
  { id: 'airwaybill', name: 'Air Waybills', count: 0 },
  { id: 'commercial', name: 'Commercial Invoices', count: 0 },
  { id: 'packing', name: 'Packing Lists', count: 0 },
  { id: 'certificates', name: 'Certificates of Origin', count: 0 },
  { id: 'phyto', name: 'Phytosanitary Certificates', count: 0 },
];

export default function ImportDocuments() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Documents</h1>
          <p className="text-muted-foreground">
            Manage customs, freight, and compliance paperwork
          </p>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Document Categories */}
      <div className="grid gap-4 md:grid-cols-3">
        {documentCategories.map((category) => (
          <Card key={category.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {category.count} documents
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No documents uploaded yet</p>
            <p className="text-sm">
              Upload customs declarations, air waybills, and other import documents
            </p>
            <Button className="mt-4" variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First Document
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Document Types Info */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Document Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <File className="h-5 w-5 text-red-500" />
              <span>PDF Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-500" />
              <span>Excel Spreadsheets</span>
            </div>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-500" />
              <span>Images (JPG, PNG)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
