import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { SearchableSelect } from "../ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Plus, Trash2, Globe, Search } from "lucide-react";
import { toast } from "sonner";

const LANGUAGES = [
  { value: "pap", label: "Papiamento" },
  { value: "en", label: "English" },
  { value: "nl", label: "Dutch" },
  { value: "es", label: "Spanish" },
];

export function GlobalAliasManager() {
  const queryClient = useQueryClient();
  const [newAlias, setNewAlias] = useState("");
  const [newLanguage, setNewLanguage] = useState("pap");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch products for dropdown
  const { data: products = [] } = useQuery({
    queryKey: ["fnb-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fnb_products")
        .select("id, code, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing aliases
  const { data: aliases = [], isLoading } = useQuery({
    queryKey: ["fnb-product-aliases", filterLanguage, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("fnb_product_aliases")
        .select(`
          id,
          alias,
          language,
          confidence_score,
          created_at,
          product_id,
          fnb_products (id, code, name)
        `)
        .order("created_at", { ascending: false });

      if (filterLanguage !== "all") {
        query = query.eq("language", filterLanguage);
      }

      if (searchTerm) {
        query = query.ilike("alias", `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Add new alias
  const addAliasMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fnb_product_aliases").insert({
        alias: newAlias.toLowerCase().trim(),
        language: newLanguage,
        product_id: selectedProductId,
        confidence_score: 1.0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fnb-product-aliases"] });
      setNewAlias("");
      setSelectedProductId("");
      toast.success("Alias added successfully");
    },
    onError: (error) => {
      toast.error(`Failed to add alias: ${error.message}`);
    },
  });

  // Delete alias
  const deleteAliasMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fnb_product_aliases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fnb-product-aliases"] });
      toast.success("Alias deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
  }));

  const canAdd = newAlias.trim() && selectedProductId;

  return (
    <div className="space-y-4">
      {/* Add New Alias Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Alias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alias">Word/Phrase</Label>
            <Input
              id="alias"
              placeholder="e.g., siboyo, komkommer"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={newLanguage} onValueChange={setNewLanguage}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Maps to Product</Label>
            <SearchableSelect
              options={productOptions}
              value={selectedProductId}
              onValueChange={setSelectedProductId}
              placeholder="Search products..."
              className="h-12"
            />
          </div>

          <Button
            className="w-full h-12"
            onClick={() => addAliasMutation.mutate()}
            disabled={!canAdd || addAliasMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Alias
          </Button>
        </CardContent>
      </Card>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search aliases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          <Badge
            variant={filterLanguage === "all" ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setFilterLanguage("all")}
          >
            All
          </Badge>
          {LANGUAGES.map((lang) => (
            <Badge
              key={lang.value}
              variant={filterLanguage === lang.value ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setFilterLanguage(lang.value)}
            >
              {lang.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Aliases List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading aliases...</div>
        ) : aliases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No aliases found</p>
            <p className="text-sm">Add your first alias above</p>
          </div>
        ) : (
          aliases.map((alias) => (
            <Card key={alias.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">"{alias.alias}"</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sm truncate">
                      {alias.fnb_products?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {LANGUAGES.find((l) => l.value === alias.language)?.label || alias.language}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Added {new Date(alias.created_at || "").toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => deleteAliasMutation.mutate(alias.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
