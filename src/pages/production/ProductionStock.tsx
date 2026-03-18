import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Pencil } from "lucide-react";
import { format } from "date-fns";

export default function ProductionStock() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  // Form state
  const [form, setForm] = useState({
    product_id: "",
    product_name: "",
    quantity_available: "",
    unit: "kg",
  });

  const { data: stock, isLoading } = useQuery({
    queryKey: ["production-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_stock")
        .select("*")
        .order("product_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["distribution-products-for-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_products")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const addStock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("production_stock").insert({
        product_id: form.product_id || null,
        product_name: form.product_name,
        quantity_available: Number(form.quantity_available) || 0,
        unit: form.unit,
        updated_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-stock"] });
      setSheetOpen(false);
      setForm({ product_id: "", product_name: "", quantity_available: "", unit: "kg" });
      toast({ title: "Stock entry added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateQty = useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      const { error } = await supabase.from("production_stock").update({
        quantity_available: qty,
        last_updated_at: new Date().toISOString(),
        updated_by: user?.id,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-stock"] });
      setEditingId(null);
      toast({ title: "Quantity updated" });
    },
  });

  const handleProductSelect = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    setForm(prev => ({
      ...prev,
      product_id: productId,
      product_name: product?.name || "",
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Tracker</h1>
          <p className="text-muted-foreground">Production inventory levels</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Stock Entry</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add Stock Entry</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <Label>Product</Label>
                <Select value={form.product_id} onValueChange={handleProductSelect}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Product Name</Label>
                <Input value={form.product_name} onChange={e => setForm(prev => ({ ...prev, product_name: e.target.value }))} placeholder="Product name" />
              </div>
              <div>
                <Label>Quantity Available</Label>
                <Input type="number" value={form.quantity_available} onChange={e => setForm(prev => ({ ...prev, quantity_available: e.target.value }))} />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={v => setForm(prev => ({ ...prev, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="units">units</SelectItem>
                    <SelectItem value="cases">cases</SelectItem>
                    <SelectItem value="boxes">boxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => addStock.mutate()} disabled={!form.product_name}>
                Add Entry
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : stock && stock.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Available Qty</TableHead>
                  <TableHead>Reserved Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.product_name}</TableCell>
                    <TableCell>
                      {editingId === s.id ? (
                        <div className="flex gap-1 items-center">
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={editQty}
                            onChange={e => setEditQty(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") updateQty.mutate({ id: s.id, qty: Number(editQty) });
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                          />
                          <Button size="sm" className="h-8" onClick={() => updateQty.mutate({ id: s.id, qty: Number(editQty) })}>Save</Button>
                        </div>
                      ) : (
                        <span>{Number(s.quantity_available).toFixed(1)}</span>
                      )}
                    </TableCell>
                    <TableCell>{Number(s.quantity_reserved || 0).toFixed(1)}</TableCell>
                    <TableCell>{s.unit}</TableCell>
                    <TableCell>{s.last_updated_at ? format(new Date(s.last_updated_at), "MMM d, HH:mm") : "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => {
                        setEditingId(s.id);
                        setEditQty(String(s.quantity_available));
                      }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No stock entries yet. Add your first inventory item.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
