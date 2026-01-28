import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ImportDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  order_id: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useImportDocuments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["import-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ImportDocument[];
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (document: ImportDocument) => {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from("import-documents")
        .remove([document.file_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        // Continue with database deletion even if storage fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("import_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast({ title: "Document deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["import-documents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDownloadUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("import-documents")
      .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

    if (error) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    return data.signedUrl;
  };

  const getCategoryCounts = () => {
    const counts: Record<string, number> = {};
    documents?.forEach((doc) => {
      counts[doc.category] = (counts[doc.category] || 0) + 1;
    });
    return counts;
  };

  return {
    documents,
    isLoading,
    deleteDocument,
    getDownloadUrl,
    getCategoryCounts,
  };
}
